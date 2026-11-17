export function geldigeCoordinaat(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

const velden = Object.freeze({
  plaatsnaam: ["lat", "lon"],
  neerslag: ["lat", "lon", "land"],
  waarschuwingen: ["lat", "lon", "land", "taal"]
});

export function heeftLocatieQuery(route) {
  return Object.hasOwn(velden, route);
}

export function leesLocatieQuery(url, route) {
  const invoer = {};
  for (const naam of velden[route]) {
    const waarden = url.searchParams.getAll(naam);
    if (waarden.length > 1) return null;
    invoer[naam] = waarden[0] ?? "";
  }

  const lat = Number(invoer.lat);
  const lon = Number(invoer.lon);
  if (!invoer.lat.trim() || !invoer.lon.trim() || !geldigeCoordinaat(lat, lon)) return null;

  const land = route === "neerslag" ? invoer.land.trim() : invoer.land;
  return {
    lat,
    lon,
    land: /^[A-Za-z]{2}$/.test(land || "") ? land.toUpperCase() : "",
    taal: invoer.taal === "en" ? "en" : "nl"
  };
}
