"use strict";

const KNMI_WMS_BASIS = "https://anonymous.api.dataplatform.knmi.nl/wms/adaguc-server";
const ACTUEEL_DATASET = "nl_rdr_data_rtcor_5m";
const ACTUEEL_LAAG = "precipitation_real_time";
const NOWCAST_DATASET = "radar_forecast_2.0";
const NOWCAST_LAAG = "precipitation_nowcast";
const MAX_OUDERDOM_MS = 10 * 60 * 1000;
const MAX_TOEKOMST_MS = 5 * 60 * 1000;
const NOWCAST_STAP_MS = 5 * 60 * 1000;
const NOWCAST_PUNTEN = 25;

function leesCoord(v) {
  if (v == null || String(v).trim() === "") return NaN;
  return Number(v);
}

function binnenKnmiDekking(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= 48.9 && lat <= 55.97 && lon >= 0 && lon <= 10.86;
}

function puntBasisUrl(dataset, laag, lat, lon) {
  const u = new URL(KNMI_WMS_BASIS);
  u.searchParams.set("DATASET", dataset);
  u.searchParams.set("SERVICE", "WMS");
  u.searchParams.set("REQUEST", "GetPointValue");
  u.searchParams.set("VERSION", "1.1.1");
  u.searchParams.set("SRS", "EPSG:4326");
  u.searchParams.set("QUERY_LAYERS", laag);
  u.searchParams.set("X", Number(lon).toFixed(5));
  u.searchParams.set("Y", Number(lat).toFixed(5));
  u.searchParams.set("INFO_FORMAT", "application/json");
  return u;
}

function actueelPuntUrl(lat, lon) {
  return puntBasisUrl(ACTUEEL_DATASET, ACTUEEL_LAAG, lat, lon).toString();
}

function capabilitiesUrl(dataset) {
  const u = new URL(KNMI_WMS_BASIS);
  u.searchParams.set("DATASET", dataset);
  u.searchParams.set("SERVICE", "WMS");
  u.searchParams.set("VERSION", "1.3.0");
  u.searchParams.set("REQUEST", "GetCapabilities");
  return u.toString();
}

function isoZonderMillis(ms) {
  return new Date(ms).toISOString().replace(/\.000Z$/, "Z");
}

function nowcastPuntUrl(lat, lon, referenceTime) {
  const refMs = Date.parse(referenceTime);
  if (!Number.isFinite(refMs)) throw new Error("ongeldige KNMI reference_time");
  const u = puntBasisUrl(NOWCAST_DATASET, NOWCAST_LAAG, lat, lon);
  u.searchParams.set("time", referenceTime + "/" + isoZonderMillis(refMs + 120 * 60000));
  u.searchParams.set("DIM_reference_time", referenceTime);
  return u.toString();
}

function intensiteitsEenheid(units) {
  return /^(?:mm\s*\/\s*(?:h|hr|hour)|mm\s*h\^-?1)$/i.test(String(units || "").trim());
}

function isVers(tijd, nuMs = Date.now()) {
  const ms = Date.parse(tijd);
  if (!Number.isFinite(ms)) return false;
  const leeftijd = nuMs - ms;
  return leeftijd >= -MAX_TOEKOMST_MS && leeftijd <= MAX_OUDERDOM_MS;
}

function normaliseerPuntAntwoord(payload) {
  if (!Array.isArray(payload) || !payload.length) return null;
  const item = payload.find(x => x && x.data && typeof x.data === "object") || payload[0];
  if (!item || !item.data || typeof item.data !== "object" || !intensiteitsEenheid(item.units)) return null;

  const vlak = [];
  function verzamel(obj, pad) {
    for (const [sleutel, waarde] of Object.entries(obj || {})) {
      const nieuwPad = pad.concat(sleutel);
      if (waarde && typeof waarde === "object" && !Array.isArray(waarde)) verzamel(waarde, nieuwPad);
      else {
        const n = Number(waarde);
        if (Number.isFinite(n) && n >= 0) vlak.push({ sleutel, pad: nieuwPad, waarde: n });
      }
    }
  }
  verzamel(item.data, []);
  if (!vlak.length) return null;

  const metTijd = vlak.filter(x => Number.isFinite(Date.parse(x.sleutel)));
  const laatste = (metTijd.length ? metTijd : vlak).sort((a, b) => {
    const ta = Date.parse(a.sleutel), tb = Date.parse(b.sleutel);
    if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
    return 0;
  }).at(-1);
  const tijd = Number.isFinite(Date.parse(laatste.sleutel)) ? laatste.sleutel : null;
  return {
    waarde: laatste.waarde,
    tijd,
    units: item.units || null,
    naam: item.name || item.standard_name || null,
    punt: item.point || null
  };
}

