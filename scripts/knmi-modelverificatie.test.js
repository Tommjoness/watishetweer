"use strict";

/* Rekenkern van de KNMI-modelverificatie, zonder netwerk: stationslijst,
   CoverageJSON (één Coverage en een CoverageCollection), Open-Meteo met één
   en meerdere plekken, alleen hele uren, dauwpunt via Magnus, de
   statistiek (afwijking, absolute afwijking, 95e percentiel), dag en nacht
   via is_day, en land of zee via de dagelijkse temperatuurgang. */

const assert = require("assert");
const v = require("./knmi-modelverificatie.js");

const locaties = { type: "FeatureCollection", features: [
  { type: "Feature", id: "0-20000-0-06240", geometry: { type: "Point", coordinates: [4.79, 52.318, -3.3] }, properties: { name: "Schiphol" } },
  { type: "Feature", id: "0-20000-0-06260", geometry: { type: "Point", coordinates: [5.18, 52.1, 1.9] }, properties: { name: "De Bilt" } },
  { type: "Feature", id: "0-20000-0-78990", geometry: { type: "Point", coordinates: [-68.96, 12.2] }, properties: { name: "Bonaire" } }
] };
const stations = v.stationsUitLocaties(locaties);
assert.deepEqual(stations.map(s => s.naam), ["Schiphol", "De Bilt"], "alleen stations in Europees Nederland");

const coverage = (x, y, tijden, ta, rh) => ({ type: "Coverage", domain: { type: "Domain", axes: { x: { values: [x] }, y: { values: [y] }, t: { values: tijden } } },
  ranges: { ta: { type: "NdArray", values: ta }, rh: { type: "NdArray", values: rh } } });
const tijden = ["2026-09-28T10:00:00Z", "2026-09-28T10:10:00Z", "2026-09-28T11:00:00Z"];
const collectie = { type: "CoverageCollection", coverages: [
  coverage(4.79, 52.318, tijden, [20.0, 20.4, 21.0], [60, 61, 55]),
  coverage(5.18, 52.1, tijden, [19.0, 19.2, null], [70, 70, null])
] };
const meting = v.metingenUitCoverage(collectie, stations);
assert.deepEqual([...meting.get("0-20000-0-06240").keys()], ["2026-09-28T10", "2026-09-28T11"], "alleen hele uren");
assert.equal(meting.get("0-20000-0-06240").get("2026-09-28T11").ta, 21.0);
assert.deepEqual([...meting.get("0-20000-0-06260").keys()], ["2026-09-28T10"], "uur zonder waarden valt weg");
const enkel = v.metingenUitCoverage(coverage(5.18, 52.1, ["2026-09-28T10:00:00Z"], [19], [70]), stations);
assert(enkel.has("0-20000-0-06260") && !enkel.has("0-20000-0-06240"), "één Coverage wordt aan het juiste station gekoppeld");
assert.equal(v.metingenUitCoverage(coverage(6.5, 53.2, ["2026-09-28T10:00:00Z"], [19], [70]), stations).size, 0, "geen koppeling met een station ver weg");

const omMeer = [
  { hourly: { time: ["2026-09-28T10:00", "2026-09-28T11:00"], temperature_2m: [21.0, 21.5], relative_humidity_2m: [55, 50], dew_point_2m: [11.6, 10.6], is_day: [0, 1] } },
  { hourly: { time: ["2026-09-28T10:00"], temperature_2m: [18.0], relative_humidity_2m: [75], dew_point_2m: [null] } }
];
const model = v.modelUitOpenMeteo(omMeer, stations);
assert.equal(model.get("0-20000-0-06240").get("2026-09-28T11").ta, 21.5);
const omEen = v.modelUitOpenMeteo(omMeer[1], [stations[1]]);
assert.equal(omEen.get("0-20000-0-06260").get("2026-09-28T10").rh, 75, "één plek: object in plaats van array");

const r = v.vergelijk(model.get("0-20000-0-06240"), meting.get("0-20000-0-06240"));
assert.equal(r.temperatuur.n, 2);
assert(Math.abs(r.temperatuur.bias - 0.75) < 1e-9, "gemiddelde afwijking (1,0 en 0,5)");
assert(Math.abs(r.vochtigheid.bias - (-5)) < 1e-9, "vocht: model 5 %-punt droger");
assert.equal(r.dauwpunt.n, 2);
/* Dauwpunt zonder modelwaarde: berekend uit temperatuur en vocht. */
const r2 = v.vergelijk(model.get("0-20000-0-06260"), meting.get("0-20000-0-06260"));
assert.equal(r2.dauwpunt.n, 1, "dauwpunt van het model valt terug op Magnus");

