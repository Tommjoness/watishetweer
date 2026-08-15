"use strict";

const { haalNeerslagVoorLocatie } = require("../lib/neerslag-provider-registry.cjs");

const locaties = [
  { naam: "Dronten", lat: 52.525, lon: 5.718, land: "NL" },
  { naam: "Amsterdam", lat: 52.3676, lon: 4.9041, land: "NL" },
  { naam: "Brussel", lat: 50.8503, lon: 4.3517, land: "BE" }
];

(async () => {
  for (const locatie of locaties) {
    const resultaat = await haalNeerslagVoorLocatie(locatie);
    console.log(JSON.stringify({
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
  }
})().catch(err => {
  console.error("KNMI live-diagnose kon niet worden uitgevoerd:", err && err.stack || err);
  process.exitCode = 1;
});