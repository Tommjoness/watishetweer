"use strict";

const assert = require("assert");
const handler = require("../lib/knmi-neerslag.cjs");
const interpretatie = require("../interpretatie-engine.js");
const beleid = require("../neerslagkans-policy-v3.js");
const { MAX_OUDERDOM_MS, isVers, haalActueelPunt } = handler._intern;
const {
  knmiActueleKandidaat,
  volgendeKnmiVerversingMs,
  knmiPayloadMoetBijFocusVervers,
  verrijkAnalyseMetKnmi
} = beleid;

(async () => {
  const nu = Date.parse("2026-08-15T14:30:00Z");

  assert.equal(MAX_OUDERDOM_MS, 10 * 60 * 1000, "actuele radar mag maximaal tien minuten oud zijn");
  assert.equal(isVers("2026-08-15T14:20:00Z", nu), true, "exact tien minuten oud blijft bruikbaar");
  assert.equal(isVers("2026-08-15T14:19:59Z", nu), false, "ouder dan tien minuten moet worden geweigerd");

  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify([{
      name: "precipitation_real_time",
      units: "mm/hr",
      data: { "2026-08-15T14:19:59Z": "4.2" }
    }])
  });
  await assert.rejects(
    () => haalActueelPunt(52.259, 5.606, fakeFetch, nu),
    /verouderd/,
    "zelfs zware oude neerslag mag niet als actuele stortbui worden gepresenteerd"
  );

  const plotselingeBui = {
    beschikbaar: true,
    opgehaaldOp: "2026-08-15T14:36:00Z",
    actueel: { waarde: 0, tijd: "2026-08-15T14:30:00Z" },
    nowcast: {
      referenceTime: "2026-08-15T14:35:00Z",
      punten: [{ tijd: "2026-08-15T14:35:00Z", waarde: 1.2 }]
    }
  };
  const kandidaat = knmiActueleKandidaat(plotselingeBui, Date.parse("2026-08-15T14:36:00Z"));
  assert(kandidaat, "nieuwste actuele KNMI-signaal moet worden gevonden");
  assert.equal(kandidaat.waarde, 1.2, "nieuwere +0-nowcast moet een oudere droge RTCOR-meting kunnen inhalen");
  assert.equal(kandidaat.bron, "knmi-nowcast-0");

  const basis = {
    genoeg: true,
    status: "GEEN_KANS",
    rang: 0,
    kans: 0,
    kansDekking: 1,
    hoeveelheid: 0,
    currentWet: false,
    currentHoeveelheid: 0,
    soort: "neerslag",
    startMin: Date.parse("2026-08-15T14:35:00Z") / 60000,
    duurMin: 120
  };
  const verrijkt = verrijkAnalyseMetKnmi(
    basis,
    {
      timezone: "Europe/Amsterdam",
      utc_offset_seconds: 7200,
      current: { weather_code: 3 },
      __knmiNeerslag: plotselingeBui
    },
    120,
    interpretatie,
    Date.parse("2026-08-15T14:36:00Z")
  );
  assert.equal(verrijkt.currentWet, true, "plotselinge nieuwe bui moet model-droog direct overrulen");
  assert.equal(verrijkt.currentRadarWet, true);
  assert.equal(verrijkt.currentIntensiteit, 1.2);
  assert.equal(verrijkt.bronActueelDetail, "knmi-nowcast-0");

  const oudeMeting = {
    beschikbaar: true,
    opgehaaldOp: "2026-08-15T14:29:30Z",
    actueel: { waarde: 8.5, tijd: "2026-08-15T14:19:59Z" }
  };
  assert.equal(
    knmiActueleKandidaat(oudeMeting, nu),
    null,
    "een recent opgehaalde payload mag een oude zware meting niet opnieuw actueel maken"
  );

  assert.equal(
    volgendeKnmiVerversingMs(
      { actueel: { tijd: "2026-08-15T14:30:00Z" } },
      Date.parse("2026-08-15T14:32:00Z")
    ),
    225000,
    "refresh moet kort na de verwachte volgende vijfminutenframe vallen"
  );
  assert.equal(
    volgendeKnmiVerversingMs(
      { actueel: { tijd: "2026-08-15T14:30:00Z" } },
      Date.parse("2026-08-15T14:36:00Z")
    ),
    60000,
    "als een nieuwe frame uitblijft moet na één minuut opnieuw worden geprobeerd"
  );
  assert.equal(
    knmiPayloadMoetBijFocusVervers(
      { beschikbaar: true, opgehaaldOp: "2026-08-15T14:29:30Z" },
      nu
    ),
    false,
    "een payload van dertig seconden oud hoeft bij focus niet opnieuw"
  );
  assert.equal(
    knmiPayloadMoetBijFocusVervers(
      { beschikbaar: true, opgehaaldOp: "2026-08-15T14:28:59Z" },
      nu
    ),
    true,
    "na terugkeer naar een pagina met ouder dan één minuut oude data moet direct worden ververst"
  );

  let cacheHeader = null;
  const response = {
    setHeader(name, value) {
      if (String(name).toLowerCase() === "cache-control") cacheHeader = String(value);
    },
    status() { return this; },
    json(value) { return value; }
  };
  await handler({ query: { lat: "40.7128", lon: "-74.006" } }, response);
  assert.equal(cacheHeader, "s-maxage=60, stale-while-revalidate=60", "de CDN mag actuele neerslag niet minutenlang extra verouderen");

  console.log("KNMI live freshness: ouderdom, plotselinge bui, +0-nowcast, frameplanning, focusrefresh en cache geslaagd.");
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});