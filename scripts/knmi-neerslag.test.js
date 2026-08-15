"use strict";

const assert = require("assert");
const {
  binnenKnmiDekking,
  actueelPuntUrl,
  normaliseerPuntAntwoord,
  haalActueelPunt
} = require("../lib/knmi-neerslag.cjs")._intern;

let n = 0;
function test(naam, fn) {
  Promise.resolve().then(fn).then(() => {
    n++;
    console.log("OK  " + naam);
  }).catch(e => {
    console.error("FOUT " + naam + "\n  " + e.stack);
    process.exitCode = 1;
  });
}

test("Vianen valt binnen de KNMI-dekking", () => {
  assert.equal(binnenKnmiDekking(51.989, 5.0939), true);
  assert.equal(binnenKnmiDekking(40.7128, -74.006), false);
});

test("GetPointValue gebruikt numerieke WMS-puntopvraag en geen kaartbeeld", () => {
  const u = new URL(actueelPuntUrl(51.989, 5.0939));
  assert.equal(u.searchParams.get("DATASET"), "nl_rdr_data_rtcor_5m");
  assert.equal(u.searchParams.get("REQUEST"), "GetPointValue");
  assert.equal(u.searchParams.get("QUERY_LAYERS"), "precipitation_real_time");
  assert.equal(u.searchParams.get("INFO_FORMAT"), "application/json");
  assert.equal(u.searchParams.get("X"), "5.09390");
  assert.equal(u.searchParams.get("Y"), "51.98900");
  assert.equal(u.searchParams.has("BBOX"), false);
  assert.equal(u.searchParams.has("WIDTH"), false);
  assert.equal(u.searchParams.has("HEIGHT"), false);
});

test("ADAGUC JSON wordt naar laatste numerieke puntwaarde genormaliseerd", () => {
  const uit = normaliseerPuntAntwoord([{
    name: "precipitation_amount",
    units: "mm",
    point: { SRS: "EPSG:4326", coords: "5.093900,51.989000" },
    dims: "time",
    data: {
      "2026-08-15T09:55:00Z": "0.000",
      "2026-08-15T10:00:00Z": "0.033"
    }
  }]);
  assert.equal(uit.waarde, 0.033);
  assert.equal(uit.tijd, "2026-08-15T10:00:00Z");
  assert.equal(uit.units, "mm");
});

test("haalActueelPunt accepteert een geldige numerieke WMS-respons", async () => {
  const fakeFetch = async url => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify([{
      name: "precipitation_amount",
      units: "mm",
      point: { SRS: "EPSG:4326", coords: "5.093900,51.989000" },
      dims: "time",
      data: { "2026-08-15T10:00:00Z": "0.033" }
    }])
  });
  const uit = await haalActueelPunt(51.989, 5.0939, fakeFetch);
  assert.equal(uit.waarde, 0.033);
  assert.equal(uit.bron, "KNMI RTCOR 5m");
});

process.on("beforeExit", () => {
  if (!process.exitCode) console.log("\nKNMI-neerslagpunt: " + n + " regressies geslaagd.");
});
