"use strict";

/* Unittests voor de Nachtzicht-pagina's: de parkenlijst en het lichtfilter,
   de maanfasen (Meeus), de samenstelling van de kern uit de eigenaren van de
   app, de aanvraag naar Open-Meteo en de opbouw van de pagina's. De gelijkheid
   met de app zelf toetst nachtzicht-pariteit-browser.test.js. */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { PARKEN, BASIS, MAAN, parkUrl } = require("./nachtzicht.config.js");
const { parkenMetLicht, lichtVoorPark, parkPagina, overzichtPagina, maanPagina } = require("./generate-nachtzicht.js");
const { zonMaanBron, presentatieBron, kernBron, laadKern } = require("./nachtzicht-bron.js");

const ROOT = path.join(__dirname, "..");
const INDEX = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const RUNTIME = fs.readFileSync(path.join(__dirname, "nachtzicht-runtime.js"), "utf8");
const K = laadKern(INDEX);
const gewoon = v => JSON.parse(JSON.stringify(v));

/* ---------- parken en lichtvervuiling ---------- */
assert.strictEqual(new Set(PARKEN.map(p => p.slug)).size, PARKEN.length, "dubbele slug in de parkenlijst");
for (const p of PARKEN) {
  assert(/^[a-z0-9-]+$/.test(p.slug), `slug ${p.slug} is niet url-veilig`);
  assert(/^Q\d+$/.test(p.wikidata), `${p.slug}: Wikidata-id ontbreekt`);
  assert(p.lat > 50.7 && p.lat < 53.6 && p.lon > 3.3 && p.lon < 7.3, `${p.slug}: coördinaat ligt niet in Nederland`);
}
const parken = parkenMetLicht();
assert.strictEqual(parken.length, 19, "verwacht 19 parken met een volledige lichtkaart");
for (const grens of ["meinweg", "zoom-kalmthoutse-heide"]) {
  assert.strictEqual(lichtVoorPark(PARKEN.find(p => p.slug === grens)), null, `${grens} ligt aan de grens en hoort niet mee te doen`);
}
for (let i = 1; i < parken.length; i++) {
  const a = parken[i - 1], b = parken[i];
  assert(a.licht.volgorde < b.licht.volgorde || (a.licht.volgorde === b.licht.volgorde && a.kort.localeCompare(b.kort, "nl") <= 0), "parken staan niet van donker naar licht");
}

/* ---------- maanfasen (Meeus) tegen gepubliceerde momenten, UTC ---------- */
const BEKEND = [
  ["volle maan", Date.UTC(2026, 0, 3, 10, 3)],
  ["nieuwe maan", Date.UTC(2026, 1, 17, 12, 1)],
  ["nieuwe maan", Date.UTC(2026, 7, 12, 17, 37)],
  ["volle maan", Date.UTC(2026, 9, 26, 4, 11)]
];
for (const [naam, ms] of BEKEND) {
  const fase = gewoon(K.hoofdfasen(ms - 3 * 86400000, 4, "UTC")).find(f => f.naam === naam);
  assert(fase && Math.abs(fase.ms - ms) <= 5 * 60000, `${naam} rond ${new Date(ms).toISOString()}: berekend ${fase && new Date(fase.ms).toISOString()}`);
}
const fasen = gewoon(K.hoofdfasen(Date.UTC(2026, 9, 6, 12), 4, "Europe/Amsterdam"));
assert.deepStrictEqual(fasen.map(f => f.naam + " " + f.datum + " " + f.tijd), [
  "nieuwe maan 2026-10-10 17:50", "eerste kwartier 2026-10-18 18:12", "volle maan 2026-10-26 05:11", "laatste kwartier 2026-11-01 21:28"
], "fasen in Nederlandse tijd, ook na de overgang naar wintertijd");

/* ---------- samenstelling van de kern ---------- */
assert.throws(() => zonMaanBron(INDEX.replace("/* ---------- stand van zon en maan ---------- */", "")), /stand van zon en maan/, "ontbrekend anker in index.html moet de build laten falen");
const presentatie = presentatieBron();
assert(presentatie.includes("Matige omstandigheden, maar door") && !presentatie.includes("Geen goed zichtvenster"), "de tekstbewerkingen van de build op de vensterzin ontbreken");
assert(kernBron(INDEX).includes("function nachtzichtScore(rijen){"), "de scorefunctie van de app ontbreekt in de kern");
assert.deepStrictEqual(gewoon(K.nachten({}, 52, 5, "Europe/Amsterdam")), [], "zonder data geen nachten");
assert.deepStrictEqual(gewoon(K.nachten({ hourly: { time: ["2026-10-06T22:00"] }, daily: {} }, 52, 5, "Europe/Amsterdam")), [], "zonder is_day geen nachten");

/* ---------- dezelfde aanvraag als de app ---------- */
const lijst = (bron, re, label) => { const m = re.exec(bron); assert(m, label + " niet gevonden"); return m[1].split(","); };
const appUur = lijst(INDEX.replace(/"\s*\n\s*\+"/g, ""), /const f=basis\+"[^"]*&hourly=([a-z0-9_,]+)/, "uurvelden van de app");
const appNu = lijst(INDEX.replace(/"\s*\n\s*\+"/g, ""), /&current=([a-z0-9_,]+)/, "actuele velden van de app");
for (const v of lijst(RUNTIME, /const UURVELDEN = "([^"]+)"/, "UURVELDEN")) assert(appUur.includes(v), `uurveld ${v} vraagt de app niet op`);
for (const v of lijst(RUNTIME, /const NUVELDEN = "([^"]+)"/, "NUVELDEN")) assert(appNu.includes(v), `actueel veld ${v} vraagt de app niet op`);
for (const deel of ["past_hours=24", "wind_speed_unit=kmh", "daily=sunrise,sunset"]) assert(RUNTIME.includes(deel), `aanvraag mist ${deel}`);

/* ---------- pagina's ---------- */
const kern = kernBron(INDEX);
const park = parken[0], html = parkPagina(park, kern);
assert(html.includes(`<link rel="canonical" href="${parkUrl(park)}">`), "canonical van de parkpagina");
assert(html.includes(`<h1>Sterren kijken in ${park.naam}</h1>`), "kop van de parkpagina");
assert(/connect-src 'self' https:\/\/api\.open-meteo\.com;/.test(html), "CSP staat alleen Open-Meteo toe");
assert(!/<script[^>]+src=/.test(html), "geen externe scripts");
const config = JSON.parse(/<script type="application\/json" id="nz-config">([^<]*)<\/script>/.exec(html)[1]);
assert.deepStrictEqual(config.park, { slug: park.slug, lat: park.lat, lon: park.lon }, "configuratie van de parkpagina");
const overzicht = overzichtPagina(parken, kern);
assert.strictEqual((overzicht.match(/<tr data-park="/g) || []).length, parken.length, "overzicht heeft een rij per park");
for (const p of parken) assert(overzicht.includes(`href="${BASIS}${p.slug}/"`), `overzicht linkt niet naar ${p.slug}`);
const maan = maanPagina(kern, Date.UTC(2026, 9, 6, 12));
assert(maan.includes(`<link rel="canonical" href="https://watishetweer.nl${MAAN}">`) && maan.includes('id="nz-maan-fasen"'), "maanpagina");

console.log(`Nachtzicht: ${PARKEN.length} parken in de lijst, ${parken.length} met volledige lichtkaart; ${BEKEND.length} maanfasen binnen 5 minuten; kern en aanvraag gelijk aan de app; pagina-opbouw klopt.`);
