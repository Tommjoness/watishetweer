"use strict";

/* Moon 2.0, M0: haalt de onafhankelijke referentiegegevens voor de maan bij JPL Horizons
   en schrijft ze naar scripts/maan-referentie/horizons-2026-2028.json.

   NIET IN CI. Dit script doet live aanvragen bij ssd.jpl.nasa.gov en weigert te draaien
   als CI of GITHUB_ACTIONS gezet is. De offline test (scripts/maan-referentie.test.js)
   gebruikt alleen het vastgelegde bestand en eist dat geen workflow dit script of de host
   aanroept.

   Gebruik (lokaal of in een Claude-sessie met toegang tot ssd.jpl.nasa.gov):
     NODE_USE_ENV_PROXY=1 node scripts/maan-referentie/genereer-horizons.js
   (NODE_USE_ENV_PROXY is alleen nodig achter een HTTPS-proxy.)

   Wat wordt opgevraagd (Horizons API, observer-tabellen, tijd in UT, hoeken in graden):
   - topocentrisch per locatie en moment: maan Q 1,2,4,7,10,13,14,17,20,24 (airless,
     standaard) en Q 4 met APPARENT=REFRACTED; zon Q 2,4;
   - geocentrisch (500@399): maan Q 1,2,10,13,14,15,17,20,24 en zon Q 2;
   - opkomst, doorgang en ondergang per locatie en venster: R_T_S_ONLY=GEO, stap 1 minuut
     (Horizons: gebroken bovenrand op 0° boven de geometrische horizon; doorgang = middelpunt);
   - validatie van die tijdstippen: voor de eerste opkomst en ondergang in twee vensters per locatie
     de gebroken middelpunthoogte (Q4 REFRACTED) en de schijfdiameter (Q13) per 10 s, van 120 s
     vóór tot 60 s ná het gerapporteerde tijdstip. Daaruit volgt waar de gebroken bovenrand
     werkelijk door 0° gaat (de onzekerheid van de referentie zelf).
   Kolommen worden onder hun Horizons-kolomnaam bewaard; per aanvraag worden de exacte
   parameters vastgelegd, zodat iedere waarde reproduceerbaar is. */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { LOCATIES, MOMENTEN, OPKOMST_VENSTERS, VALIDATIE_VENSTERS } = require("./referentiekader.js");

const API = "https://ssd.jpl.nasa.gov/api/horizons.api";
const UIT = path.join(__dirname, "horizons-2026-2028.json");

if (process.env.CI || process.env.GITHUB_ACTIONS) {
  console.error("genereer-horizons.js draait nooit in CI: de referentiegegevens worden vooraf vastgelegd.");
  process.exit(2);
}

const wacht = ms => new Promise(r => setTimeout(r, ms));
const jd = utc => Date.parse(utc.replace(" ", "T") + ":00Z") / 86400000 + 2440587.5;
const MAANDEN = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
/* "2026-Mar-28 03:58[:00.000]" -> "2026-03-28 03:58" (afgerond op de minuut) */
function minuut(s) {
  const m = /^(\d{4})-(\w{3})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(s.trim());
  if (!m) throw new Error("onbekend Horizons-tijdformaat: " + s);
  const t = Date.UTC(+m[1], +MAANDEN[m[2]] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) + 30000;
  return new Date(t - (t % 60000)).toISOString().slice(0, 16).replace("T", " ");
}

const aanvragen = [];
let signatuur = null;
const efemeriden = new Set(), eop = new Set();

async function horizons(params, doel) {
  const volledig = { format: "json", OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'OBSERVER'", TIME_TYPE: "'UT'", ANG_FORMAT: "'DEG'", CSV_FORMAT: "'YES'", EXTRA_PREC: "'YES'", ...params };
  const url = API + "?" + new URLSearchParams(volledig).toString();
  let laatste;
  for (let poging = 1; poging <= 4; poging++) {
    try {
      const antwoord = await fetch(url, { headers: { "user-agent": "maan-referentie-generator" } });
      if (!antwoord.ok) throw new Error("HTTP " + antwoord.status);
      const json = await antwoord.json();
      if (!json.result || json.error) throw new Error(json.error || "geen result");
      signatuur = json.signature || signatuur;
      for (const m of json.result.matchAll(/\{source: ([^}]+)\}/g)) efemeriden.add(m[1].trim());
      for (const m of json.result.matchAll(/^EOP (?:file|coverage)\s*: (.+)$/gm)) eop.add(m[0].replace(/\s+/g, " ").trim());
      aanvragen.push({ doel, parameters: volledig });
      await wacht(400);
      return tabel(json.result);
    } catch (e) { laatste = e; await wacht(3000 * poging); }
  }
  throw new Error(doel + ": " + laatste.message);
}

