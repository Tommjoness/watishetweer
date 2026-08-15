"use strict";

const BASIS = "https://anonymous.api.dataplatform.knmi.nl/wms/adaguc-server";
const DATASET = "radar_forecast_2.0";
const LAAG = "precipitation_nowcast";

function basisUrl(request) {
  const u = new URL(BASIS);
  u.searchParams.set("DATASET", DATASET);
  u.searchParams.set("SERVICE", "WMS");
  u.searchParams.set("REQUEST", request);
  u.searchParams.set("VERSION", request === "GetCapabilities" ? "1.3.0" : "1.1.1");
  return u;
}

function referenceTimeUitCapabilities(xml) {
  const tags = [...String(xml || "").matchAll(/<(?:Dimension|Extent)\b([^>]*)>/gi)];
  for (const m of tags) {
    const attrs = m[1] || "";
    if (!/\bname=["']reference_time["']/i.test(attrs)) continue;
    const d = /\bdefault=["']([^"']+)["']/i.exec(attrs);
    if (d && Number.isFinite(Date.parse(d[1]))) return d[1];
  }
  return null;
}

function isoZonderMillis(ms) {
  return new Date(ms).toISOString().replace(/\.000Z$/, "Z");
}

async function getTekst(u, accept) {
  const r = await fetch(u, { headers: { Accept: accept, "User-Agent": "watishetweer.nl-audit/1.0" } });
  const tekst = await r.text();
  if (!r.ok) throw new Error(`${u.searchParams.get("REQUEST") || u.hostname} gaf ${r.status}: ${tekst.slice(0, 300)}`);
  return tekst;
}

async function knmiPunt(lat, lon, referenceTime) {
  const u = basisUrl("GetPointValue");
  u.searchParams.set("SRS", "EPSG:4326");
  u.searchParams.set("QUERY_LAYERS", LAAG);
  u.searchParams.set("X", Number(lon).toFixed(5));
  u.searchParams.set("Y", Number(lat).toFixed(5));
  u.searchParams.set("INFO_FORMAT", "application/json");
  const refMs = Date.parse(referenceTime);
  u.searchParams.set("time", referenceTime + "/" + isoZonderMillis(refMs + 120 * 60000));
  u.searchParams.set("DIM_reference_time", referenceTime);
  const payload = JSON.parse(await getTekst(u, "application/json"));
  const item = payload && payload[0];
  const reeks = item && item.data && (item.data[referenceTime] || Object.values(item.data)[0]);
  const punten = Object.entries(reeks || {}).map(([tijd, waarde]) => ({ tijd, waarde: Number(waarde) }));
  return {
    point: item && item.point,
    units: item && item.units,
    waarden: punten.filter(p => Number.isFinite(p.waarde) && p.waarde !== 0),
    min: punten.length ? Math.min(...punten.map(p => p.waarde)) : null,
    max: punten.length ? Math.max(...punten.map(p => p.waarde)) : null
  };
}

async function openMeteo15m(lat, lon, model) {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(lat));
  u.searchParams.set("longitude", String(lon));
  u.searchParams.set("minutely_15", "precipitation,rain,showers");
  u.searchParams.set("forecast_minutely_15", "12");
  u.searchParams.set("timezone", "UTC");
  if (model) u.searchParams.set("models", model);
  const r = await fetch(u, { headers: { Accept: "application/json", "User-Agent": "watishetweer.nl-audit/1.0" } });
  const tekst = await r.text();
  let payload;
  try { payload = JSON.parse(tekst); } catch { payload = { raw: tekst.slice(0, 500) }; }
  if (!r.ok) return { status: r.status, model: model || "best_match", fout: payload };
  const m = payload.minutely_15 || {};
  return {
    status: r.status,
    model: model || "best_match",
    timezone: payload.timezone,
    interval: payload.minutely_15_units && payload.minutely_15_units.interval,
    units: payload.minutely_15_units,
    punten: (m.time || []).map((tijd, i) => ({
      tijd,
      precipitation: m.precipitation && m.precipitation[i],
      rain: m.rain && m.rain[i],
      showers: m.showers && m.showers[i]
    }))
  };
}

(async () => {
  const cap = basisUrl("GetCapabilities");
  const xml = await getTekst(cap, "text/xml");
  const referenceTime = referenceTimeUitCapabilities(xml);
  if (!referenceTime) throw new Error("reference_time ontbreekt");

  const meta = basisUrl("GetMetaData");
  meta.searchParams.set("LAYER", LAAG);
  meta.searchParams.set("FORMAT", "text/plain");
  const metadata = await getTekst(meta, "text/plain,text/html");
  const regels = metadata.split(/\r?\n/);
  const relevanteRegels = regels.filter(regel =>
    /calibration|formula|out_of_image|fill|missing|image_data|forecast|precip|units|scale|offset/i.test(regel)
  );
  console.log("METADATA", JSON.stringify({ referenceTime, relevanteRegels: relevanteRegels.slice(0, 80) }, null, 2));

  for (const [naam, lat, lon] of [
    ["Amsterdam", 52.3676, 4.9041],
    ["Utrecht", 52.0907, 5.1214],
    ["Dronten", 52.5250, 5.7180],
    ["Maastricht", 50.8514, 5.6910],
    ["Brussel", 50.8503, 4.3517]
  ]) {
    const uit = await knmiPunt(lat, lon, referenceTime);
    console.log("KNMI_PUNT", JSON.stringify({ naam, lat, lon, referenceTime, ...uit }));
    await new Promise(resolve => setTimeout(resolve, 1100));
  }

  for (const [naam, lat, lon] of [
    ["Amsterdam", 52.3676, 4.9041],
    ["Dronten", 52.5250, 5.7180],
    ["Utrecht", 52.0907, 5.1214]
  ]) {
    console.log("OPENMETEO_BEST", JSON.stringify({ naam, ...(await openMeteo15m(lat, lon, null)) }));
    console.log("OPENMETEO_ICON_D2", JSON.stringify({ naam, ...(await openMeteo15m(lat, lon, "icon_d2")) }));
  }
})().catch(err => {
  console.error("Live-diagnose kon niet worden uitgevoerd:", err && err.stack || err);
  process.exitCode = 1;
});
