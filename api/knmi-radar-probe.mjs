const DATASETS = Object.freeze({
  nowcast: "radar_forecast_2.0",
  observed: "nl_rdr_data_rtcor_5m",
});

function xmlTekst(xml, tag) {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : null;
}

function laagSamenvatting(xml) {
  const uit = [];
  const re = /<Layer\b([^>]*)>([\s\S]*?)<\/Layer>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const body = m[2];
    const name = xmlTekst(body, "Name");
    if (!name) continue;
    const title = xmlTekst(body, "Title");
    const time = /<(?:Dimension|Extent)\b[^>]*name=["']time["'][^>]*>([\s\S]*?)<\/(?:Dimension|Extent)>/i.exec(body);
    uit.push({
      name,
      title,
      queryable: /\bqueryable=["']1["']/i.test(m[1]),
      time: time ? time[1].trim().slice(0, 1200) : null,
    });
  }
  return uit;
}

export default async function handler(req, res) {
  const soort = String(req.query?.soort || "nowcast");
  const dataset = DATASETS[soort];
  if (!dataset) return res.status(400).json({ error: "ongeldige soort" });

  const url = new URL("https://anonymous.api.dataplatform.knmi.nl/wms/adaguc-server");
  url.searchParams.set("DATASET", dataset);
  url.searchParams.set("SERVICE", "WMS");
  url.searchParams.set("REQUEST", "GetCapabilities");
  url.searchParams.set("VERSION", "1.3.0");

  try {
    const r = await fetch(url, {
      headers: { "user-agent": "watishetweer.nl radar validation" },
      signal: AbortSignal.timeout(8000),
    });
    const tekst = await r.text();
    const lagen = laagSamenvatting(tekst);
    return res.status(r.ok ? 200 : 502).json({
      ok: r.ok,
      status: r.status,
      dataset,
      contentType: r.headers.get("content-type"),
      lagen,
      sample: tekst.slice(0, 800),
    });
  } catch (e) {
    return res.status(502).json({ error: e?.name || "fetch_failed", message: String(e?.message || e) });
  }
}
