"use strict";

const assert = require("assert");
const {
  kiesProvider,
  haalNeerslagVoorLocatie,
  providerCapabilitiesVoorLand
} = require("../lib/neerslag-provider-registry.cjs");

const NU = Date.parse("2026-08-15T10:40:00Z");
const REF = "2026-08-15T10:35:00Z";
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

function nowcastFixture() {
  const reeks = {};
  const refMs = Date.parse(REF);
  for (let i = 0; i <= 24; i++) {
    const tijd = new Date(refMs + i * 5 * 60000).toISOString().replace(/\.000Z$/, "Z");
    reeks[tijd] = i < 3 ? "0.18" : "0";
  }
  return [{
    name: "precipitation_nowcast",
    units: "mm/hr",
    point: { SRS: "EPSG:4326", coords: "5.093900,51.989000" },
    data: { [REF]: reeks }
  }];
}

function fakeKnmiFetch(url) {
  const u = new URL(url);
  const dataset = u.searchParams.get("DATASET");
  const request = u.searchParams.get("REQUEST");

  if (dataset === "nl_rdr_data_rtcor_5m" && request === "GetPointValue") {
    return Promise.resolve({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{
        name: "precipitation_real_time",
        units: "mm/hr",
        point: { SRS: "EPSG:4326", coords: "5.093900,51.989000" },
        data: { [REF]: "0.18" }
      }])
    });
  }

  if (dataset === "radar_forecast_2.0" && request === "GetCapabilities") {
    return Promise.resolve({
      ok: true,
      status: 200,
      text: async () => '<WMS_Capabilities><Layer><Name>precipitation_nowcast</Name><Dimension name="reference_time" default="' + REF + '">x</Dimension></Layer></WMS_Capabilities>'
    });
  }

  if (dataset === "radar_forecast_2.0" && request === "GetPointValue") {
    return Promise.resolve({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(nowcastFixture())
    });
  }

  throw new Error("onverwachte providerrequest: " + url);
}

test("Nederland en België selecteren KNMI binnen de gepubliceerde dekking", () => {
  assert.equal(kiesProvider({ lat: 51.989, lon: 5.0939, land: "NL" }).id, "knmi");
  assert.equal(kiesProvider({ lat: 50.8503, lon: 4.3517, land: "BE" }).id, "knmi");
  assert.equal(kiesProvider({ lat: 51.989, lon: 5.0939, land: "DE" }), null);
  assert.equal(kiesProvider({ lat: 40.7128, lon: -74.006, land: "US" }), null);
});

test("bestaande Nederlandse client zonder landcode blijft compatibel", () => {
  assert.equal(kiesProvider({ lat: 51.989, lon: 5.0939 }).id, "knmi");
});

test("capability-register maakt ondersteuning per land expliciet", () => {
  const verwacht = [{
    id: "knmi",
    capabilities: { actueel: true, nowcast: true, nowcastMinuten: 120 }
  }];
  assert.deepEqual(providerCapabilitiesVoorLand("NL"), verwacht);
  assert.deepEqual(providerCapabilitiesVoorLand("BE"), verwacht);
  assert.deepEqual(providerCapabilitiesVoorLand("DE"), []);
});

test("generieke providerlaag levert hetzelfde contract voor Nederland en België", async () => {
  for (const locatie of [
    { lat: 51.989, lon: 5.0939, land: "NL" },
    { lat: 50.8503, lon: 4.3517, land: "BE" }
  ]) {
    const uit = await haalNeerslagVoorLocatie({
      ...locatie,
      fetchImpl: fakeKnmiFetch,
      nuMs: NU
    });
    assert.equal(uit.beschikbaar, true);
    assert.equal(uit.provider, "knmi");
    assert.equal(uit.bron, "KNMI");
    assert.equal(uit.actueel.waarde, 0.18);
    assert.equal(uit.nowcast.punten.length, 25);
    assert.equal(uit.capabilities.actueel, true);
    assert.equal(uit.capabilities.nowcast, true);
    assert.equal(uit.capabilities.nowcastMinuten, 120);
  }
});

test("onondersteunde landen doen geen externe providerrequest", async () => {
  let aangeroepen = false;
  const uit = await haalNeerslagVoorLocatie({
    lat: 50.1109,
    lon: 8.6821,
    land: "DE",
    fetchImpl: async () => { aangeroepen = true; throw new Error("mag niet"); },
    nuMs: NU
  });
  assert.equal(uit.beschikbaar, false);
  assert.equal(uit.provider, null);
  assert.equal(aangeroepen, false);
});

process.on("beforeExit", () => {
  if (!process.exitCode) console.log("\nNeerslag-providerregister: " + n + " regressies geslaagd.");
});
