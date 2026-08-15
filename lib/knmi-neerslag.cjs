"use strict";

const KNMI_WMS_BASIS = "https://anonymous.api.dataplatform.knmi.nl/wms/adaguc-server";
const ACTUEEL_DATASET = "nl_rdr_data_rtcor_5m";
const ACTUEEL_LAAG = "precipitation_real_time";

function leesCoord(v) {
  if (v == null || String(v).trim() === "") return NaN;
  return Number(v);
}

function binnenKnmiDekking(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= 48.9 && lat <= 55.97 && lon >= 0 && lon <= 10.86;
}

function actueelPuntUrl(lat, lon) {
  const u = new URL(KNMI_WMS_BASIS);
  u.searchParams.set("DATASET", ACTUEEL_DATASET);
  u.searchParams.set("SERVICE", "WMS");
  u.searchParams.set("REQUEST", "GetPointValue");
  u.searchParams.set("VERSION", "1.1.1");
  u.searchParams.set("SRS", "EPSG:4326");
  u.searchParams.set("QUERY_LAYERS", ACTUEEL_LAAG);
  u.searchParams.set("X", Number(lon).toFixed(5));
  u.searchParams.set("Y", Number(lat).toFixed(5));
  u.searchParams.set("INFO_FORMAT", "application/json");
  return u.toString();
}

function normaliseerPuntAntwoord(payload) {
  if (!Array.isArray(payload) || !payload.length) return null;
  const item = payload.find(x => x && x.data && typeof x.data === "object") || payload[0];
  if (!item || !item.data || typeof item.data !== "object") return null;

  const vlak = [];
  function verzamel(obj, pad) {
    for (const [sleutel, waarde] of Object.entries(obj || {})) {
      const nieuwPad = pad.concat(sleutel);
      if (waarde && typeof waarde === "object" && !Array.isArray(waarde)) verzamel(waarde, nieuwPad);
      else {
        const n = Number(waarde);
        if (Number.isFinite(n)) vlak.push({ sleutel, pad: nieuwPad, waarde: n });
      }
    }
  }
  verzamel(item.data, []);
  if (!vlak.length) return null;

  vlak.sort((a, b) => {
    const ta = Date.parse(a.sleutel), tb = Date.parse(b.sleutel);
    if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
    return 0;
  });
  const laatste = vlak[vlak.length - 1];
  const tijd = Number.isFinite(Date.parse(laatste.sleutel)) ? laatste.sleutel : null;
  return {
    waarde: laatste.waarde,
    tijd,
    units: item.units || null,
    naam: item.name || item.standard_name || null,
    punt: item.point || null
  };
}

async function haalActueelPunt(lat, lon, fetchImpl = fetch) {
  const url = actueelPuntUrl(lat, lon);
  const r = await fetchImpl(url, {
    headers: { "Accept": "application/json", "User-Agent": "watishetweer.nl/1.0" },
    signal: AbortSignal.timeout(5500)
  });
  if (!r.ok) throw new Error("KNMI WMS status " + r.status);
  const tekst = await r.text();
  let payload;
  try { payload = JSON.parse(tekst); }
  catch { throw new Error("KNMI WMS gaf geen JSON"); }
  const punt = normaliseerPuntAntwoord(payload);
  if (!punt) throw new Error("KNMI WMS gaf geen puntwaarde");
  return { ...punt, bron: "KNMI RTCOR 5m", dataset: ACTUEEL_DATASET, laag: ACTUEEL_LAAG };
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=240");
  const q = req.query || {};
  const lat = leesCoord(q.lat), lon = leesCoord(q.lon);
  if (!binnenKnmiDekking(lat, lon)) {
    return res.status(200).json({ beschikbaar: false, reden: "buiten KNMI-dekking" });
  }
  try {
    const punt = await haalActueelPunt(lat, lon);
    return res.status(200).json({ beschikbaar: true, actueel: punt });
  } catch (e) {
    return res.status(200).json({ beschikbaar: false, reden: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports._intern = {
  KNMI_WMS_BASIS,
  ACTUEEL_DATASET,
  ACTUEEL_LAAG,
  leesCoord,
  binnenKnmiDekking,
  actueelPuntUrl,
  normaliseerPuntAntwoord,
  haalActueelPunt
};
