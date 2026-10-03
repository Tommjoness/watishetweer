"use strict";

/*
 * Bouwt meteoalarm-gebieden.json: per MeteoAlarm-regiocode (EMMA_ID) de
 * vereenvoudigde gebiedsvorm. Daarmee kan /api/waarschuwingen een waarschuwing
 * die alleen een regiocode heeft (zoals die van het KNMI) aan een plaats koppelen.
 *
 *   - Het token (METEOALARM_API_TOKEN) gaat alleen als Authorization-header mee
 *     naar de Metadata-API, nooit in een URL, log of uitvoerbestand.
 *   - De Metadata-API heeft een daglimiet (gemeten: ongeveer 50 aanvragen per
 *     24 uur). Dit script doet één aanvraag per pagina van 100 regio's
 *     (2027 regio's in oktober 2026: 21 aanvragen).
 *   - De vormen staan in MeteoAlarm-opslag achter ondertekende links. Die links
 *     worden alleen gebruikt om te downloaden en komen nergens in de uitvoer.
 *   - Licentie MeteoAlarm-data: CC BY 4.0.
 *
 * Gebruik (GitHub Actions): node scripts/meteoalarm-gebieden.js
 * Faalt bij een weigering van de API of een ontbrekende vorm.
 */

const fs = require("fs");

const META = "https://api.meteoalarm.org/metadata/v1";
const TOLERANTIE = 0.003; /* graden, ongeveer 200–330 m */
const DECIMALEN = 4;      /* ongeveer 10 m */

/* Douglas-Peucker op een ring [[lon,lat],...]; begin- en eindpunt blijven. */
function vereenvoudig(punten, tol) {
  if (punten.length <= 4) return punten.slice();
  const houd = new Uint8Array(punten.length);
  houd[0] = houd[punten.length - 1] = 1;
  const stapel = [[0, punten.length - 1]];
  while (stapel.length) {
    const [a, b] = stapel.pop();
    const [ax, ay] = punten[a], [bx, by] = punten[b];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let max = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = punten[i];
      let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py, d = ex * ex + ey * ey;
      if (d > max) { max = d; idx = i; }
    }
    if (idx > 0 && max > tol * tol) { houd[idx] = 1; stapel.push([a, idx], [idx, b]); }
  }
  return punten.filter((_, i) => houd[i]);
}

const rond = v => Math.round(v * 10 ** DECIMALEN) / 10 ** DECIMALEN;

/* Polygon of MultiPolygon naar een lijst polygonen (elk: buitenring + gaten),
   vereenvoudigd en afgerond. Een ring die te klein wordt, blijft onvereenvoudigd. */
function compacteVorm(geo) {
  if (!geo) return null;
  const polys = geo.type === "Polygon" ? [geo.coordinates] : geo.type === "MultiPolygon" ? geo.coordinates : null;
  if (!polys) return null;
  const uit = [];
  for (const poly of polys) {
    const ringen = [];
    for (const ring of poly) {
      if (!Array.isArray(ring) || ring.length < 4) continue;
      let v = vereenvoudig(ring, TOLERANTIE);
      if (v.length < 4) v = ring;
      ringen.push(v.map(([x, y]) => [rond(x), rond(y)]));
    }
    if (ringen.length) uit.push(ringen);
  }
  return uit.length ? uit : null;
}