/* CSV-tabel tussen $$SOE en $$EOE, met de kolomnamen uit de kopregel. */
function tabel(result) {
  const soe = result.indexOf("$$SOE"), eoe = result.indexOf("$$EOE");
  if (soe >= 0 && eoe > soe && /No ephemeris meets criteria/.test(result.slice(soe, eoe))) return [];
  if (soe < 0 || eoe < 0) throw new Error("geen $$SOE/$$EOE in Horizons-antwoord:\n" + result.slice(0, 600));
  const kop = result.slice(0, soe).split("\n").reverse().find(l => /^\s*Date__/.test(l));
  const namen = kop.split(",").map(s => s.trim());
  return result.slice(soe + 5, eoe).trim().split("\n").filter(Boolean).map(regel => {
    const cellen = regel.split(",").map(s => s.trim()), rij = {};
    namen.forEach((n, i) => { if (n && i > 0 && cellen[i] !== undefined && cellen[i] !== "") rij[n] = /^[-+]?\d+(\.\d+)?$/.test(cellen[i]) ? Number(cellen[i]) : cellen[i]; });
    rij.markering = [cellen[1] || "", cellen[2] || ""].join("|");
    rij.utc = minuut(cellen[0]);
    return rij;
  });
}
/* Leesbaar en compact: per sleutel op het hoogste niveau één regel per array-element. */
function schrijf(obj) {
  return "{\n" + Object.entries(obj).map(([k, v]) => JSON.stringify(k) + ": " + (Array.isArray(v) ? "[\n" + v.map(x => "  " + JSON.stringify(x)).join(",\n") + "\n]" : JSON.stringify(v))).join(",\n") + "\n}\n";
}
const perMoment = rijen => Object.fromEntries(rijen.map(r => [r.utc, r]));

