// Haalt bij het KNMI op welke tijdstappen de neerslagverwachting heeft.
// De browser kan dat niet zelf doen omdat het KNMI geen CORS-headers meegeeft.
// De kaartbeelden zelf haalt de browser wel rechtstreeks op, want voor het
// tekenen van een afbeelding is geen CORS nodig.
//
// Dataset en laagnaam zijn geverifieerd tegen de capabilities van het KNMI:
//   DATASET=radar_forecast_2.0   LAYERS=precipitation_nowcast
// De tijddimensie ziet er zo uit:
//   <Dimension name="time" ...>2026-06-25T22:50:00Z/2026-07-03T00:45:00Z/PT5M</Dimension>
// Dat is een reeks over vele dagen, dus we lezen hem van achteren naar voren.

const HOST = "https://anonymous.api.dataplatform.knmi.nl/wms/adaguc-server";
const DATASET = "radar_forecast_2.0";
const LAAG = "precipitation_nowcast";

// laatste `aantal` momenten uit een WMS-tijddimensie
function laatsteStappen(waarde, aantal) {
  const uit = [];
  for (const deel of String(waarde).split(",")) {
    const stuk = deel.trim();
    if (!stuk) continue;
    if (stuk.includes("/")) {
      const [van, tot, stap] = stuk.split("/");
      const m = /P(?:T)?(?:(\d+)H)?(?:(\d+)M)?/.exec(stap || "PT5M");
      const ms = ((+((m && m[1]) || 0)) * 60 + (+((m && m[2]) || 5))) * 60000;
      const begin = Date.parse(van), eind = Date.parse(tot);
      if (!isFinite(begin) || !isFinite(eind) || ms <= 0) continue;
      for (let t = eind, n = 0; t >= begin && n < aantal; t -= ms, n++) {
        uit.push(new Date(t).toISOString().replace(/\.\d+Z$/, "Z"));
      }
    } else {
      uit.push(stuk);
    }
  }
  return Array.from(new Set(uit)).sort();
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=240, stale-while-revalidate=600");
  const url = HOST + "?DATASET=" + DATASET + "&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities";

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Weerbriefing/1.0", "Accept": "text/xml" },
      signal: AbortSignal.timeout(8000)
    });
    const xml = await r.text();
    if (!r.ok) {
      return res.status(200).json({ tijden: [], reden: "KNMI gaf status " + r.status });
    }

    // het blok van de nowcast-laag, en daarbinnen de tijddimensie
    const blok = xml.split("<Layer").find(b => b.includes("<Name>" + LAAG + "</Name>"));
    if (!blok) {
      const namen = (xml.match(/<Name>[^<]+<\/Name>/g) || []).slice(0, 8);
      return res.status(200).json({ tijden: [], reden: "laag niet gevonden", namen });
    }
    const dim = blok.match(/<Dimension[^>]*name=["']time["'][^>]*>([\s\S]*?)<\/Dimension>/i);
    if (!dim) {
      return res.status(200).json({ tijden: [], reden: "geen tijddimensie in de laag" });
    }

    const tijden = laatsteStappen(dim[1], 40);
    const laatste = tijden[tijden.length - 1] || null;
    const ouderdomMin = laatste ? Math.round((Date.now() - Date.parse(laatste)) / 60000) : null;

    return res.status(200).json({
      dataset: DATASET,
      laag: LAAG,
      basis: HOST + "?DATASET=" + DATASET,
      laatste,
      ouderdomMin,
      tijden
    });
  } catch (e) {
    return res.status(200).json({ tijden: [], reden: String((e && e.message) || e) });
  }
}
