"use strict";

/*
 * Verkent de beschermde MeteoAlarm EDR-API met METEOALARM_API_TOKEN en schrijft
 * een geschoonde steekproef naar meteoalarm-edr-steekproef.json:
 *   - nooit het token (alleen in de Authorization-header, nooit in een URL);
 *   - ondertekende opslaglinks zonder querystring (geen AWS-handtekeningen);
 *   - geometrieën ingekort tot hun type en aantal punten.
 * Gebruik (GitHub Actions): node scripts/meteoalarm-edr-verken.js NL BE DE
 * Faalt als het token ontbreekt of als MeteoAlarm de aanvraag niet met 200 beantwoordt.
 */

const fs = require("fs");

const TOKEN = String(process.env.METEOALARM_API_TOKEN || "").trim();
if (!TOKEN) { console.error("METEOALARM_API_TOKEN ontbreekt."); process.exit(1); }
const ROOT = "https://api.meteoalarm.org/edr/v1";
const LANDEN = process.argv.slice(2).filter(x => /^[A-Z]{2}$/.test(x));
if (!LANDEN.length) LANDEN.push("NL");

const kaal = href => String(href || "").split("?")[0];
function schoon(waarde, diepte = 0) {
  if (Array.isArray(waarde)) return waarde.slice(0, 6).map(v => schoon(v, diepte + 1));
  if (waarde && typeof waarde === "object") {
    const uit = {};
    for (const [k, v] of Object.entries(waarde)) {
      if (k === "coordinates") { uit[k] = "(" + JSON.stringify(v).split(",").length + " getallen)"; continue; }
      if (/href|link|url/i.test(k) && typeof v === "string") { uit[k] = kaal(v); continue; }
      uit[k] = schoon(v, diepte + 1);
    }
    return uit;
  }
  if (typeof waarde === "string") {
    if (/^https?:\/\//.test(waarde)) return kaal(waarde);
    return waarde.length > 300 ? waarde.slice(0, 300) + "…" : waarde;
  }
  return waarde;
}

async function haal(url, metToken) {
  const t0 = Date.now();
  const r = await fetch(url, {
    headers: Object.assign({ accept: "application/geo+json, application/json;q=0.9, */*;q=0.1",
      "user-agent": "WatIsHetWeer/1.0 (watishetweer.nl)" }, metToken ? { authorization: "Bearer " + TOKEN } : {}),
    signal: AbortSignal.timeout(20000)
  });
  const tekst = await r.text();
  return { status: r.status, ms: Date.now() - t0, type: r.headers.get("content-type"), lengte: tekst.length,
    ratelimit: Object.fromEntries([...r.headers].filter(([k]) => /rate|limit|retry|cache|age|etag|last-modified/i.test(k))), tekst };
}

(async () => {
  const nu = new Date();
  const week = new Date(nu.getTime() - 7 * 864e5);
  const steekproef = { opgehaald: nu.toISOString(), landen: {} };
  const lijst = await haal(ROOT + "/collections/warnings/locations", true);
  steekproef.locaties = { status: lijst.status, ms: lijst.ms, lengte: lijst.lengte, voorbeeld: lijst.status === 200 ? schoon(JSON.parse(lijst.tekst)) : lijst.tekst.slice(0, 300) };
  for (const land of LANDEN) {
    /* MeteoAlarm weigert een open eind ("invalid active: invalid to date"),
       ook al noemt de documentatie het toegestaan: geef een vast venster. */
    const straks = new Date(nu.getTime() + 7 * 864e5);
    const q = new URLSearchParams({ datetime: week.toISOString() + "/" + nu.toISOString(), active: nu.toISOString() + "/" + straks.toISOString() });
    const r = await haal(ROOT + "/collections/warnings/locations/" + land + "?" + q, true);
    const uit = { status: r.status, ms: r.ms, type: r.type, lengte: r.lengte, headers: r.ratelimit };
    if (r.status === 200) {
      const d = JSON.parse(r.tekst);
      uit.topniveau = Object.keys(d);
      uit.numberMatched = d.numberMatched; uit.numberReturned = d.numberReturned;
      uit.links = schoon(d.links);
      const f = d.features || [];
      uit.aantalFeatures = f.length;
      uit.propertySleutels = [...new Set(f.flatMap(x => Object.keys(x.properties || {})))].sort();
      uit.featureTypes = [...new Set(f.map(x => x.properties && x.properties.featureType))];
      uit.geometrieTypes = [...new Set(f.map(x => x.geometry && x.geometry.type))];
      uit.talen = [...new Set(f.map(x => x.properties && (x.properties.language || x.properties.hubLanguage)))];
      uit.voorbeeldFeatures = schoon(f.slice(0, 3));
      /* Eén exacte vorm en één CAP-bericht, om hun structuur te kennen. */
      const eerste = f.find(x => Array.isArray(x.links) && x.links.length);
      if (eerste) {
        for (const l of eerste.links) {
          const s = await haal(l.href, false);
          let inhoud = s.tekst.slice(0, 200);
          try { inhoud = schoon(JSON.parse(s.tekst)); } catch (e) {}
          uit["gekoppeld_" + (l.rel || l.type)] = { status: s.status, ms: s.ms, type: s.type, lengte: s.lengte, inhoud };
        }
      }
    } else uit.fout = r.tekst.slice(0, 300);
    steekproef.landen[land] = uit;
    console.log(`${land}: HTTP ${r.status}, ${r.ms} ms, ${r.lengte} bytes, ${uit.aantalFeatures ?? "?"} features (numberMatched ${uit.numberMatched ?? "?"})`);
  }
  const json = JSON.stringify(steekproef, null, 1);
  if (json.includes(TOKEN)) throw new Error("Token zou in de steekproef komen; afgebroken.");
  const mislukt = Object.entries(steekproef.landen).filter(([, v]) => v.status !== 200).map(([k, v]) => k + " " + v.status);
  fs.writeFileSync("meteoalarm-edr-steekproef.json", json);
  /* Ook in het log, zodat de structuur zonder artifact-download leesbaar is. */
  console.log("STEEKPROEF\n" + json);
  console.log("Steekproef geschreven (zonder token en zonder ondertekende links).");
  if (steekproef.locaties.status !== 200 || mislukt.length) {
    console.error("MeteoAlarm weigerde of faalde: locaties " + steekproef.locaties.status + (mislukt.length ? "; " + mislukt.join(", ") : ""));
    process.exit(1);
  }
})().catch(e => { console.error(String(e && e.message || e)); process.exit(1); });
