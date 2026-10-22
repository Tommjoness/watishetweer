"use strict";

/* De maanpagina rond een klokwissel (o.a. wintertijd op zondag 25 oktober 2026).
   - Op een dag van 23, 24 of 25 uur komen opkomst en ondergang overeen met een scan van de
     werkelijke lokale kalenderdag (voorheen scande de kern vast 24 uur vanaf middernacht en
     miste dan een gebeurtenis in het 25e uur: 30-10-2033, 28-10-2040 en 25-10-2043).
   - De hoofdfasen rond de wissel krijgen de juiste lokale tijd en datum (volle maan 26 oktober
     2026 om ca. 05:11 wintertijd = 04:11 UTC).
   - De tijden rond 02:00-03:00 op de wisseldag zijn in beide uren correct (CEST en CET). */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { zonMaanBron, laadKern } = require("./nachtzicht-bron.js");

const INDEX = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const K = laadKern(INDEX);
const TZ = "Europe/Amsterdam", DE_BILT = [52.1, 5.18];

/* Orakel: dezelfde astronomie, maar gescand over de echte lokale dag (begin tot volgende middernacht). */
const bron = INDEX.slice(INDEX.indexOf("function opOnder("), INDEX.indexOf("// lokale tijdstring naar UTC-milliseconden"));
const orakel = new Function(zonMaanBron(INDEX) + "\n" + bron
  .replace("function opOnder(welk,startUTC,lat,lon){", "function opOnderDag(welk,startUTC,eindUTC,lat,lon){")
  .replace("t<=startUTC+86400000", "t<=eindUTC") + "\nreturn {opOnderDag};")().opOnderDag;
const volgendeDag = d => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };
const laatsteZondag = (jaar, maand) => { const d = new Date(Date.UTC(jaar, maand, 0, 12)); while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
const tijd = ms => (ms == null ? null : K.naarLokaal(ms, TZ));

function controleer(dag, lat, lon) {
  const begin = K.naarUTC(dag + "T00:00", TZ), eind = K.naarUTC(volgendeDag(dag) + "T00:00", TZ);
  const o = K.maanOverzicht(begin + 12 * 3600000, lat, lon, TZ), g = orakel("maan", begin, eind, lat, lon);
  assert.strictEqual(o.op || null, tijd(g.op), `${dag}: maanopkomst ${o.op} wijkt af van de echte lokale dag (${tijd(g.op)})`);
  assert.strictEqual(o.onder || null, tijd(g.onder), `${dag}: maanondergang ${o.onder} wijkt af van de echte lokale dag (${tijd(g.onder)})`);
  return { o, uren: (eind - begin) / 3600000 };
}

/* 1. Wintertijd 2026 en de dagen eromheen: een dag van 25 uur op zondag 25 oktober. */
for (const dag of ["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"]) {
  const { uren } = controleer(dag, ...DE_BILT);
  assert.strictEqual(uren, dag === "2026-10-25" ? 25 : 24, `${dag}: dagduur`);
}

/* 2. Alle klokwisseldagen 2026-2045 voor De Bilt, en een hoge en een zuidelijke breedte. */
let wisseldagen = 0;
for (let jaar = 2026; jaar <= 2045; jaar++) for (const dag of [laatsteZondag(jaar, 3), laatsteZondag(jaar, 10)]) {
  controleer(dag, ...DE_BILT); controleer(dag, 69.65, 18.96); controleer(dag, -33.93, 18.42); wisseldagen++;
}
assert.strictEqual(wisseldagen, 40);

/* 3. De dagen waarop het 25e uur een gebeurtenis bevat, komen er nu in voor. */
assert.deepStrictEqual([controleer("2033-10-30", ...DE_BILT).o.onder, controleer("2040-10-28", ...DE_BILT).o.op, controleer("2043-10-25", ...DE_BILT).o.op], ["23:09", "23:31", "23:23"]);

/* 4. Hoofdfasen over de klokwissel: volle maan 26 oktober 2026 ca. 05:11 wintertijd (04:11 UTC). */
const fasen = K.hoofdfasen(Date.UTC(2026, 9, 24, 12), 4, TZ);
assert.strictEqual(fasen.length, 4);
assert.strictEqual(fasen[0].naam, "volle maan");
assert.strictEqual(fasen[0].datum, "2026-10-26");
assert(Math.abs(fasen[0].ms - Date.UTC(2026, 9, 26, 4, 11)) <= 5 * 60000, "volle maan wijkt meer dan 5 minuten af van 04:11 UTC");
assert.strictEqual(fasen[0].tijd, "05:11", "lokale tijd na de wissel is wintertijd (UTC+1)");
assert.strictEqual(JSON.stringify(fasen.map(f => f.naam)), JSON.stringify(["volle maan", "laatste kwartier", "nieuwe maan", "eerste kwartier"]));
for (let i = 1; i < fasen.length; i++) assert(fasen[i].ms > fasen[i - 1].ms, "fasen staan op volgorde");

/* 5. Beide uren tussen 02:00 en 03:00 op de wisseldag lezen 02:xx (CEST, dan CET), de datum blijft 25 oktober. */
assert.strictEqual(K.naarLokaal(Date.UTC(2026, 9, 25, 0, 30), TZ), "02:30");
assert.strictEqual(K.naarLokaal(Date.UTC(2026, 9, 25, 1, 30), TZ), "02:30");
assert.strictEqual(K.naarLokaal(Date.UTC(2026, 9, 25, 2, 30), TZ), "03:30");
assert.strictEqual(K.lokaleDatum(Date.UTC(2026, 9, 25, 1, 30), TZ), "2026-10-25");
const overzichtDubbel = [Date.UTC(2026, 9, 25, 0, 30), Date.UTC(2026, 9, 25, 1, 30)].map(ms => K.maanOverzicht(ms, ...DE_BILT, TZ));
assert.deepStrictEqual([overzichtDubbel[0].datum, overzichtDubbel[1].datum], ["2026-10-25", "2026-10-25"]);
assert.strictEqual(overzichtDubbel[0].op, overzichtDubbel[1].op, "de lokale dag is dezelfde, dus ook opkomst en ondergang");
assert.strictEqual(overzichtDubbel[0].onder, overzichtDubbel[1].onder);

console.log("Maan rond de klokwissel: 25-uursdag 25-10-2026 en de dagen eromheen, 40 klokwisseldagen 2026-2045 op drie breedtes, fasen in wintertijd, beide uren 02:xx.");
