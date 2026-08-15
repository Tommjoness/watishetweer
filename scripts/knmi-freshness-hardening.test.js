"use strict";

const assert = require("assert");
const handler = require("../lib/knmi-neerslag.cjs");
const { MAX_OUDERDOM_MS, isVers, haalActueelPunt } = handler._intern;

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

  console.log("KNMI freshness hardening: 10-minutengrens en korte CDN-cache geslaagd.");
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
