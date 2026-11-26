"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { archiefUren, edrUren, vergelijk } = require("./nachtzicht-knmi-weekcontrole.js");

const STATION = { nummer: "240", lat: 52.3172, lon: 4.7897 };
const KOP = "# STN,YYYYMMDD,HH,N,VV,RH\n";
const MIDDERNACHT = Date.parse("2026-11-03T00:00:00Z");

function dekking(tijden, neerslag = tijden.map(() => 0)) {
  return {
    type: "Coverage",
    domain: { axes: { t: { values: tijden }, x: { values: [STATION.lon] }, y: { values: [STATION.lat] } } },
    parameters: {
      N: { unit: { symbol: { value: "okta" } } },
      VV: { unit: { symbol: { value: "1" } } },
      RH: { unit: { symbol: { value: "mm" } } }
    },
    ranges: { N: { values: tijden.map(() => 8) }, VV: { values: tijden.map(() => 54) }, RH: { values: neerslag } }
  };
}

test("HH=24 koppelt aan de volgende UTC-dag en een spoor blijft herkenbaar", () => {
  const archief = archiefUren(KOP + "240,20261102,24,8,54,-1\n240,20261103,1,8,54,2\n", "240");
  const edr = edrUren(dekking(["2026-11-03T00:00:00Z", "2026-11-03T01:00:00Z"], [0, 0.2]), STATION);
  const spoor = vergelijk(MIDDERNACHT, archief, edr);
  assert.deepEqual(spoor.gelijk, { N: true, VV: true, RH: false });
  assert.equal(spoor.spoorNaarNul, true);
  assert.equal(vergelijk(MIDDERNACHT + 3_600_000, archief, edr).gelijk.RH, true);
});

test("lege waarden, onzichtbare bovenlucht en ontbrekende uren blijven afzonderlijk", () => {
  const archief = archiefUren(KOP + "240,20261102,24,9,,0\n", "240");
  const bron = dekking(["2026-11-03T00:00:00Z"]);
  bron.ranges.N.values[0] = 9;
  const edr = edrUren(bron, STATION);
  assert.deepEqual(vergelijk(MIDDERNACHT, archief, edr).gelijk, { N: true, VV: null, RH: true });
  assert.equal(vergelijk(MIDDERNACHT - 3_600_000, archief, edr).edr, null);
});

test("verkeerd station, verkeerde eenheid en dubbele eindtijden worden afgewezen", () => {
  const tijd = "2026-11-03T00:00:00Z";
  assert.throws(() => edrUren(dekking([tijd]), { ...STATION, lon: 5 }), /EDR-locatie/);
  const bron = dekking([tijd]);
  bron.parameters.RH.unit.symbol.value = "%";
  assert.throws(() => edrUren(bron, STATION), /EDR-veld RH/);
  assert.throws(() => edrUren(dekking([tijd, tijd]), STATION), /dubbel EDR-tijdstip/);
  assert.throws(() => archiefUren(KOP + "240,20261102,24,8,54,-1\n".repeat(2), "240"), /Dubbel uur/);
});
