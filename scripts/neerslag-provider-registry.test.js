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

function fakeActueelFetch(url) {
  const u = new URL(url);
  const dataset = u.searchParams.get("DATASET");
  const request = u.searchParams.get("REQUEST");

  assert.equal(dataset, "nl_rdr_data_rtcor_5m", "alleen RTCOR mag live worden bevraagd");
  assert.equal(request, "GetPointValue", "RTCOR gebruikt de bewezen actuele puntquery");
  assert.notEqual(dataset, "radar_forecast_2.0", "de onbetrouwbare WMS-nowcast mag niet worden bevraagd");

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

test("Nederland en België selecteren KNMI binnen de gepubliceerde dekking", () => {
  assert.equal(kiesProvider({ lat: 51.989, lon: 5.0939, land: "NL" }).id, "knmi");
  assert.equal(kiesProvider({ lat: 50.8503, lon: 4.3517, land: "BE" }).id, "knmi");
  assert.equal(kiesProvider({ lat: 51.989, lon: 5.0939, land: "DE" }), null);
  assert.equal(kiesProvider({ lat: 40.7128, lon: -74.006, land: "US" }), null);
});

test("bestaande Nederlandse client zonder landcode blijft compatibel", () => {
  assert.equal(kiesProvider({ lat: 51.989, lon: 5.0939 }).id, "knmi");
});

test("capability-register claimt alleen de bewezen actuele KNMI-capability", () => {
  const verwacht = [{
    id: "knmi",
    capabilities: { actueel: true, nowcast: false, nowcastMinuten: 0 }
  }];
  assert.deepEqual(providerCapabilitiesVoorLand("NL"), verwacht);
  assert.deepEqual(providerCapabilitiesVoorLand("BE"), verwacht);
  assert.deepEqual(providerCapabilitiesVoorLand("DE"), []);
});

test("generieke providerlaag levert RTCOR voor Nederland en België zonder forecast-WMS-request", async () => {
  for (const locatie of [
    { lat: 51.989, lon: 5.0939, land: "NL" },
    { lat: 50.8503, lon: 4.3517, land: "BE" }
  ]) {
    let requests = 0;
    const uit = await haalNeerslagVoorLocatie({
      ...locatie,
      fetchImpl: async url => { requests++; return fakeActueelFetch(url); },
      nuMs: NU
    });
    assert.equal(requests, 1, "één KNMI-request per providerload");
    assert.equal(uit.beschikbaar, true);
    assert.equal(uit.provider, "knmi");
    assert.equal(uit.bron, "KNMI");
    assert.equal(uit.actueel.waarde, 0.18);
    assert.equal(uit.nowcast, null);
    assert.equal(uit.capabilities.actueel, true);
    assert.equal(uit.capabilities.nowcast, false);
    assert.equal(uit.capabilities.nowcastMinuten, 0);
    assert.match(uit.degradaties.nowcast, /uitgeschakeld/i);
  }
});

test("RTCOR-uitval faalt zacht zonder alsnog de onbetrouwbare nowcast te proberen", async () => {
  let requests = 0;
  const uit = await haalNeerslagVoorLocatie({
    lat: 51.989,
    lon: 5.0939,
    land: "NL",
    nuMs: NU,
    fetchImpl: async url => {
      requests++;
      const u = new URL(url);
      assert.equal(u.searchParams.get("DATASET"), "nl_rdr_data_rtcor_5m");
      throw new Error("KNMI WMS status 429");
    }
  });
  assert.equal(requests, 1);
  assert.equal(uit.beschikbaar, false);
  assert.equal(uit.provider, "knmi");
  assert.match(uit.reden, /429/);
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