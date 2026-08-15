const WMS = "https://opendata.meteo.be/geoserver/radar/wms";
const WCS = "https://opendata.meteo.be/geoserver/radar/wcs";

function knip(tekst, start, lengte = 6000) {
  const i = tekst.indexOf(start);
  return i >= 0 ? tekst.slice(Math.max(0, i - 500), i + lengte) : tekst.slice(0, lengte);
}

export default {
  async fetch() {
    const urls = [
      `${WMS}?service=WMS&version=1.3.0&request=GetCapabilities`,
      `${WCS}?service=WCS&version=2.0.1&request=GetCapabilities`
    ];
    const uit = {};
    for (const url of urls) {
      try {
        const r = await fetch(url, { headers: { Accept: "text/xml,application/xml;q=0.9,*/*;q=0.1", "User-Agent": "watishetweer.nl-provider-probe/1.0" }, signal: AbortSignal.timeout(8000) });
        const tekst = await r.text();
        uit[url.includes("/wcs?") ? "wcs" : "wms"] = {
          status: r.status,
          type: r.headers.get("content-type"),
          lengte: tekst.length,
          rainfallComposite: tekst.includes("belgian_rainfall_composite"),
          featureInfoJson: /application\/json/i.test(tekst),
          excerpt: knip(tekst, "belgian_rainfall_composite")
        };
      } catch (e) {
        uit[url.includes("/wcs?") ? "wcs" : "wms"] = { fout: String(e && e.message || e) };
      }
    }
    return new Response(JSON.stringify(uit), { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }
};
