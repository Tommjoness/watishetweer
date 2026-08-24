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

function netcdfResponse(waarde=0.12){
  const u32=x=>{const b=Buffer.alloc(4);b.writeUInt32BE(x);return b;},raw=Buffer.from("precipitation_nowcast");
  const naam=Buffer.concat([u32(raw.length),raw,Buffer.alloc((4-raw.length%4)%4)]);
  const voor=Buffer.concat([Buffer.from([67,68,70,1]),u32(0),u32(0),u32(0),u32(0),u32(0),u32(11),u32(1),naam,u32(0),u32(0),u32(0),u32(5),u32(4)]);
  const data=Buffer.alloc(4);data.writeFloatBE(waarde);const b=Buffer.concat([voor,u32(voor.length+4),data]);
  return {ok:true,status:200,headers:{get:()=>"application/netcdf"},arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};
}

function test(naam, fn) {
  Promise.resolve().then(fn).then(() => {
    n++;
    console.log("OK  " + naam);
  }).catch(e => {
    console.error("FOUT " + naam + "\n  " + e.stack);
    process.exitCode = 1;
  });
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
  if(dataset==="radar_forecast_2.0"&&request==="GetCapabilities")return Promise.resolve({ok:true,status:200,text:async()=>'<WMS_Capabilities><Layer><Name>precipitation_nowcast</Name><Dimension name="forecast_reference_time" default="2026-08-15T10:35:00Z">x</Dimension></Layer></WMS_Capabilities>'});
  if(dataset==="radar_forecast_2.0"&&request==="GetCoverage")return Promise.resolve(netcdfResponse(0.08));

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

test("capability-register publiceert de numerieke KNMI WCS-horizon", () => {
  const verwacht = [{
    id: "knmi",
    capabilities: { actueel: true, nowcast: true, nowcastMinuten: 120 }
  }];
  assert.deepEqual(providerCapabilitiesVoorLand("NL"), verwacht);
  assert.deepEqual(providerCapabilitiesVoorLand("BE"), verwacht);
  assert.deepEqual(providerCapabilitiesVoorLand("DE"), []);
});

test("generieke providerlaag levert RTCOR plus een volledige WCS-nowcast", async () => {
  for (const locatie of [
    { lat: 51.989, lon: 5.0939, land: "NL" },
    { lat: 50.8503, lon: 4.3517, land: "BE" }
  ]) {
    const requests = [];
    const uit = await haalNeerslagVoorLocatie({
      ...locatie,
      fetchImpl: async url => {
        requests.push(String(url));
        return fakeKnmiFetch(url);
      },
      nuMs: NU
    });
    assert.equal(uit.beschikbaar, true);
    assert.equal(uit.provider, "knmi");
    assert.equal(uit.bron, "KNMI");
    assert.equal(uit.actueel.waarde, 0.18);
    assert.equal(uit.nowcast.punten.length,25);
    assert.equal(uit.capabilities.actueel, true);
    assert.equal(uit.capabilities.nowcast, true);
    assert.equal(uit.capabilities.nowcastMinuten, 120);
    assert.equal(requests.length,27,requests.join("\n"));
    assert(requests.some(x=>x.includes("DATASET=nl_rdr_data_rtcor_5m")),requests.join("\n"));
    assert.equal(requests.filter(x=>x.includes("REQUEST=GetCoverage")).length,25,requests.join("\n"));
  }
});

test("een kapotte actuele KNMI-call blijft fail-closed, ook als de nowcast niet werkt", async () => {
  const requests = [];
  const uit = await haalNeerslagVoorLocatie({
    lat: 52.09,
    lon: 5.12,
    land: "NL",
    fetchImpl: async url => {
      requests.push(String(url));
      return { ok: false, status: 503, text: async () => "tijdelijk niet beschikbaar" };
    },
    nuMs: NU
  });
  assert.equal(uit.beschikbaar, false);
  assert.equal(uit.provider, "knmi");
  assert.equal(requests.length,2,requests.join("\n"));
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
