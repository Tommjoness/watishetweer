// Fallback voor reverse-geocoding wanneer de directe client-side BigDataCloud-aanroep mislukt.
// De publieke Nominatimdienst wordt alleen op expliciete locatiekeuze gebruikt, via deze gecachete serverroute.
//
// De fallback-basis is configureerbaar zodat de provider zonder applicatierelease
// kan worden omgezet naar een eigen of andere Nominatim-compatible dienst. Laat
// NOMINATIM_BASE_URL leeg voor de publieke OSMF-dienst. Een expliciet ingestelde
// maar ongeldige URL valt bewust NIET stil terug op de publieke dienst.

const STANDAARD_NOMINATIM_BASIS = "https://nominatim.openstreetmap.org";

function nominatimBasisUrl() {
  const ingesteld = String(process.env.NOMINATIM_BASE_URL || "").trim();
  if (!ingesteld) return STANDAARD_NOMINATIM_BASIS;

  let u;
  try { u = new URL(ingesteld); }
  catch (_) { throw new Error("NOMINATIM_BASE_URL is geen geldige URL"); }

  const localhost = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "::1";
  if (u.protocol !== "https:" && !(localhost && u.protocol === "http:")) {
    throw new Error("NOMINATIM_BASE_URL moet HTTPS gebruiken");
  }
  if (u.username || u.password || u.search || u.hash) {
    throw new Error("NOMINATIM_BASE_URL mag geen login, query of fragment bevatten");
  }

  u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString().replace(/\/$/, "");
}

function reverseUrl(lat, lon) {
  const u = new URL(nominatimBasisUrl() + "/reverse");
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("lat", String(lat));
  u.searchParams.set("lon", String(lon));
  u.searchParams.set("zoom", "12");
  u.searchParams.set("accept-language", "nl");
  return u.toString();
}

async function viaNominatim(lat, lon) {
  const r = await fetch(reverseUrl(lat, lon), {
    headers: { "User-Agent": "WatIsHetWeer/1.0 (watishetweer.nl; github.com/Tommjoness/weathernow)", "Accept": "application/json" },
    signal: AbortSignal.timeout(6000)
  });
  if (!r.ok) throw new Error("nominatim status " + r.status);
  const d = await r.json();
  const a = d.address || {};
  return {
    naam: a.city || a.town || a.village || a.municipality || a.suburb || a.county || null,
    land: a.country_code ? String(a.country_code).toUpperCase() : null
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  const q = req.query || {};
  const leesCoord = v => v == null || String(v).trim() === "" ? NaN : Number(v);
  const lat = leesCoord(q.lat), lon = leesCoord(q.lon);
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ naam: null, land: null, reden: "ongeldige coordinaten" });
  }
  try {
    const uit = await viaNominatim(lat.toFixed(4), lon.toFixed(4));
    return res.status(200).json({ naam: uit.naam, land: uit.land, bron: "viaNominatim" });
  } catch (e) {
    return res.status(200).json({ naam: null, land: null, reden: "viaNominatim: " + String((e && e.message) || e) });
  }
};

// Alleen voor deterministische contracttests; de runtime gebruikt de handler hierboven.
module.exports._intern = { STANDAARD_NOMINATIM_BASIS, nominatimBasisUrl, reverseUrl };
