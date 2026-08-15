"use strict";

const assert = require("assert");
const knmi = require("../lib/knmi-neerslag.cjs")._intern;

const NOWCAST_DATASET = "radar_forecast_2.0";
const NOWCAST_LAAG = "precipitation_nowcast";
const wacht = ms => new Promise(r => setTimeout(r, ms));
const iso = ms => new Date(ms).toISOString().replace(/\.000Z$/, "Z");

async function capabilities(dataset) {
  const u = new URL(knmi.KNMI_WMS_BASIS);
  u.searchParams.set("DATASET", dataset);
  u.searchParams.set("SERVICE", "WMS");
  u.searchParams.set("VERSION", "1.3.0");
  u.searchParams.set("REQUEST", "GetCapabilities");
  const r = await fetch(u, {
    headers: { "Accept": "text/xml", "User-Agent": "watishetweer.nl-live-probe/1.0" },
    signal: AbortSignal.timeout(8000)
  });
  const xml = await r.text();
  assert.equal(r.ok, true, dataset + " GetCapabilities status " + r.status);
  return xml;
}

function referenceTime(xml) {
  const tags = [...String(xml).matchAll(/<(?:Dimension|Extent)\b([^>]*)>/gi)];
  for (const m of tags) {
    const attrs = m[1] || "";
    if (!/\bname=["']reference_time["']/i.test(attrs)) continue;
    const d = /\bdefault=["']([^"']+)["']/i.exec(attrs);
    if (d && Number.isFinite(Date.parse(d[1]))) return d[1];
  }
  return null;
}

async function nowcastPunt(lat, lon, ref) {
  const refMs = Date.parse(ref);
  const u = new URL(knmi.KNMI_WMS_BASIS);
  u.searchParams.set("DATASET", NOWCAST_DATASET);
  u.searchParams.set("SERVICE", "WMS");
  u.searchParams.set("REQUEST", "GetPointValue");
  u.searchParams.set("VERSION", "1.1.1");
  u.searchParams.set("SRS", "EPSG:4326");
  u.searchParams.set("QUERY_LAYERS", NOWCAST_LAAG);
  u.searchParams.set("X", Number(lon).toFixed(5));
  u.searchParams.set("Y", Number(lat).toFixed(5));
  u.searchParams.set("INFO_FORMAT", "application/json");
  u.searchParams.set("time", ref + "/" + iso(refMs + 120 * 60000));
  u.searchParams.set("DIM_reference_time", ref);
  const r = await fetch(u, {
    headers: { "Accept": "application/json", "User-Agent": "watishetweer.nl-live-probe/1.0" },
    signal: AbortSignal.timeout(8000)
  });
  const tekst = await r.text();
  assert.equal(r.ok, true, "nowcast GetPointValue status " + r.status + ": " + tekst.slice(0, 160));
  let json;
  try { json = JSON.parse(tekst); }
  catch { throw new Error("nowcast gaf geen JSON: " + tekst.slice(0, 160)); }
  const item = Array.isArray(json) ? json[0] : null;
  assert(item && String(item.units || "").toLowerCase() === "mm/hr", "nowcast eenheid is niet mm/hr");
  const reeks = item.data && item.data[ref];
  assert(reeks && typeof reeks === "object", "nowcast reference_time-reeks ontbreekt");
  const punten = Object.entries(reeks)
    .map(([tijd, waarde]) => ({ tijd, waarde: Number(waarde) }))
    .filter(p => Number.isFinite(Date.parse(p.tijd)))
    .sort((a, b) => Date.parse(a.tijd) - Date.parse(b.tijd));
  assert(punten.length >= 19, "nowcast bevat minder dan 90 minuten aan 5-minutenstappen");
  const horizon = (Date.parse(punten[punten.length - 1].tijd) - refMs) / 60000;
  assert(horizon >= 90, "nowcast horizon te kort: " + horizon + " minuten");
  return { units: item.units, naam: item.name || item.standard_name || null, punten, horizon };
}

async function main() {
  const xmlActueel = await capabilities(knmi.ACTUEEL_DATASET);
  assert(xmlActueel.includes("<Name>" + knmi.ACTUEEL_LAAG + "</Name>"), "actuele laag niet gevonden: " + knmi.ACTUEEL_LAAG);
  console.log("KNMI actueel: dataset en laag gevonden.");

  await wacht(1200);
  const punt = await knmi.haalActueelPunt(51.989, 5.0939);
  assert(Number.isFinite(punt.waarde), "geen numerieke actuele puntwaarde");
  console.log("KNMI Vianen actueel:", JSON.stringify({
    waarde: punt.waarde,
    tijd: punt.tijd,
    units: punt.units,
    naam: punt.naam,
    punt: punt.punt
  }));

  await wacht(1200);
  const xmlNowcast = await capabilities(NOWCAST_DATASET);
  assert(xmlNowcast.includes("<Name>" + NOWCAST_LAAG + "</Name>"), "nowcastlaag niet gevonden: " + NOWCAST_LAAG);
  const ref = referenceTime(xmlNowcast);
  assert(ref, "nowcast reference_time ontbreekt");
  console.log("KNMI nowcast: dataset, laag en reference_time gevonden:", ref);

  await wacht(1200);
  const nowcast = await nowcastPunt(51.989, 5.0939, ref);
  console.log("KNMI Vianen nowcast:", JSON.stringify({
    units: nowcast.units,
    naam: nowcast.naam,
    aantalPunten: nowcast.punten.length,
    eerste: nowcast.punten[0],
    laatste: nowcast.punten[nowcast.punten.length - 1],
    horizonMinuten: nowcast.horizon
  }));
}

main().catch(e => {
  console.error("KNMI live probe mislukt:", e && e.stack || e);
  process.exit(1);
});
