// Zoekt de plaatsnaam bij een coördinaat. Server-side, zodat we een nette
// User-Agent kunnen meesturen (Nominatim vraagt daarom) en niet afhankelijk
// zijn van CORS of van één enkele aanbieder.

async function viaNominatim(lat, lon) {
  const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2"
    + "&lat=" + lat + "&lon=" + lon + "&zoom=12&accept-language=nl";
  const r = await fetch(url, {
    headers: { "User-Agent": "Weerbriefing/1.0 (persoonlijke weer-app)", "Accept": "application/json" },
    signal: AbortSignal.timeout(6000)
  });
  if (!r.ok) throw new Error("nominatim status " + r.status);
  const d = await r.json();
  const a = d.address || {};
  return a.city || a.town || a.village || a.municipality || a.suburb || a.county || null;
}

async function viaBigDataCloud(lat, lon) {
  const url = "https://api.bigdatacloud.net/data/reverse-geocode-client"
    + "?latitude=" + lat + "&longitude=" + lon + "&localityLanguage=nl";
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error("bigdatacloud status " + r.status);
  const d = await r.json();
  return d.city || d.locality || d.principalSubdivision || null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");

  const lat = parseFloat(req.query.lat), lon = parseFloat(req.query.lon);
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ naam: null, reden: "ongeldige coordinaten" });
  }

  const fouten = [];
  for (const zoek of [viaNominatim, viaBigDataCloud]) {
    try {
      const naam = await zoek(lat.toFixed(4), lon.toFixed(4));
      if (naam) return res.status(200).json({ naam, bron: zoek.name });
    } catch (e) {
      fouten.push(zoek.name + ": " + String((e && e.message) || e));
    }
  }
  return res.status(200).json({ naam: null, reden: fouten.join(" | ") });
}
