"use strict";

/* Uurselectie: pure functies in interpretatie-engine.js (Node, zonder browser).
   - uurInstantMs / indexVoorInstant: een uur wordt gesleuteld op zijn UTC-instant. Bij een verversing die de
     provider-offset wijzigt, verschuift de index van hetzelfde moment, het instant niet.
   - kiesStandaardUurIndex: eerste punt met eindige temperatuur; alleenToekomst begint bij het eerstvolgende hele uur
     (zelfde grens als de uurtabel: een punt dat al begonnen is telt niet).
   - dubbeleUurAanduidingen: bij de najaarswissel komt één klokuur twee keer voor; het eerste is zomertijd, het tweede
     wintertijd. Het ontbrekende uur van de voorjaarssprong geeft geen aanduiding.
   De tijdas is zoals Open-Meteo hem levert (gemeten 31 oktober 2026: één vaste offset per antwoord, 60-minutenstappen,
   24 uren per as-dag, geen dubbel of ontbrekend label in de provider-tijdstrings zelf). */

const assert = require("assert");
const E = require("../interpretatie-engine.js");

const UUR = 3600000;
/* Uniforme provider-as: tijdstrings in de vaste offset, n uren vanaf een UTC-moment. */
function as(startUtc, offsetS, n) {
  const s = Date.parse(startUtc);
  return Array.from({ length: n }, (_, i) => new Date(s + offsetS * 1000 + i * UUR).toISOString().slice(0, 16));
}
const temp = (n, gat = []) => Array.from({ length: n }, (_, i) => (gat.includes(i) ? null : 10 + (i % 5)));
const ms = iso => Date.parse(iso);
let n = 0;
const ok = (c, m) => { assert(c, m); n++; };
const is = (a, b, m) => { assert.strictEqual(a, b, m); n++; };

/* ---- instant als sleutel ---- */
{
  const t1 = as("2026-10-24T22:00:00Z", 3600, 48);    // as +01:00: 24 okt 23:00 …
  const t2 = as("2026-10-24T22:00:00Z", 7200, 48);    // dezelfde momenten, as +02:00
  const moment = ms("2026-10-25T12:00:00Z");
  const i1 = E.indexVoorInstant(t1, 3600, moment), i2 = E.indexVoorInstant(t2, 7200, moment);
  is(i1, i2, "zelfde reeksstart: zelfde index");
  /* Een nieuw antwoord begint na de wissel een uur later in tekst (andere dagstart): de index verschuift, het instant niet. */
  const nieuw = as("2026-10-24T23:00:00Z", 3600, 48);  // dagstart 00:00 in de nieuwe offset
  const j = E.indexVoorInstant(nieuw, 3600, moment);
  ok(j >= 0 && j !== i1, "de index van hetzelfde moment verschilt tussen twee antwoorden");
  is(E.uurInstantMs(nieuw[j], 3600), moment, "het instant blijft gelijk");
  is(E.indexVoorInstant(t1, 3600, ms("2030-01-01T00:00:00Z")), -1, "buiten de reeks: -1");
  is(E.indexVoorInstant(null, 3600, moment), -1, "geen reeks: -1");
  is(E.indexVoorInstant(t1, 3600, NaN), -1, "geen instant: -1");
}

/* ---- standaarduur ---- */
{
  const t = as("2026-10-30T23:00:00Z", 3600, 192);        // 31 okt 00:00 lokaal (+01:00) …
  const T = temp(192);
  const nu = ms("2026-10-31T13:10:00Z");                 // 14:10 lokaal
  const k = E.kiesStandaardUurIndex(t, T, 3600, nu, { alleenToekomst: true });
  is(t[k], "2026-10-31T15:00", "14:10 → eerstvolgend uur 15:00");
  /* Precies op het hele uur telt dat uur nog als eerstvolgend (zelfde grens als de uurtabel: minuut*60000 < nu wordt overgeslagen). */
  is(t[E.kiesStandaardUurIndex(t, T, 3600, ms("2026-10-31T14:00:00Z"), { alleenToekomst: true })], "2026-10-31T15:00", "op 15:00 lokaal precies");
  is(t[E.kiesStandaardUurIndex(t, T, 3600, ms("2026-10-31T14:00:00.001Z"), { alleenToekomst: true })], "2026-10-31T16:00", "1 ms later: 16:00");
  /* Zonder alleenToekomst (andere dag): het eerste punt met data. */
  is(E.kiesStandaardUurIndex(t, T, 3600, nu, { alleenToekomst: false }), 0, "eerste punt");
  /* Ontbrekende temperatuur op het eerste uur: door naar het volgende punt met data. */
  const gat = temp(192, [15]);
  is(t[E.kiesStandaardUurIndex(t, gat, 3600, nu, { alleenToekomst: true })], "2026-10-31T16:00", "null overgeslagen");
  is(E.kiesStandaardUurIndex(t, temp(192, Array.from({ length: 192 }, (_, i) => i)), 3600, nu, { alleenToekomst: true }), -1, "geen enkel geldig punt");
  is(E.kiesStandaardUurIndex(t, T, 3600, ms("2027-01-01T00:00:00Z"), { alleenToekomst: true }), -1, "geen toekomstig punt meer");
  is(E.kiesStandaardUurIndex(t, [NaN, "x", Infinity], 3600, nu, { alleenToekomst: false }), -1, "geen eindige getallen");
  is(E.kiesStandaardUurIndex(null, T, 3600, nu, {}), -1, "geen reeks");
  /* Middernachtgrens: 23:30 lokaal → 00:00 van morgen. */
  is(t[E.kiesStandaardUurIndex(t, T, 3600, ms("2026-10-31T22:30:00Z"), { alleenToekomst: true })], "2026-11-01T00:00", "23:30 → morgen 00:00");
  /* Kathmandu (+05:45): de as ligt op xx:15 UTC; het eerstvolgende hele lokale uur blijft het eerstvolgende as-punt. */
  const kt = as("2026-07-21T18:15:00Z", 20700, 48);
  is(kt[E.kiesStandaardUurIndex(kt, temp(48), 20700, ms("2026-07-22T10:20:00Z"), { alleenToekomst: true })], "2026-07-22T17:00", "Kathmandu: 16:05 lokaal → eerstvolgend lokaal uur 17:00 (as op een kwartier-offset)");
}

