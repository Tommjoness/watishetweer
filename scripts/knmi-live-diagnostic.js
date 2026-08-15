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
  const entries = reeks && typeof reeks === "object" ? Object.entries(reeks).sort((a, b) => Date.parse(a[0]) - Date.parse(b[0])) : [];
  const geldige = entries.filter(([tijd, waarde]) => Number.isFinite(Date.parse(tijd)) && Number.isFinite(Number(waarde)) && Number(waarde) >= 0);
  const ongeldig = entries.filter(([tijd, waarde]) => !(Number.isFinite(Date.parse(tijd)) && Number.isFinite(Number(waarde)) && Number(waarde) >= 0));
  return {
    name: item && (item.name || item.standard_name) || null,
    units: item && item.units || null,
    punten: entries.length,
    geldigePunten: geldige.length,
    ongeldigePunten: ongeldig.length,
    eersteTijd: entries[0] && entries[0][0] || null,
    laatsteTijd: entries.at(-1) && entries.at(-1)[0] || null,
    eersteWaarden: entries.slice(0, 4).map(([tijd, waarde]) => ({ tijd, type: typeof waarde, waarde: String(waarde).slice(0, 80), nummer: Number(waarde) })),
    ongeldigeVoorbeelden: ongeldig.slice(0, 4).map(([tijd, waarde]) => ({ tijd, type: typeof waarde, waarde: String(waarde).slice(0, 80) })),
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