// Vercel serverless functie. Haalt de MeteoAlarm-waarschuwingen op en geeft ze
// genormaliseerd terug, zodat de browser niet tegen CORS aanloopt.
//
// De feed-URL's van MeteoAlarm veranderen af en toe. Daarom worden er meerdere
// geprobeerd, in volgorde van voorkeur. Levert er geen enkele iets op, dan komt
// er een lege lijst terug en toont de app simpelweg geen waarschuwingen.

const BRONNEN = [
  "https://feeds.meteoalarm.org/api/v1/warnings/feeds-netherlands",
  "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-netherlands"
];

const NIVEAU = { 1: "geel", 2: "oranje", 3: "rood", Minor: "geel", Moderate: "geel", Severe: "oranje", Extreme: "rood" };

function uitCap(json) {
  const lijst = [];
  const groepen = json.warnings || json.features || json.data || [];
  for (const g of Array.isArray(groepen) ? groepen : []) {
    const info = (g.capData && g.capData.info) || g.info || g.properties || g;
    const items = Array.isArray(info) ? info : [info];
    for (const i of items) {
      if (!i) continue;
      const kop = i.event || i.headline || i.title;
      if (!kop) continue;
      lijst.push({
        titel: String(kop),
        tekst: String(i.description || i.instruction || "").slice(0, 300),
        niveau: NIVEAU[i.severity] || NIVEAU[i.level] || "geel",
        van: i.onset || i.effective || null,
        tot: i.expires || i.ends || null,
        gebied: (i.area && i.area[0] && i.area[0].areaDesc) || i.areaDesc || null
      });
    }
  }
  return lijst;
}

function uitAtom(xml) {
  const lijst = [];
  const entries = xml.split("<entry").slice(1);
  for (const e of entries) {
    const t = (e.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1];
    const s = (e.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) || [])[1];
    if (!t) continue;
    lijst.push({
      titel: t.replace(/<[^>]+>/g, "").trim(),
      tekst: (s || "").replace(/<[^>]+>/g, "").trim().slice(0, 300),
      niveau: /rood|red/i.test(t) ? "rood" : /oranje|orange/i.test(t) ? "oranje" : "geel",
      van: null, tot: null, gebied: null
    });
  }
  return lijst;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");

  for (const bron of BRONNEN) {
    try {
      const r = await fetch(bron, {
        headers: { "User-Agent": "Weerbriefing/1.0", "Accept": "application/json, application/atom+xml" },
        signal: AbortSignal.timeout(6000)
      });
      if (!r.ok) continue;
      const tekst = await r.text();
      let lijst = [];
      if (tekst.trim().startsWith("{") || tekst.trim().startsWith("[")) {
        lijst = uitCap(JSON.parse(tekst));
      } else if (tekst.includes("<entry")) {
        lijst = uitAtom(tekst);
      }
      if (lijst.length) return res.status(200).json({ bron: bron, lijst: lijst });
      return res.status(200).json({ bron: bron, lijst: [] });
    } catch (e) {
      // volgende bron proberen
    }
  }
  return res.status(200).json({ bron: null, lijst: [] });
}