function referenceTimeUitCapabilities(xml) {
  const tekst = String(xml || "");
  const tags = [...tekst.matchAll(/<(?:Dimension|Extent)\b([^>]*)>/gi)];
  for (const m of tags) {
    const attrs = m[1] || "";
    if (!/\bname=["']reference_time["']/i.test(attrs)) continue;
    const d = /\bdefault=["']([^"']+)["']/i.exec(attrs);
    if (d && Number.isFinite(Date.parse(d[1]))) return d[1];
  }
  return null;
}

function nowcastReeksCompleet(punten, referenceTime) {
  const refMs = Date.parse(referenceTime);
  if (!Number.isFinite(refMs) || !Array.isArray(punten) || punten.length !== NOWCAST_PUNTEN) return false;
  return punten.every((punt, index) => Date.parse(punt && punt.tijd) === refMs + index * NOWCAST_STAP_MS);
}

function normaliseerNowcastAntwoord(payload, referenceTime) {
  if (!Array.isArray(payload) || !payload.length) return null;
  const item = payload.find(x => x && x.data && typeof x.data === "object") || payload[0];
  if (!item || !item.data || typeof item.data !== "object" || !intensiteitsEenheid(item.units)) return null;
  const reeks = item.data[referenceTime]
    || Object.values(item.data).find(v => v && typeof v === "object" && !Array.isArray(v));
  if (!reeks || typeof reeks !== "object") return null;

  const punten = Object.entries(reeks)
    .map(([tijd, waarde]) => ({ tijd, waarde: Number(waarde) }))
    .filter(p => Number.isFinite(Date.parse(p.tijd)) && Number.isFinite(p.waarde) && p.waarde >= 0)
    .sort((a, b) => Date.parse(a.tijd) - Date.parse(b.tijd));
  if (!nowcastReeksCompleet(punten, referenceTime)) return null;
  const refMs = Date.parse(referenceTime);
  const horizonMinuten = (Date.parse(punten.at(-1).tijd) - refMs) / 60000;
  if (horizonMinuten !== 120) return null;
  return {
    referenceTime,
    units: item.units || null,
    naam: item.name || item.standard_name || null,
    punt: item.point || null,
    punten,
    horizonMinuten
  };
}

async function fetchTekst(url, fetchImpl, timeoutMs, accept) {
  const r = await fetchImpl(url, {
    headers: { "Accept": accept, "User-Agent": "watishetweer.nl/1.0" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  const tekst = await r.text();
  if (!r.ok) throw new Error("KNMI WMS status " + r.status);
  return tekst;
}

async function haalActueelPunt(lat, lon, fetchImpl = fetch, nuMs = Date.now()) {
  const tekst = await fetchTekst(actueelPuntUrl(lat, lon), fetchImpl, 5500, "application/json");
  let payload;
  try { payload = JSON.parse(tekst); }
  catch { throw new Error("KNMI actuele WMS gaf geen JSON"); }
  const punt = normaliseerPuntAntwoord(payload);
  if (!punt) throw new Error("KNMI actuele WMS gaf geen bruikbare mm/uur-puntwaarde");
  if (!punt.tijd || !isVers(punt.tijd, nuMs)) throw new Error("KNMI actuele puntwaarde is verouderd");
  return { ...punt, bron: "KNMI RTCOR 5m", dataset: ACTUEEL_DATASET, laag: ACTUEEL_LAAG };
}

async function haalNowcastPunt(lat, lon, fetchImpl = fetch, nuMs = Date.now()) {
  const xml = await fetchTekst(capabilitiesUrl(NOWCAST_DATASET), fetchImpl, 6500, "text/xml");
  if (!xml.includes("<Name>" + NOWCAST_LAAG + "</Name>")) throw new Error("KNMI nowcastlaag ontbreekt");
  const referenceTime = referenceTimeUitCapabilities(xml);
  if (!referenceTime) throw new Error("KNMI nowcast reference_time ontbreekt");
  if (!isVers(referenceTime, nuMs)) throw new Error("KNMI nowcast is verouderd");

  const tekst = await fetchTekst(nowcastPuntUrl(lat, lon, referenceTime), fetchImpl, 6500, "application/json");
  let payload;
  try { payload = JSON.parse(tekst); }
  catch { throw new Error("KNMI nowcast WMS gaf geen JSON"); }
  const nowcast = normaliseerNowcastAntwoord(payload, referenceTime);
  if (!nowcast) throw new Error("KNMI nowcast gaf geen volledige aaneengesloten 5-minutenreeks");
  return { ...nowcast, bron: "KNMI radar-nowcast", dataset: NOWCAST_DATASET, laag: NOWCAST_LAAG };
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=60");
  const q = req.query || {};
  const lat = leesCoord(q.lat), lon = leesCoord(q.lon);
  if (!binnenKnmiDekking(lat, lon)) {
    return res.status(200).json({ beschikbaar: false, reden: "buiten KNMI-dekking" });
  }

  const [actueelResultaat, nowcastResultaat] = await Promise.allSettled([
    haalActueelPunt(lat, lon),
    haalNowcastPunt(lat, lon)
  ]);
  const actueel = actueelResultaat.status === "fulfilled" ? actueelResultaat.value : null;
  const nowcast = nowcastResultaat.status === "fulfilled" ? nowcastResultaat.value : null;
  if (!actueel && !nowcast) {
    const redenen = [actueelResultaat, nowcastResultaat]
      .filter(x => x.status === "rejected")
      .map(x => String((x.reason && x.reason.message) || x.reason))
      .filter(Boolean);
    return res.status(200).json({ beschikbaar: false, reden: redenen.join("; ") || "KNMI-neerslag niet beschikbaar" });
  }
  return res.status(200).json({
    beschikbaar: true,
    bron: "KNMI",
    actueel,
    nowcast,
    opgehaaldOp: new Date().toISOString()
  });
}

module.exports = handler;
module.exports._intern = {
  KNMI_WMS_BASIS,
  ACTUEEL_DATASET,
  ACTUEEL_LAAG,
  NOWCAST_DATASET,
  NOWCAST_LAAG,
  MAX_OUDERDOM_MS,
  NOWCAST_STAP_MS,
  NOWCAST_PUNTEN,
  leesCoord,
  binnenKnmiDekking,
  actueelPuntUrl,
  capabilitiesUrl,
  nowcastPuntUrl,
  intensiteitsEenheid,
  isVers,
  normaliseerPuntAntwoord,
  referenceTimeUitCapabilities,
  nowcastReeksCompleet,
  normaliseerNowcastAntwoord,
  haalActueelPunt,
  haalNowcastPunt
};
