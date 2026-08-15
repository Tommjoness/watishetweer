"use strict";

const knmi = require("../lib/knmi-neerslag.cjs")._intern;
const locaties = [
  { naam: "Amsterdam", lat: 52.3676, lon: 4.9041 },
  { naam: "Rotterdam", lat: 51.9244, lon: 4.4777 },
  { naam: "Utrecht", lat: 52.0907, lon: 5.1214 },
  { naam: "Groningen", lat: 53.2194, lon: 6.5665 },
  { naam: "Maastricht", lat: 50.8514, lon: 5.6910 },
  { naam: "Brussel", lat: 50.8503, lon: 4.3517 }
];

const slaap = ms => new Promise(resolve => setTimeout(resolve, ms));

async function haalTekst(url, accept) {
  const response = await fetch(url, { headers: { Accept: accept, "User-Agent": "watishetweer.nl-audit/1.0" } });
  return { status: response.status, tekst: await response.text() };
}

function vatSamen(payload, referenceTime) {
  const item = Array.isArray(payload)
    ? (payload.find(x => x && x.data && typeof x.data === "object") || payload[0])
    : null;
  const data = item && item.data && typeof item.data === "object" ? item.data : null;
  const reeks = data && (data[referenceTime]
    || Object.values(data).find(v => v && typeof v === "object" && !Array.isArray(v)));
  const entries = reeks && typeof reeks === "object"
    ? Object.entries(reeks).map(([tijd, waarde]) => ({ tijd, waarde: Number(waarde) }))
      .filter(x => Number.isFinite(Date.parse(x.tijd)) && Number.isFinite(x.waarde))
      .sort((a, b) => Date.parse(a.tijd) - Date.parse(b.tijd))
    : [];
  const metadata = item ? Object.fromEntries(Object.entries(item)
    .filter(([key]) => key !== "data")
    .map(([key, value]) => [key, value])) : null;
  return {
    metadata,
    nietNul: entries.filter(x => x.waarde !== 0),
    min: entries.length ? Math.min(...entries.map(x => x.waarde)) : null,
    max: entries.length ? Math.max(...entries.map(x => x.waarde)) : null,
    parserAccepteert: !!knmi.normaliseerNowcastAntwoord(payload, referenceTime)
  };
}

(async () => {
  const capabilities = await haalTekst(knmi.capabilitiesUrl(knmi.NOWCAST_DATASET), "text/xml");
  const referenceTime = knmi.referenceTimeUitCapabilities(capabilities.tekst);
  if (!referenceTime) throw new Error("geen reference_time in capabilities");

  for (let i = 0; i < locaties.length; i++) {
    const locatie = locaties[i];
    if (i) await slaap(1100);
    const antwoord = await haalTekst(knmi.nowcastPuntUrl(locatie.lat, locatie.lon, referenceTime), "application/json");
    let payload = null;
    try { payload = JSON.parse(antwoord.tekst); } catch {}
    console.log(JSON.stringify({ locatie: locatie.naam, status: antwoord.status, referenceTime, ...vatSamen(payload, referenceTime) }));
  }
})().catch(err => {
  console.error("KNMI live-diagnose kon niet worden uitgevoerd:", err && err.stack || err);
  process.exitCode = 1;
});