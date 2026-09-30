"use strict";

const assert = require("assert");
const {
  kiesProvider,
  canoniekNeerslagPunt,
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

test("KNMI-verzoeken gaan naar het midden van het radarvak van de locatie", async () => {
  const knmi = require("../lib/knmi-neerslag.cjs")._intern;
  const vak = knmi.radarVak(52.3702, 4.8952);
  const hoek = knmi.radarLatLon(vak.kolom + 0.03, -3650 - (vak.rij + 0.97));
  assert.deepEqual(knmi.radarVak(hoek.lat, hoek.lon), vak, "punt in de hoek van het vak valt in hetzelfde vak");
  assert.deepEqual(knmi.radarVak(vak.lat, vak.lon), vak, "het vakmidden is stabiel (idempotent)");
  assert.equal(knmi.radarVak(40.7, -74), null, "buiten het KNMI-raster geen vak");
  assert.deepEqual(canoniekNeerslagPunt({ lat: hoek.lat, lon: hoek.lon, land: "NL" }), { lat: vak.lat, lon: vak.lon });
  assert.deepEqual(canoniekNeerslagPunt({ lat: 50.1109, lon: 8.6821, land: "DE" }), { lat: 50.1109, lon: 8.6821 });
  const requests = [];
  await haalNeerslagVoorLocatie({
    lat: hoek.lat, lon: hoek.lon, land: "NL",
    fetchImpl: async url => { requests.push(new URL(String(url))); return fakeKnmiFetch(url); },
    nuMs: NU
  });
  const punt = requests.find(u => u.searchParams.get("REQUEST") === "GetPointValue");
  assert.equal(punt.searchParams.get("X"), vak.lon.toFixed(5));
  assert.equal(punt.searchParams.get("Y"), vak.lat.toFixed(5));
  for (const u of requests.filter(u => u.searchParams.get("REQUEST") === "GetCoverage")) {
    const [x1, y1, x2, y2] = u.searchParams.get("BBOX").split(",").map(Number);
    assert(Math.abs((x1 + x2) / 2 - vak.lon) < 1e-5 && Math.abs((y1 + y2) / 2 - vak.lat) < 1e-5, "WCS-bbox rond het vakmidden");
  }
});

test("een trage nowcast vervalt na de deadline; de actuele KNMI-waarde gaat wel mee", async () => {
  const { haalKnmi } = require("../lib/neerslag-provider-registry.cjs")._intern;
  let coverageNaDeadline = 0, deadlineVoorbij = false;
  const start = Date.now();
  const uit = await haalKnmi({
    lat: 52.09, lon: 5.12, nuMs: NU, nowcastDeadlineMs: 150,
    fetchImpl: async url => {
      if (String(url).includes("REQUEST=GetCoverage")) {
        if (deadlineVoorbij) coverageNaDeadline++;
        await new Promise(r => setTimeout(r, 60));
      }
      return fakeKnmiFetch(url);
    }
  });
  deadlineVoorbij = true;
  const duur = Date.now() - start;
  assert.equal(uit.beschikbaar, true);
  assert.equal(uit.actueel.waarde, 0.18);
  assert.equal(uit.nowcast, null, "een onvolledige reeks wordt nooit gepubliceerd");
  assert.equal(uit.capabilities.nowcast, false);
  assert(duur < 400, "antwoord komt kort na de deadline, niet pas na alle WCS-stappen: " + duur + " ms");
  await new Promise(r => setTimeout(r, 200));
  assert(coverageNaDeadline <= 5, "na de deadline starten geen nieuwe WCS-stappen meer (hooguit de lopende): " + coverageNaDeadline);
});

test("zonder nowcast blijft de neerslagresponse maar kort in de edge-cache", async () => {
  const registry = require("../lib/neerslag-provider-registry.cjs");
  const origineel = registry.haalNeerslagVoorLocatie;
  const headers = {};
  const res = { setHeader(k, v) { headers[k] = v; }, status() { return res; }, json() { return res; } };
  try {
    registry.haalNeerslagVoorLocatie = async () => ({ beschikbaar: true, provider: "knmi", actueel: { waarde: 0 }, nowcast: null });
    delete require.cache[require.resolve("../lib/neerslag.cjs")];
    await require("../lib/neerslag.cjs")({ query: { lat: "52.1", lon: "5.1" } }, res);
    assert.equal(headers["Cache-Control"], "s-maxage=15, stale-while-revalidate=15");
    registry.haalNeerslagVoorLocatie = async () => ({ beschikbaar: true, provider: "knmi", actueel: { waarde: 0 }, nowcast: { punten: [] } });
    delete require.cache[require.resolve("../lib/neerslag.cjs")];
    await require("../lib/neerslag.cjs")({ query: { lat: "52.1", lon: "5.1" } }, res);
    assert.equal(headers["Cache-Control"], "s-maxage=120, stale-while-revalidate=180");
  } finally {
    registry.haalNeerslagVoorLocatie = origineel;
    delete require.cache[require.resolve("../lib/neerslag.cjs")];
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
