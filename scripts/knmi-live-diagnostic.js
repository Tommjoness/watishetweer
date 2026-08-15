"use strict";

const knmi = require("../lib/knmi-neerslag.cjs")._intern;
const locatie = { naam: "Dronten", lat: 52.525, lon: 5.718 };

async function haalTekst(url, accept) {
  const response = await fetch(url, { headers: { Accept: accept, "User-Agent": "watishetweer.nl-audit/1.0" } });
  return { status: response.status, tekst: await response.text() };
}

function vorm(payload, referenceTime) {
  const item = Array.isArray(payload)
    ? (payload.find(x => x && x.data && typeof x.data === "object") || payload[0])
    : null;
  const data = item && item.data && typeof item.data === "object" ? item.data : null;
  const reeks = data && (data[referenceTime]
    || Object.values(data).find(v => v && typeof v === "object" && !Array.isArray(v)));
  const keys = reeks && typeof reeks === "object" ? Object.keys(reeks).sort() : [];
  return {
    name: item && (item.name || item.standard_name) || null,
    units: item && item.units || null,
    punten: keys.length,
    eersteTijd: keys[0] || null,
    laatsteTijd: keys.at(-1) || null,
    parserAccepteert: !!knmi.normaliseerNowcastAntwoord(payload, referenceTime)
  };
}

(async () => {
  const capabilities = await haalTekst(knmi.capabilitiesUrl(knmi.NOWCAST_DATASET), "text/xml");
  const referenceTime = knmi.referenceTimeUitCapabilities(capabilities.tekst);
  if (!referenceTime) throw new Error("geen reference_time in capabilities");

  for (const [label, ref] of [
    ["default", referenceTime],
    ["vorige", new Date(Date.parse(referenceTime) - knmi.NOWCAST_STAP_MS).toISOString().replace(/\.000Z$/, "Z")]
  ]) {
    const antwoord = await haalTekst(knmi.nowcastPuntUrl(locatie.lat, locatie.lon, ref), "application/json");
    let payload = null;
    try { payload = JSON.parse(antwoord.tekst); } catch {}
    console.log(JSON.stringify({ label, status: antwoord.status, referenceTime: ref, ...vorm(payload, ref) }));
  }
})().catch(err => {
  console.error("KNMI live-diagnose kon niet worden uitgevoerd:", err && err.stack || err);
  process.exitCode = 1;
});