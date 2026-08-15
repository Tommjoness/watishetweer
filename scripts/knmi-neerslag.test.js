"use strict";

const assert = require("assert");
const {
  binnenKnmiDekking,
  actueelPuntUrl,
  capabilitiesUrl,
  nowcastPuntUrl,
  isVers,
  normaliseerPuntAntwoord,
  referenceTimeUitCapabilities,
  normaliseerNowcastAntwoord,
  haalActueelPunt,
  haalNowcastPunt
} = require("../lib/knmi-neerslag.cjs")._intern;

const NU = Date.parse("2026-08-15T10:40:00Z");
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

function nowcastFixture(ref = "2026-08-15T10:35:00Z") {
  const data = {};
  const refMs = Date.parse(ref);
  for (let i = 0; i <= 24; i++) data[new Date(refMs + i * 5 * 60000).toISOString().replace(/\.000Z$/, "Z")] = i < 3 ? "0.12" : "0";
  return [{
    name: "precipitation_nowcast",
    units: "mm/hr",
    point: { SRS: "EPSG:4326", coords: "5.093900,51.989000" },
    data: { [ref]: data }
  }];
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

test("actuele ADAGUC JSON wordt alleen als niet-negatieve mm/uur-intensiteit geaccepteerd", () => {
  const uit = normaliseerPuntAntwoord([{
    name: "precipitation_real_time",
    units: "mm/hr",
    point: { SRS: "EPSG:4326", coords: "5.093900,51.989000" },
    data: {
      "2026-08-15T10:30:00Z": "0.12",
      "2026-08-15T10:35:00Z": "0"
    }
  }]);
  assert.equal(uit.waarde, 0);
  assert.equal(uit.tijd, "2026-08-15T10:35:00Z");
  assert.equal(uit.units, "mm/hr");
  assert.equal(normaliseerPuntAntwoord([{ units: "mm", data: { "2026-08-15T10:35:00Z": "0.1" } }]), null);
  assert.equal(normaliseerPuntAntwoord([{ units: "mm/hr", data: { "2026-08-15T10:35:00Z": "-9999" } }]), null);
});

test("stale guard weigert oude providerdata", () => {
  assert.equal(isVers("2026-08-15T10:35:00Z", NU), true);
  assert.equal(isVers("2026-08-15T10:10:00Z", NU), false);
  assert.equal(isVers("2026-08-15T10:50:01Z", NU), false);
});

test("nowcast reference_time komt uit de officiële capabilities-dimensie", () => {
  const xml = '<Dimension name="reference_time" units="ISO8601" default="2026-08-15T10:35:00Z">2026-08-15T10:35:00Z</Dimension>';
  assert.equal(referenceTimeUitCapabilities(xml), "2026-08-15T10:35:00Z");
  const u = new URL(capabilitiesUrl("radar_forecast_2.0"));
  assert.equal(u.searchParams.get("REQUEST"), "GetCapabilities");
});

test("nowcast-puntvraag vraagt exact +0 tot +120 minuten op", () => {
  const u = new URL(nowcastPuntUrl(51.989, 5.0939, "2026-08-15T10:35:00Z"));
  assert.equal(u.searchParams.get("DATASET"), "radar_forecast_2.0");
  assert.equal(u.searchParams.get("QUERY_LAYERS"), "precipitation_nowcast");
  assert.equal(u.searchParams.get("DIM_reference_time"), "2026-08-15T10:35:00Z");
  assert.equal(u.searchParams.get("time"), "2026-08-15T10:35:00Z/2026-08-15T12:35:00Z");
});

test("nowcast JSON bewaart 25 geldige numerieke 5-minutenpunten", () => {
  const uit = normaliseerNowcastAntwoord(nowcastFixture(), "2026-08-15T10:35:00Z");
  assert(uit);
  assert.equal(uit.punten.length, 25);
  assert.equal(uit.punten[0].waarde, 0.12);
  assert.equal(uit.punten.at(-1).tijd, "2026-08-15T12:35:00Z");
  assert.equal(uit.horizonMinuten, 120);
});

test("haalActueelPunt accepteert een verse echte-vorm WMS-respons", async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify([{
      name: "precipitation_real_time",
      units: "mm/hr",
      point: { SRS: "EPSG:4326", coords: "5.093900,51.989000" },
      data: { "2026-08-15T10:35:00Z": "0.12" }
    }])
  });
  const uit = await haalActueelPunt(51.989, 5.0939, fakeFetch, NU);
  assert.equal(uit.waarde, 0.12);
  assert.equal(uit.bron, "KNMI RTCOR 5m");
});

test("haalNowcastPunt valideert capabilities en de volledige puntreeks", async () => {
  let stap = 0;
  const fakeFetch = async () => {
    stap++;
    if (stap === 1) return {
      ok: true,
      status: 200,
      text: async () => '<WMS_Capabilities><Layer><Name>precipitation_nowcast</Name><Dimension name="reference_time" default="2026-08-15T10:35:00Z">x</Dimension></Layer></WMS_Capabilities>'
    };
    return { ok: true, status: 200, text: async () => JSON.stringify(nowcastFixture()) };
  };
  const uit = await haalNowcastPunt(51.989, 5.0939, fakeFetch, NU);
  assert.equal(uit.punten.length, 25);
  assert.equal(uit.referenceTime, "2026-08-15T10:35:00Z");
  assert.equal(uit.bron, "KNMI radar-nowcast");
});

process.on("beforeExit", () => {
  if (!process.exitCode) console.log("\nKNMI-neerslag: " + n + " regressies geslaagd.");
});
