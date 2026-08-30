import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const knmi = require("../lib/knmi-neerslag.cjs")._intern;

const LAT = 52.37020;
const LON = 4.89520;
const ACCEPT_JSON = "application/json";
const USER_AGENT = "watishetweer.nl/knmi-timeseries-probe";

const slaap = ms => new Promise(resolve => setTimeout(resolve, ms));

async function haal(url, { accept = "*/*", buffer = false, pogingen = 4 } = {}) {
  let laatste;
  for (let poging = 1; poging <= pogingen; poging += 1) {
    const gestart = Date.now();
    const response = await fetch(url, {
      headers: { Accept: accept, "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10000)
    });
    const duur = Date.now() - gestart;
    console.log(`HTTP ${response.status} in ${duur} ms: ${new URL(url).searchParams.get("REQUEST") || "request"}`);
    if (response.ok) {
      return buffer ? Buffer.from(await response.arrayBuffer()) : await response.text();
    }
    laatste = new Error(`HTTP ${response.status}`);
    if (response.status !== 429 && response.status < 500) break;
    const retryAfter = Number(response.headers.get("retry-after"));
    await slaap(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1200 * poging);
  }
  throw laatste || new Error("KNMI-request mislukt");
}

function pointTimeseriesUrl(referenceTime) {
  const u = new URL(knmi.KNMI_WMS_BASIS);
  u.searchParams.set("DATASET", knmi.NOWCAST_DATASET);
  u.searchParams.set("SERVICE", "WMS");
  u.searchParams.set("REQUEST", "GetPointValue");
  u.searchParams.set("VERSION", "1.1.1");
  u.searchParams.set("SRS", "EPSG:4326");
  u.searchParams.set("QUERY_LAYERS", knmi.NOWCAST_LAAG);
  u.searchParams.set("X", LON.toFixed(5));
  u.searchParams.set("Y", LAT.toFixed(5));
  u.searchParams.set("INFO_FORMAT", ACCEPT_JSON);
  u.searchParams.set("TIME", "*");
  u.searchParams.set("DIM_forecast_reference_time", referenceTime);
  return u.toString();
}

function mercator(lon, lat) {
  const x = lon * 20037508.34 / 180;
  const begrensd = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const y = Math.log(Math.tan((90 + begrensd) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180;
  return { x, y };
}

function featureInfoTimeseriesUrl(referenceTime) {
  const { x, y } = mercator(LON, LAT);
  const marge = 1000;
  const u = new URL(knmi.KNMI_WMS_BASIS);
  u.searchParams.set("DATASET", knmi.NOWCAST_DATASET);
  u.searchParams.set("SERVICE", "WMS");
  u.searchParams.set("REQUEST", "GetFeatureInfo");
  u.searchParams.set("VERSION", "1.3.0");
  u.searchParams.set("LAYERS", knmi.NOWCAST_LAAG);
  u.searchParams.set("QUERY_LAYERS", knmi.NOWCAST_LAAG);
  u.searchParams.set("CRS", "EPSG:3857");
  u.searchParams.set("BBOX", [x - marge, y - marge, x + marge, y + marge].join(","));
  u.searchParams.set("WIDTH", "3");
  u.searchParams.set("HEIGHT", "3");
  u.searchParams.set("I", "1");
  u.searchParams.set("J", "1");
  u.searchParams.set("FORMAT", "image/png");
  u.searchParams.set("INFO_FORMAT", ACCEPT_JSON);
  u.searchParams.set("TIME", "*");
  u.searchParams.set("DIM_forecast_reference_time", referenceTime);
  return u.toString();
}

function vorm(payload) {
  if (Array.isArray(payload)) {
    return payload.slice(0, 2).map(item => ({
      keys: item && typeof item === "object" ? Object.keys(item) : [],
      units: item?.units,
      dataKeys: item?.data && typeof item.data === "object" ? Object.keys(item.data).slice(0, 4) : []
    }));
  }
  return payload && typeof payload === "object" ? { keys: Object.keys(payload).slice(0, 20) } : typeof payload;
}

function vergelijk(baseline, kandidaat) {
  if (!kandidaat || !Array.isArray(kandidaat.punten)) return { gelijkwaardig: false, reden: "niet te normaliseren" };
  if (baseline.length !== kandidaat.punten.length) return { gelijkwaardig: false, reden: `lengte ${kandidaat.punten.length} i.p.v. ${baseline.length}` };
  let maxVerschil = 0;
  for (let i = 0; i < baseline.length; i += 1) {
    if (baseline[i].tijd !== kandidaat.punten[i].tijd) {
      return { gelijkwaardig: false, reden: `timestamp wijkt af op index ${i}` };
    }
    maxVerschil = Math.max(maxVerschil, Math.abs(baseline[i].waarde - kandidaat.punten[i].waarde));
  }
  return { gelijkwaardig: maxVerschil <= 0.01, maxVerschil };
}

async function kandidaat(label, url, referenceTime, baseline) {
  try {
    const tekst = await haal(url, { accept: ACCEPT_JSON });
    let payload;
    try { payload = JSON.parse(tekst); }
    catch {
      console.log(`${label}: geen JSON; begin response=${JSON.stringify(tekst.slice(0, 500))}`);
      return { label, gelijkwaardig: false, reden: "geen JSON" };
    }
    console.log(`${label} responsevorm:`, JSON.stringify(vorm(payload)));
    const genormaliseerd = knmi.normaliseerNowcastAntwoord(payload, referenceTime);
    const resultaat = vergelijk(baseline, genormaliseerd);
    console.log(`${label}:`, JSON.stringify(resultaat));
    return { label, ...resultaat };
  } catch (error) {
    const resultaat = { label, gelijkwaardig: false, reden: String(error?.message || error) };
    console.log(`${label}:`, JSON.stringify(resultaat));
    return resultaat;
  }
}

console.log("KNMI one-call timeseries probe", { lat: LAT, lon: LON });
const capabilities = await haal(knmi.capabilitiesUrl(knmi.NOWCAST_DATASET), { accept: "text/xml" });
if (!capabilities.includes(`<Name>${knmi.NOWCAST_LAAG}</Name>`)) throw new Error("nowcastlaag ontbreekt uit capabilities");
const referenceTime = knmi.referenceTimeUitCapabilities(capabilities);
if (!referenceTime) throw new Error("reference_time ontbreekt uit capabilities");
console.log("referenceTime", referenceTime);

const refMs = Date.parse(referenceTime);
const baseline = [];
for (let i = 0; i < knmi.NOWCAST_PUNTEN; i += 1) {
  const tijd = new Date(refMs + i * knmi.NOWCAST_STAP_MS).toISOString().replace(/\.000Z$/, "Z");
  const buffer = await haal(knmi.nowcastPuntUrl(LAT, LON, referenceTime, tijd), { accept: "application/netcdf", buffer: true });
  baseline.push(knmi.normaliseerWcsPunt(buffer, tijd));
  if (i < knmi.NOWCAST_PUNTEN - 1) await slaap(1050);
}
if (!knmi.nowcastReeksCompleet(baseline, referenceTime)) throw new Error("WCS-baseline is niet volledig");
console.log(`WCS-baseline: ${baseline.length} punten, ${baseline[0].tijd} .. ${baseline.at(-1).tijd}`);

await slaap(1100);
const point = await kandidaat("GetPointValue TIME=*", pointTimeseriesUrl(referenceTime), referenceTime, baseline);
await slaap(1100);
const gfi = await kandidaat("GetFeatureInfo TIME=*", featureInfoTimeseriesUrl(referenceTime), referenceTime, baseline);

const bruikbaar = [point, gfi].filter(x => x.gelijkwaardig);
console.log("PROBE_RESULT", JSON.stringify({ referenceTime, point, gfi, bruikbaar: bruikbaar.map(x => x.label) }));
if (!bruikbaar.length) process.exitCode = 2;
