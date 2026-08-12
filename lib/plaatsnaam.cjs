// Fallback voor reverse-geocoding wanneer de directe client-side BigDataCloud-aanroep mislukt.
// De publieke Nominatimdienst wordt alleen op expliciete locatiekeuze gebruikt, via deze gecachete serverroute.
// De providerbasis en validatie worden gedeeld met andere serverroutes via lib/nominatim.cjs.

const {
  STANDAARD_NOMINATIM_BASIS,
  NOMINATIM_UA,
  nominatimBasisUrl,
  reverseUrl
}=require("./nominatim.cjs");

async function viaNominatim(lat, lon) {
  const r = await fetch(reverseUrl(lat, lon, {zoom:12, language:"nl"}), {
    headers: { "User-Agent": NOMINATIM_UA, "Accept": "application/json" },
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

// Compatibiliteit voor bestaande contracttests; runtime gebruikt de gedeelde helper.
module.exports._intern = { STANDAARD_NOMINATIM_BASIS, nominatimBasisUrl, reverseUrl };