async function main() {
  const tlist = "'" + MOMENTEN.map(m => jd(m.utc).toFixed(6)).join(" ") + "'";
  const geo = {
    maan: perMoment(await horizons({ COMMAND: "'301'", CENTER: "'500@399'", TLIST: tlist, TLIST_TYPE: "'JD'", QUANTITIES: "'1,2,10,13,14,15,17,20,24'" }, "geocentrisch maan")),
    zon: perMoment(await horizons({ COMMAND: "'10'", CENTER: "'500@399'", TLIST: tlist, TLIST_TYPE: "'JD'", QUANTITIES: "'2'" }, "geocentrisch zon"))
  };
  const topocentrisch = [], geocentrisch = [], opkomst = [], validatie = [];
  for (const m of MOMENTEN) geocentrisch.push({ moment: m.id, utc: m.utc, maan: geo.maan[m.utc], zon: geo.zon[m.utc] });
  for (const l of LOCATIES) {
    const plaats = { CENTER: "'coord@399'", COORD_TYPE: "'GEODETIC'", SITE_COORD: `'${l.lon},${l.lat},${l.hoogteKm}'` };
    const maan = perMoment(await horizons({ ...plaats, COMMAND: "'301'", TLIST: tlist, TLIST_TYPE: "'JD'", QUANTITIES: "'1,2,4,7,10,13,14,17,20,24'" }, l.id + " maan (airless)"));
    const gebroken = perMoment(await horizons({ ...plaats, COMMAND: "'301'", TLIST: tlist, TLIST_TYPE: "'JD'", QUANTITIES: "'4'", APPARENT: "'REFRACTED'" }, l.id + " maan (refracted)"));
    const zon = perMoment(await horizons({ ...plaats, COMMAND: "'10'", TLIST: tlist, TLIST_TYPE: "'JD'", QUANTITIES: "'2,4'" }, l.id + " zon"));
    for (const m of MOMENTEN) {
      if (!maan[m.utc] || !gebroken[m.utc] || !zon[m.utc]) throw new Error(`${l.id} ${m.id}: moment ontbreekt in Horizons-antwoord`);
      topocentrisch.push({ locatie: l.id, moment: m.id, utc: m.utc, maan: maan[m.utc], maanGebroken: gebroken[m.utc], zon: zon[m.utc] });
    }
    for (const v of OPKOMST_VENSTERS) {
      const rijen = await horizons({ ...plaats, COMMAND: "'301'", START_TIME: `'${v.start}'`, STOP_TIME: `'${v.eind}'`, STEP_SIZE: "'1 MINUTES'", R_T_S_ONLY: "'GEO'", QUANTITIES: "'4'" }, `${l.id} opkomst/ondergang ${v.id}`);
      const regel = { locatie: l.id, venster: v.id, start: v.start, eind: v.eind, gebeurtenissen: rijen.map(r => ({ utc: r.utc, soort: r.markering.split("|")[1], azimut: r["Azimuth_(a-app)"], hoogte: r["Elevation_(a-app)"] })) };
      if (!regel.gebeurtenissen.some(g => g.soort === "r" || g.soort === "s")) {
        /* Geen opkomst of ondergang in het venster (circumpolair of de hele tijd onder de horizon):
           leg de gebroken hoogte op begin, midden en eind vast, zodat de toestand controleerbaar is. */
        const t = [v.start, new Date((Date.parse(v.start.replace(" ", "T") + ":00Z") + Date.parse(v.eind.replace(" ", "T") + ":00Z")) / 2).toISOString().slice(0, 16).replace("T", " "), v.eind];
        const h = await horizons({ ...plaats, COMMAND: "'301'", TLIST: "'" + t.map(x => jd(x).toFixed(6)).join(" ") + "'", TLIST_TYPE: "'JD'", QUANTITIES: "'4'", APPARENT: "'REFRACTED'" }, `${l.id} hoogte zonder opkomst/ondergang ${v.id}`);
        regel.zonderOpkomstOfOndergang = h.map(r => ({ utc: r.utc, gebrokenHoogte: r["Elevation_(r-app)"] }));
      }
      opkomst.push(regel);
      if (VALIDATIE_VENSTERS.includes(v.id)) for (const soort of ["r", "s"]) {
        const g = regel.gebeurtenissen.find(x => x.soort === soort);
        if (!g) continue;
        const t0 = Date.parse(g.utc.replace(" ", "T") + ":00Z"), stappen = [];
        for (let sec = -120; sec <= 60; sec += 10) stappen.push(sec);
        const rijen = await horizons({ ...plaats, COMMAND: "'301'", TLIST: "'" + stappen.map(sec => ((t0 + sec * 1000) / 86400000 + 2440587.5).toFixed(8)).join(" ") + "'", TLIST_TYPE: "'JD'", QUANTITIES: "'4,13'", APPARENT: "'REFRACTED'" }, `${l.id} validatie ${soort} ${g.utc}`);
        if (rijen.length !== stappen.length) throw new Error(`${l.id} validatie ${g.utc}: ${rijen.length} van ${stappen.length} rijen`);
        validatie.push({ locatie: l.id, venster: v.id, utc: g.utc, soort, monsters: stappen.map((sec, i) => ({ s: sec, gebrokenHoogte: rijen[i]["Elevation_(r-app)"], diameter: rijen[i]["Ang-diam"] })) });
      }
    }
    console.log("klaar:", l.id);
  }
  const inhoud = { locaties: LOCATIES, momenten: MOMENTEN, vensters: OPKOMST_VENSTERS, topocentrisch, geocentrisch, opkomst, opkomstValidatie: validatie };
  const meta = {
    bron: "NASA/JPL Horizons API (" + API + ")",
    documentatie: "https://ssd.jpl.nasa.gov/horizons/manual.html",
    signatuur,
    efemeriden: [...efemeriden].sort(),
    aardrotatie: [...eop].sort(),
    gegenereerd: new Date().toISOString(),
    generator: "scripts/maan-referentie/genereer-horizons.js",
    definities: {
      tijd: "UT (UTC); momenten op de minuut",
      airless: "Q2/Q4 zonder APPARENT: schijnbare positie (lichttijd, aberratie, nutatie), zonder atmosferische refractie",
      refracted: "maanGebroken: Q4 met APPARENT=REFRACTED (Horizons-refractiemodel, 10 °C, 1010 mbar)",
      astrometrisch: "Q1: astrometrische ICRF-positie (lichttijd, geen aberratie/nutatie)",
      opkomstOndergang: "R_T_S_ONLY=GEO, stap 1 min: gebroken bovenrand op 0° boven de geometrische horizon (geen kimduiking); 't' = doorgang van het middelpunt; marker geldt voor de afgelopen stap (nauwkeurigheid ca. 1 min)",
      opkomstValidatie: "Q4 REFRACTED + Q13 per 10 s rond het RTS-tijdstip: gebroken bovenrand = gebroken middelpunthoogte + halve schijfdiameter (benadering: verschil in refractie over de schijf verwaarloosd)",
      topocentrisch: "CENTER=coord@399, COORD_TYPE=GEODETIC, SITE_COORD=lon,lat,hoogte_km",
      geocentrisch: "CENTER=500@399",
      toekomst: "Voor momenten na de EOP-dekking (zie aardrotatie) gebruikt Horizons voorspelde of geen gemeten aardoriëntatie; het effect op topocentrische posities is hooguit enkele boogseconden (UT1-UTC < 1 s)"
    },
    aanvragen
  };
  meta.inhoudSha256 = crypto.createHash("sha256").update(JSON.stringify(inhoud)).digest("hex");
  fs.writeFileSync(UIT, schrijf({ meta, ...inhoud }));
  console.log(`Geschreven: ${path.relative(process.cwd(), UIT)} (${topocentrisch.length} topocentrische, ${geocentrisch.length} geocentrische rijen, ${opkomst.reduce((s, o) => s + o.gebeurtenissen.length, 0)} opkomst/ondergang/doorgang-gebeurtenissen; ${aanvragen.length} aanvragen).`);
}

main().catch(e => { console.error(e); process.exit(1); });