/* ---- zomer-/wintertijd-aanduiding ---- */
{
  /* Herfst, antwoord opgevraagd VÓÓR de wissel (as +02:00): dag 24 okt 00:00 … */
  const herfstVoor = as("2026-10-23T22:00:00Z", 7200, 96);
  const m1 = E.dubbeleUurAanduidingen(herfstVoor, "Europe/Amsterdam", 7200);
  is(m1.size, 2, "twee uren met label 02:00");
  is(m1.get(ms("2026-10-25T00:00:00Z")), "zomertijd", "02:00 CEST = 00:00Z");
  is(m1.get(ms("2026-10-25T01:00:00Z")), "wintertijd", "02:00 CET = 01:00Z");
  /* Antwoord NA de wissel (as +01:00, begint op 25 okt 00:00 in die as = 24 okt 23:00Z). */
  const herfstNa = as("2026-10-24T23:00:00Z", 3600, 96);
  const m2 = E.dubbeleUurAanduidingen(herfstNa, "Europe/Amsterdam", 3600);
  is(m2.get(ms("2026-10-25T00:00:00Z")), "zomertijd", "ook op de nieuwe as: 02:00 CEST");
  is(m2.get(ms("2026-10-25T01:00:00Z")), "wintertijd", "ook op de nieuwe as: 02:00 CET");
  /* Reeks die alleen het tweede uur bevat: geen aanduiding (het label is dan eenduidig binnen de reeks). */
  const alleenTweede = as("2026-10-25T01:00:00Z", 3600, 24);
  is(E.dubbeleUurAanduidingen(alleenTweede, "Europe/Amsterdam", 3600).size, 0, "geen tweeling in de reeks");
  /* Voorjaar: het uur 02:00 bestaat niet; niets te onderscheiden. */
  const voorjaar = as("2026-03-28T23:00:00Z", 3600, 96);
  is(E.dubbeleUurAanduidingen(voorjaar, "Europe/Amsterdam", 3600).size, 0, "voorjaarssprong: geen aanduiding");
  /* Een gewone week zonder wissel. */
  is(E.dubbeleUurAanduidingen(as("2026-07-20T22:00:00Z", 7200, 192), "Europe/Amsterdam", 7200).size, 0, "geen wissel: leeg");
  /* New York: Amerikaanse wissel zondag 1 november 2026 (EDT → EST), as -04:00 zoals gemeten op 31 oktober. */
  const ny = as("2026-10-30T04:00:00Z", -14400, 120);
  const m3 = E.dubbeleUurAanduidingen(ny, "America/New_York", -14400);
  is(m3.size, 2, "New York: 01:00 komt twee keer voor");
  is(m3.get(ms("2026-11-01T05:00:00Z")), "zomertijd", "01:00 EDT = 05:00Z");
  is(m3.get(ms("2026-11-01T06:00:00Z")), "wintertijd", "01:00 EST = 06:00Z");
  /* Zonder tijdzone of reeks: leeg, geen fout. */
  is(E.dubbeleUurAanduidingen(herfstVoor, "", 7200).size, 0, "zonder zone leeg");
  is(E.dubbeleUurAanduidingen(null, "Europe/Amsterdam", 7200).size, 0, "zonder reeks leeg");
}

/* ---- keuze rond de wissel: eerstvolgend uur is altijd het volgende ECHTE uur (beide assen, vers en oud antwoord) ---- */
{
  const gevallen = [
    ["01:30 CEST, vers (+2)", "2026-10-24T23:30:00Z", 7200, "2026-10-25T00:00:00Z"],
    ["02:20 CEST, vers (+2)", "2026-10-25T00:20:00Z", 7200, "2026-10-25T01:00:00Z"],     // tweede 02:00
    ["02:20 CET, vers (+1)", "2026-10-25T01:20:00Z", 3600, "2026-10-25T02:00:00Z"],     // 03:00 CET
    ["02:20 CET, oud antwoord (+2)", "2026-10-25T01:20:00Z", 7200, "2026-10-25T02:00:00Z"],
    ["29 mrt 01:40 CET (+1)", "2026-03-29T00:40:00Z", 3600, "2026-03-29T01:00:00Z"],     // 03:00 CEST
    ["29 mrt 03:20 CEST (+2)", "2026-03-29T01:20:00Z", 7200, "2026-03-29T02:00:00Z"]
  ];
  for (const [naam, nu, off, verwacht] of gevallen) {
    const start = new Date(Math.floor(Date.parse(nu) / UUR) * UUR - 30 * UUR).toISOString();
    const t = as(start, off, 120);
    const k = E.kiesStandaardUurIndex(t, temp(120), off, Date.parse(nu), { alleenToekomst: true });
    is(E.uurInstantMs(t[k], off), Date.parse(verwacht), naam);
  }
}

console.log(`Uurselectie: ${n} controles geslaagd (instant-sleutel, standaarduur, zomer-/wintertijd-aanduiding, beide klokwissels).`);