const s = v.statistiek([1, -1, 2, -2, 0.5, null, NaN]);
assert.equal(s.n, 5);
assert(Math.abs(s.bias - 0.1) < 1e-9 && Math.abs(s.mae - 1.3) < 1e-9 && s.p95 === 2);
assert.deepEqual(v.statistiek([]), { n: 0, bias: null, mae: null, p95: null });

const p = v.periode(14, Date.parse("2026-09-29T15:20:00Z"));
assert.equal(p.start.toISOString(), "2026-09-15T00:00:00.000Z");
assert.equal(p.einde.toISOString(), "2026-09-29T00:00:00.000Z");
assert.deepEqual(v.blokken(p.start, p.einde).map(([a, b]) => a.toISOString().slice(0, 10) + "/" + b.toISOString().slice(0, 10)), ["2026-09-15/2026-09-22", "2026-09-22/2026-09-29"]);

/* Dag en nacht volgen is_day van het model voor dat uur. */
const dag = v.vergelijk(model.get("0-20000-0-06240"), meting.get("0-20000-0-06240"), m => m.dag === 1);
const nacht = v.vergelijk(model.get("0-20000-0-06240"), meting.get("0-20000-0-06240"), m => m.dag === 0);
assert(dag.temperatuur.n === 1 && Math.abs(dag.temperatuur.bias - 0.5) < 1e-9, "overdag: alleen het uur met is_day 1");
assert(nacht.temperatuur.n === 1 && Math.abs(nacht.temperatuur.bias - 1.0) < 1e-9, "'s nachts: alleen het uur met is_day 0");

/* Land of zee: mediane dagelijkse temperatuurgang uit de meting. */
const reeks = (dagen, gang) => { const m = new Map(); dagen.forEach((d, k) => { for (let u = 0; u < 24; u++) m.set(d + "T" + String(u).padStart(2, "0"), { ta: 15 + gang[k] * Math.sin(Math.PI * u / 23), rh: 80 }); }); return m; };
const zeeReeks = reeks(["2026-09-20", "2026-09-21", "2026-09-22"], [0.8, 1.2, 1.0]);
const landReeks = reeks(["2026-09-20", "2026-09-21", "2026-09-22"], [6, 8, 7]);
assert(Math.abs(v.daggang(zeeReeks) - 1.0) < 0.05 && v.soort(zeeReeks) === "zee", "kleine dagelijkse gang: zeeklimaat");
assert(Math.abs(v.daggang(landReeks) - 7) < 0.1 && v.soort(landReeks) === "land", "grote dagelijkse gang: land");
const randReeks = reeks(["2026-09-20", "2026-09-21", "2026-09-22"], [2.4, 2.6, 2.5]);
assert.equal(v.soort(randReeks), "zee", "platform met 2,5 °C daggang is zee");
assert.equal(v.soort(reeks(["2026-09-20", "2026-09-21", "2026-09-22"], [3.0, 3.0, 3.0])), "zee", "platform met 3,0 °C daggang is zee (grens 3,3 °C)");
assert.equal(v.soort(reeks(["2026-09-20", "2026-09-21", "2026-09-22"], [3.6, 3.6, 3.6])), "land", "kuststation met 3,6 °C daggang is land");
const kort = new Map([...landReeks].slice(0, 10));
assert.equal(v.daggang(kort), null, "dagen met te weinig uren tellen niet mee");
assert.equal(v.soort(kort), "land", "zonder daggang geen zee-indeling");

const gr = v.stationsgroepen([{ id: "0-20000-0-06240", naam: "Schiphol", soort: "land" }, { id: "0-20000-0-06260", naam: "De Bilt", soort: "zee" }], model, meting);
assert.deepEqual(gr.map(g => g.naam), ["Alle stations", "Land", "Land, overdag", "Land, 's nachts", "Zee"]);
assert.equal(gr[0].temperatuur.n, 3, "alle stations samen");
assert.equal(gr[1].temperatuur.n, 2, "alleen landstations");
assert.equal(gr[4].temperatuur.n, 1, "alleen zeestations");

const st = { naam: "Schiphol", soort: "land", daggang: 7.2, ...r, overdag: dag, snachts: nacht };
const md = v.markdown({ periode: { start: p.start.toISOString(), eindeInclusief: "2026-09-28" }, groepen: gr, stations: [st] });
assert(md.includes("| Alle stations | 2 | 3 |") && md.includes("| Schiphol | land | 7,2 °C | 2 | +0,5 °C | +1 °C |") && md.includes("CC BY 4.0") && md.includes("mediaan minder dan 3,3 °C"), "samenvatting met groepen, dag/nacht, Nederlandse notatie en bronvermelding");

console.log("KNMI-modelverificatie rekenkern groen: stations, CoverageJSON, Open-Meteo, hele uren, dauwpunt, statistiek, dag/nacht en land/zee.");
