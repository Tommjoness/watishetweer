"use strict";

const assert = require("assert");
const {
  binnenKnmiDekking,
  actueelPuntUrl,
  capabilitiesUrl,
  nowcastPuntUrl,
  normaliseerWcsPunt,
  isVers,
  normaliseerPuntAntwoord,
  referenceTimeUitCapabilities,
  nowcastReeksCompleet,
  normaliseerNowcastAntwoord,
  NOWCAST_METADATA_CACHE_MAX_MS,
  metadataMaxAgeMs,
  haalNowcastMetadata,
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

function verwijderNowcastStap(payload, tijd) {
  const kopie = JSON.parse(JSON.stringify(payload));
  const ref = Object.keys(kopie[0].data)[0];
  delete kopie[0].data[ref][tijd];
  return kopie;
}

function netcdfPunt(waarde=0.12, variabele="precipitation_nowcast"){
  const delen=[];const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
  const naam=s=>{const raw=Buffer.from(s),pad=Buffer.alloc((4-raw.length%4)%4);return Buffer.concat([u32(raw.length),raw,pad]);};
  delen.push(Buffer.from([67,68,70,1]),u32(0),u32(0),u32(0),u32(0),u32(0),u32(11),u32(1));
  delen.push(naam(variabele),u32(0),u32(0),u32(0),u32(5),u32(4));
  const voor=Buffer.concat(delen),begin=voor.length+4,offset=u32(begin);
  const data=Buffer.alloc(4);data.writeFloatBE(waarde);
  return Buffer.concat([voor,offset,data]);
}
function netcdfResponse(waarde){
  const b=netcdfPunt(waarde);
  return {ok:true,status:200,headers:{get:()=>"application/netcdf"},arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};
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

test("nowcast-puntvraag gebruikt numerieke WCS voor exact één tijdstap", () => {
  const u = new URL(nowcastPuntUrl(51.989, 5.0939, "2026-08-15T10:35:00Z", "2026-08-15T10:40:00Z"));
  assert.equal(u.searchParams.get("DATASET"), "radar_forecast_2.0");
  assert.equal(u.searchParams.get("SERVICE"), "WCS");
  assert.equal(u.searchParams.get("REQUEST"), "GetCoverage");
  assert.equal(u.searchParams.get("COVERAGE"), "precipitation_nowcast");
  assert.equal(u.searchParams.get("DIM_forecast_reference_time"), "2026-08-15T10:35:00Z");
  assert.equal(u.searchParams.get("TIME"), "2026-08-15T10:40:00Z");
  assert.equal(u.searchParams.get("FORMAT"), "NetCDF3");
});

test("NetCDF3-puntwaarde wordt numeriek en met gevraagde tijd gelezen",()=>{
  const uit=normaliseerWcsPunt(netcdfPunt(0.37),"2026-08-15T10:40:00Z");
  assert(Math.abs(uit.waarde-0.37)<1e-6);
  assert.equal(uit.tijd,"2026-08-15T10:40:00Z");
});

test("actuele KNMI WCS-variabele forecast wordt als nowcast-neerslag gelezen",()=>{
  const uit=normaliseerWcsPunt(netcdfPunt(0.42,"forecast"),"2026-08-15T10:45:00Z");
  assert(Math.abs(uit.waarde-0.42)<1e-6);
  assert.equal(uit.tijd,"2026-08-15T10:45:00Z");
});

test("nowcast JSON bewaart exact 25 aaneengesloten geldige 5-minutenpunten", () => {
  const uit = normaliseerNowcastAntwoord(nowcastFixture(), "2026-08-15T10:35:00Z");
  assert(uit);
  assert.equal(uit.punten.length, 25);
  assert.equal(uit.punten[0].waarde, 0.12);
  assert.equal(uit.punten.at(-1).tijd, "2026-08-15T12:35:00Z");
  assert.equal(uit.horizonMinuten, 120);
  assert.equal(nowcastReeksCompleet(uit.punten, "2026-08-15T10:35:00Z"), true);
});

test("nowcast met één ontbrekende interne 5-minutenstap wordt volledig geweigerd", () => {
  const payload = verwijderNowcastStap(nowcastFixture(), "2026-08-15T10:50:00Z");
  assert.equal(normaliseerNowcastAntwoord(payload, "2026-08-15T10:35:00Z"), null);
});

test("nowcast met dezelfde horizon maar verschoven eerste stap wordt geweigerd", () => {
  const payload = nowcastFixture();
  const ref = "2026-08-15T10:35:00Z";
  delete payload[0].data[ref][ref];
  payload[0].data[ref]["2026-08-15T12:40:00Z"] = "0";
  assert.equal(normaliseerNowcastAntwoord(payload, ref), null);
});

test("KNMI metadata-cache volgt provider max-age met harde bovengrens", () => {
  assert.equal(NOWCAST_METADATA_CACHE_MAX_MS, 10000);
  assert.equal(metadataMaxAgeMs({get:()=>"public, max-age=10"}), 10000);
  assert.equal(metadataMaxAgeMs({get:()=>"max-age=30"}), 10000);
  assert.equal(metadataMaxAgeMs({get:()=>"no-cache"}), 0);
});

test("KNMI capabilities worden binnen provider-TTL hergebruikt en daarna vernieuwd", async () => {
  let calls=0;
  const fakeFetch=async()=>{calls++;return {
    ok:true,status:200,headers:{get:n=>String(n).toLowerCase()==="cache-control"?"max-age=10":null},
    text:async()=>'<WMS_Capabilities><Layer><Name>precipitation_nowcast</Name><Dimension name="reference_time" default="2026-08-15T10:35:00Z">x</Dimension></Layer></WMS_Capabilities>'
  };};
  await haalNowcastMetadata(fakeFetch,NU,1000);
  await haalNowcastMetadata(fakeFetch,NU,10999);
  assert.equal(calls,1);
  await haalNowcastMetadata(fakeFetch,NU,11000);
  assert.equal(calls,2);
});

test("gelijktijdige KNMI capabilities-requests delen één in-flight request", async () => {
  let calls=0;
  const fakeFetch=async()=>{
    calls++;
    await new Promise(resolve=>setTimeout(resolve,10));
    return {ok:true,status:200,headers:{get:()=>"max-age=10"},text:async()=>'<WMS_Capabilities><Layer><Name>precipitation_nowcast</Name><Dimension name="reference_time" default="2026-08-15T10:35:00Z">x</Dimension></Layer></WMS_Capabilities>'};
  };
  const waarden=await Promise.all([
    haalNowcastMetadata(fakeFetch,NU,2000),
    haalNowcastMetadata(fakeFetch,NU,2000),
    haalNowcastMetadata(fakeFetch,NU,2000)
  ]);
  assert.equal(calls,1);
  assert(waarden.every(x=>x.referenceTime==="2026-08-15T10:35:00Z"));
});

test("mislukte of niet-cachebare capabilities worden niet als metadata-cachehit bewaard", async () => {
  let calls=0;
  const fakeFetch=async()=>{
    calls++;
    if(calls===1)return {ok:false,status:503,headers:{get:()=>"max-age=10"},text:async()=>"tijdelijk stuk"};
    return {ok:true,status:200,headers:{get:()=>null},text:async()=>'<WMS_Capabilities><Layer><Name>precipitation_nowcast</Name><Dimension name="reference_time" default="2026-08-15T10:35:00Z">x</Dimension></Layer></WMS_Capabilities>'};
  };
  await assert.rejects(()=>haalNowcastMetadata(fakeFetch,NU,3000),/status 503/);
  await haalNowcastMetadata(fakeFetch,NU,3001);
  await haalNowcastMetadata(fakeFetch,NU,3002);
  assert.equal(calls,3);
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
  const fakeFetch = async url => {
    stap++;
    if (stap === 1) return {
      ok: true,
      status: 200,
      text: async () => '<WMS_Capabilities><Layer><Name>precipitation_nowcast</Name><Dimension name="forecast_reference_time" default="2026-08-15T10:35:00Z">x</Dimension></Layer></WMS_Capabilities>'
    };
    assert.equal(new URL(url).searchParams.get("SERVICE"),"WCS");
    return netcdfResponse(stap/100);
  };
  const uit = await haalNowcastPunt(51.989, 5.0939, fakeFetch, NU);
  assert.equal(uit.punten.length, 25);
  assert.equal(uit.referenceTime, "2026-08-15T10:35:00Z");
  assert.equal(uit.bron, "KNMI radar-nowcast");
});

test("haalNowcastPunt faalt gesloten zodra één WCS-tijdstap ontbreekt", async () => {
  let stap = 0;
  const fakeFetch = async () => {
    stap++;
    if (stap === 1) return {
      ok: true,
      status: 200,
      text: async () => '<WMS_Capabilities><Layer><Name>precipitation_nowcast</Name><Dimension name="reference_time" default="2026-08-15T10:35:00Z">x</Dimension></Layer></WMS_Capabilities>'
    };
    if(stap===5)return {ok:false,status:503,headers:{get:()=>"text/plain"},arrayBuffer:async()=>new ArrayBuffer(0)};
    return netcdfResponse(0);
  };
  await assert.rejects(
    () => haalNowcastPunt(51.989, 5.0939, fakeFetch, NU),
    /KNMI WCS status 503/
  );
});

process.on("beforeExit", () => {
  if (!process.exitCode) console.log("\nKNMI-neerslag: " + n + " regressies geslaagd.");
});
