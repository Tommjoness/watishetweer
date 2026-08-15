"use strict";

const assert = require("assert");
const knmi = require("../lib/knmi-neerslag.cjs")._intern;

async function main() {
  const capUrl = knmi.KNMI_WMS_BASIS
    + "?DATASET=" + encodeURIComponent(knmi.ACTUEEL_DATASET)
    + "&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities";
  const cap = await fetch(capUrl, {
    headers: { "Accept": "text/xml", "User-Agent": "watishetweer.nl-live-probe/1.0" },
    signal: AbortSignal.timeout(8000)
  });
  const xml = await cap.text();
  assert.equal(cap.ok, true, "GetCapabilities status " + cap.status);
  assert(xml.includes("<Name>" + knmi.ACTUEEL_LAAG + "</Name>"), "laag niet gevonden in GetCapabilities: " + knmi.ACTUEEL_LAAG);
  console.log("KNMI capabilities: dataset en laag gevonden.");

  // Eén verzoek; de anonieme WMS heeft een lage gedeelde rate limit.
  await new Promise(r => setTimeout(r, 1200));
  const punt = await knmi.haalActueelPunt(51.989, 5.0939);
  assert(Number.isFinite(punt.waarde), "geen numerieke puntwaarde");
  console.log("KNMI Vianen puntrespons:", JSON.stringify({
    waarde: punt.waarde,
    tijd: punt.tijd,
    units: punt.units,
    naam: punt.naam,
    punt: punt.punt,
    dataset: punt.dataset,
    laag: punt.laag
  }));
}

main().catch(e => {
  console.error("KNMI live probe mislukt:", e && e.stack || e);
  process.exit(1);
});
