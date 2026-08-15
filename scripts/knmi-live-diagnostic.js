"use strict";

const { haalNeerslagVoorLocatie } = require("../lib/neerslag-provider-registry.cjs");
const knmi = require("../lib/knmi-neerslag.cjs")._intern;

const locatie = { naam: "Dronten", lat: 52.525, lon: 5.718, land: "NL" };

async function haalTekst(url, accept) {
  const response = await fetch(url, {
    headers: { Accept: accept, "User-Agent": "watishetweer.nl-audit/1.0" }
  });
  return { status: response.status, tekst: await response.text() };
}

(async () => {
  const resultaat = await haalNeerslagVoorLocatie(locatie);
  console.log("PROVIDER " + JSON.stringify({
    locatie: locatie.naam,
    beschikbaar: resultaat.beschikbaar,
    provider: resultaat.provider || null,
    capabilities: resultaat.capabilities || null,
    actueelTijd: resultaat.actueel && resultaat.actueel.tijd || null,
    nowcastReferenceTime: resultaat.nowcast && resultaat.nowcast.referenceTime || null,
    nowcastPunten: resultaat.nowcast && Array.isArray(resultaat.nowcast.punten) ? resultaat.nowcast.punten.length : 0,
    degradaties: resultaat.degradaties || null,
    reden: resultaat.reden || null
  }));

  const capabilities = await haalTekst(knmi.capabilitiesUrl(knmi.NOWCAST_DATASET), "text/xml");
  const referenceTime = knmi.referenceTimeUitCapabilities(capabilities.tekst);
  if (!referenceTime) {
    console.log("RAW " + JSON.stringify({ capabilitiesStatus: capabilities.status, referenceTime: null }));
    return;
  }

  const punt = await haalTekst(knmi.nowcastPuntUrl(locatie.lat, locatie.lon, referenceTime), "application/json");
  let payload = null;
  try { payload = JSON.parse(punt.tekst); } catch {}
  const item = Array.isArray(payload)
    ? (payload.find(x => x && x.data && typeof x.data === "object") || payload[0])
    : null;
  const data = item && item.data && typeof item.data === "object" ? item.data : null;
  const dataTopKeys = data ? Object.keys(data) : [];
  const reeks = data && (data[referenceTime]
    || Object.values(data).find(v => v && typeof v === "object" && !Array.isArray(v)));
  const reeksKeys = reeks && typeof reeks === "object" ? Object.keys(reeks).sort() : [];

  console.log("RAW " + JSON.stringify({
    capabilitiesStatus: capabilities.status,
    referenceTime,
    pointStatus: punt.status,
    payloadIsArray: Array.isArray(payload),
    payloadLength: Array.isArray(payload) ? payload.length : null,
    name: item && (item.name || item.standard_name) || null,
    units: item && item.units || null,
    dataTopKeyCount: dataTopKeys.length,
    dataTopKeys: dataTopKeys.slice(0, 5),
    reeksCount: reeksKeys.length,
    eersteTijd: reeksKeys[0] || null,
    laatsteTijd: reeksKeys.at(-1) || null
  }));
})().catch(err => {
  console.error("KNMI live-diagnose kon niet worden uitgevoerd:", err && err.stack || err);
  process.exitCode = 1;
});