async function main() {
  const TOKEN = String(process.env.METEOALARM_API_TOKEN || "").trim();
  if (!TOKEN) { console.error("METEOALARM_API_TOKEN ontbreekt."); process.exit(1); }
  const kop = { accept: "application/json", "user-agent": "WatIsHetWeer/1.0 (watishetweer.nl)" };
  const limieten = [];
  const regios = [];
  for (let pagina = 1; pagina <= 60; pagina++) {
    const r = await fetch(META + "/geocodes?page=" + pagina, {
      headers: Object.assign({ authorization: "Bearer " + TOKEN }, kop), signal: AbortSignal.timeout(30000)
    });
    limieten.push(Object.assign({ pagina, status: r.status },
      Object.fromEntries([...r.headers].filter(([k]) => /ratelimit|retry-after/i.test(k)))));
    const tekst = await r.text();
    if (r.status !== 200) throw new Error("Metadata-API pagina " + pagina + ": HTTP " + r.status + " " + tekst.slice(0, 160));
    const d = JSON.parse(tekst);
    regios.push(...(d.geocodes || []));
    if (!d.meta || pagina >= d.meta.total_pages) break;
  }
  console.log("Regio's: " + regios.length + "; limietheaders laatste aanvraag: " + JSON.stringify(limieten[limieten.length - 1]));

  const gebieden = {}, mislukt = [];
  let volgende = 0;
  async function werker() {
    while (volgende < regios.length) {
      const g = regios[volgende++];
      try {
        if (!g.feature_url) throw new Error("geen vormlink");
        let r;
        for (let poging = 0; poging < 3; poging++) {
          r = await fetch(g.feature_url, { headers: kop, signal: AbortSignal.timeout(30000) });
          if (r.status < 500 && r.status !== 429) break;
          await new Promise(ok => setTimeout(ok, 1000 * 2 ** poging));
        }
        if (r.status !== 200) throw new Error("HTTP " + r.status);
        const f = JSON.parse(await r.text());
        const geo = f.geometry || (f.features && f.features[0] && f.features[0].geometry);
        const vorm = compacteVorm(geo);
        if (!vorm) throw new Error("geen bruikbare geometrie");
        /* Een code kan meer dan eens voorkomen; de laatst bijgewerkte vorm telt. */
        const oud = gebieden[g.code];
        if (!oud || String(g.updated_at || "") >= String(oud.bijgewerkt || ""))
          gebieden[g.code] = { naam: g.name, type: g.type, bijgewerkt: g.updated_at, vorm };
      } catch (e) {
        mislukt.push({ code: g.code, fout: String(e && e.message || e).replace(/https?:\/\/\S+/g, "(link)") });
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, werker));

  const perLand = {};
  for (const code of Object.keys(gebieden)) perLand[code.slice(0, 2)] = (perLand[code.slice(0, 2)] || 0) + 1;
  const uit = {
    bron: "MeteoAlarm Metadata-API (EUMETNET), /metadata/v1/geocodes",
    licentie: "CC BY 4.0, https://creativecommons.org/licenses/by/4.0/",
    opgehaald: new Date().toISOString(),
    methode: { vereenvoudiging: "Douglas-Peucker " + TOLERANTIE + " graden", decimalen: DECIMALEN },
    aantal: Object.keys(gebieden).length,
    gebieden: Object.fromEntries(Object.keys(gebieden).sort().map(k => [k, gebieden[k]]))
  };
  const json = JSON.stringify(uit);
  if (json.includes(TOKEN)) throw new Error("Token zou in het bestand komen; afgebroken.");
  if (/X-Amz-|Signature=|\?[^"]*sig=/i.test(json)) throw new Error("Ondertekende link zou in het bestand komen; afgebroken.");
  fs.writeFileSync("meteoalarm-gebieden.json", json);
  const verslag = { regios: regios.length, gebieden: uit.aantal, bytes: Buffer.byteLength(json), perLand, mislukt, limieten };
  fs.writeFileSync("meteoalarm-gebieden-verslag.json", JSON.stringify(verslag, null, 1));
  console.log("VERSLAG\n" + JSON.stringify(verslag, null, 1));
  if (mislukt.length) { console.error(mislukt.length + " vormen ontbreken."); process.exit(1); }
}

/* Zet meteoalarm-gebieden.json (uit de workflow) om naar de servermodule
   lib/meteoalarm-gebieden-data.cjs: per land één JSON-tekst, zodat de server
   alleen het land parseert dat hij nodig heeft. Per regio blijven naam en vorm. */
function naarModule(invoer) {
  const d = JSON.parse(fs.readFileSync(invoer, "utf8"));
  if (!d || !d.gebieden || !/CC BY 4\.0/.test(d.licentie || "")) throw new Error("Geen geldig gebiedenbestand: " + invoer);
  const landen = {};
  for (const code of Object.keys(d.gebieden).sort()) {
    const g = d.gebieden[code];
    if (!/^[A-Z]{2}[A-Z0-9]+$/.test(code) || !Array.isArray(g.vorm)) throw new Error("Ongeldige regio " + code);
    (landen[code.slice(0, 2)] = landen[code.slice(0, 2)] || {})[code] = { n: g.naam, v: g.vorm };
  }
  const uit = {
    bron: d.bron, licentie: d.licentie, opgehaald: d.opgehaald, methode: d.methode, aantal: Object.keys(d.gebieden).length,
    landen: Object.fromEntries(Object.entries(landen).map(([k, v]) => [k, JSON.stringify(v)]))
  };
  return "\"use strict\";\n/* GEGENEREERD door: node scripts/meteoalarm-gebieden.js --module meteoalarm-gebieden.json\n"
    + "   Niet met de hand bewerken. Bron: MeteoAlarm (EUMETNET), CC BY 4.0. */\n"
    + "module.exports = " + JSON.stringify(uit) + ";\n";
}

module.exports = { vereenvoudig, compacteVorm, naarModule };
if (require.main === module) {
  if (process.argv[2] === "--module") {
    const pad = require("path").join(__dirname, "..", "lib", "meteoalarm-gebieden-data.cjs");
    fs.writeFileSync(pad, naarModule(process.argv[3] || "meteoalarm-gebieden.json"));
    console.log("Geschreven: " + pad);
  } else main().catch(e => { console.error(String(e && e.message || e).replace(/https?:\/\/\S+\?\S+/g, "(link)")); process.exit(1); });
}
