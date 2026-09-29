"use strict";

/* Rekenkern van de KNMI-modelverificatie, zonder netwerk: stationslijst,
   CoverageJSON (één Coverage en een CoverageCollection), Open-Meteo met één
   en meerdere plekken, alleen hele uren, dauwpunt via Magnus en de
   statistiek (afwijking, absolute afwijking, 95e percentiel). */

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
  { hourly: { time: ["2026-09-28T10:00", "2026-09-28T11:00"], temperature_2m: [21.0, 21.5], relative_humidity_2m: [55, 50], dew_point_2m: [11.6, 10.6] } },
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

const md = v.markdown({ periode: { start: p.start.toISOString(), eindeInclusief: "2026-09-28" }, totaal: r, stations: [{ naam: "Schiphol", ...r }] });
assert(md.includes("| Temperatuur | 2 | +0,8 °C |") && md.includes("| Schiphol |") && md.includes("CC BY 4.0"), "samenvatting met Nederlandse notatie en bronvermelding");

console.log("KNMI-modelverificatie rekenkern groen: stations, CoverageJSON, Open-Meteo, hele uren, dauwpunt en statistiek.");
