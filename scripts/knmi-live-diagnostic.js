"use strict";

const knmi = require("../lib/knmi-neerslag.cjs")._intern;
const locaties = [
  { naam: "Dronten", lat: 52.525, lon: 5.718 },
  { naam: "Amsterdam", lat: 52.3676, lon: 4.9041 },
  { naam: "Brussel", lat: 50.8503, lon: 4.3517 },
  { naam: "Groningen", lat: 53.2194, lon: 6.5665 }
];

async function haalTekst(url, accept) {
  const response = await fetch(url, { headers: { Accept: accept, "User-Agent": "watishetweer.nl-audit/1.0" } });
  return { status: response.status, tekst: await response.text() };
}

function negatieveWaarden(payload, referenceTime) {
  const item = Array.isArray(payload)
    ? (payload.find(x => x && x.data && typeof x.data === "object") || payload[0])
    : null;
  const data = item && item.data && typeof item.data === "object" ? item.data : null;
  const reeks = data && (data[referenceTime]
    || Object.values(data).find(v => v && typeof v === "object" && !Array.isArray(v)));
  return reeks && typeof reeks === "object"
    ? Object.entries(reeks)
      .filter(([, waarde]) => Number.isFinite(Number(waarde)) && Number(waarde) < 0)
      .map(([tijd, waarde]) => ({ tijd, waarde: Number(waarde) }))
    : [];
}

(async () => {
  const capabilities = await haalTekst(knmi.capabilitiesUrl(knmi.NOWCAST_DATASET), "text/xml");
  const referenceTime = knmi.referenceTimeUitCapabilities(capabilities.tekst);
  if (!referenceTime) throw new Error("geen reference_time in capabilities");

  for (const locatie of locaties) {
    const antwoord = await haalTekst(knmi.nowcastPuntUrl(locatie.lat, locatie.lon, referenceTime), "application/json");
    let payload = null;
    try { payload = JSON.parse(antwoord.tekst); } catch {}
    console.log(JSON.stringify({
      locatie: locatie.naam,
      status: antwoord.status,
      referenceTime,
      negatief: negatieveWaarden(payload, referenceTime),
      parserAccepteert: !!knmi.normaliseerNowcastAntwoord(payload, referenceTime)
    }));
  }
})().catch(err => {
  console.error("KNMI live-diagnose kon niet worden uitgevoerd:", err && err.stack || err);
  process.exitCode = 1;
});