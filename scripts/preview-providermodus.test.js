"use strict";

/* SEC-02: contract van de providermodus van de PR-preview (scripts/ci/preview-providermodus.js).
   Deterministisch: geen netwerk, geen sleutels. Bewijst
   - dat de modus "geen-sleutel" nergens buiten *.watishetweer-preview.pages.dev kan worden gekozen (fail-closed);
   - dat de echte route /api/forecast zonder sleutels precies het contract geeft dat de preview-smoke en de browsertest eisen;
   - dat het contract een geslaagde live-fallback (200, bron visualcrossing) nooit als "geen sleutel" accepteert, en andersom
     dat afwijkingen van het foutcontract worden afgekeurd (geen stille of misleidend groene controle). */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { MODI, REDEN_ZONDER_SLEUTEL, leesModus, beoordeelZonderSleutel, volledigeForecastDekking } = require("./ci/preview-providermodus.js");

const PREVIEW = "https://abc123.watishetweer-preview.pages.dev";

/* 1. Modus: standaard streng, geen-sleutel alleen voor het previewdomein, al het andere is een fout. */
assert.equal(leesModus({}, "https://watishetweer.nl"), MODI.SLEUTEL, "zonder variabele geldt de strenge modus");
assert.equal(leesModus({ PREVIEW_PROVIDERMODUS: "" }, "https://watishetweer.nl"), MODI.SLEUTEL);
assert.equal(leesModus({ PREVIEW_PROVIDERMODUS: "  " }, "https://watishetweer.nl"), MODI.SLEUTEL);
assert.equal(leesModus({ PREVIEW_PROVIDERMODUS: "sleutel" }, "https://watishetweer.nl"), MODI.SLEUTEL);
assert.equal(leesModus({ PREVIEW_PROVIDERMODUS: "geen-sleutel" }, PREVIEW), MODI.GEEN_SLEUTEL);
assert.equal(leesModus({ PREVIEW_PROVIDERMODUS: "geen-sleutel" }, PREVIEW + "/"), MODI.GEEN_SLEUTEL, "afsluitende slash is toegestaan");
for (const root of [
  "https://watishetweer.nl", "https://www.watishetweer.nl", "https://watishetweer.pages.dev", "https://abc123.watishetweer.pages.dev",
  "http://abc123.watishetweer-preview.pages.dev", "https://watishetweer-preview.pages.dev", "http://127.0.0.1:8788",
  "https://abc123.watishetweer-preview.pages.dev.evil.example", "https://evil.example/https://abc123.watishetweer-preview.pages.dev",
  "https://abc123.watishetweer-preview.pages.dev@evil.example", "", undefined, null
]) {
  assert.throws(() => leesModus({ PREVIEW_PROVIDERMODUS: "geen-sleutel" }, root), /alleen toegestaan voor \*\.watishetweer-preview\.pages\.dev/, `geen-sleutel mag niet voor ${root}`);
}
for (const waarde of ["GEEN-SLEUTEL", "geen_sleutel", "nee", "true", "1", "sleutel,geen-sleutel"]) {
  assert.throws(() => leesModus({ PREVIEW_PROVIDERMODUS: waarde }, PREVIEW), /Onbekende PREVIEW_PROVIDERMODUS/, `waarde ${waarde} moet worden geweigerd`);
}

/* 2. Beoordelaar: het echte foutcontract slaagt, afwijkingen en een geslaagde fallback falen. */
const goedeHeaders = { "cache-control": "private, no-store", "retry-after": "300" };
const goedeBody = () => ({ beschikbaar: false, provider: "weatherapi", reden: REDEN_ZONDER_SLEUTEL });
const beoordeel = ({ status = 503, headers = goedeHeaders, body = goedeBody() } = {}) =>
  beoordeelZonderSleutel({ status, header: naam => (naam in headers ? headers[naam] : null), body });
assert.deepEqual(beoordeel(), [], "het foutcontract zonder sleutel moet slagen");
const afwijkingen = {
  "HTTP 200 (geslaagde fallback)": { status: 200 },
  "HTTP 500": { status: 500 },
  "HTTP 502": { status: 502 },
  "geen no-store": { headers: { ...goedeHeaders, "cache-control": "public, max-age=300" } },
  "geen cache-control": { headers: { "retry-after": "300" } },
  "geen retry-after": { headers: { "cache-control": "private, no-store" } },
  "retry-after geen getal": { headers: { ...goedeHeaders, "retry-after": "morgen" } },
  "retry-after nul": { headers: { ...goedeHeaders, "retry-after": "0" } },
  "bronheader aanwezig": { headers: { ...goedeHeaders, "x-wiw-weather-source": "visualcrossing" } },
  "CDN-cache aanwezig": { headers: { ...goedeHeaders, "cloudflare-cdn-cache-control": "s-maxage=300" } },
  "beschikbaar true": { body: { ...goedeBody(), beschikbaar: true } },
  "andere provider": { body: { ...goedeBody(), provider: "visualcrossing" } },
  "andere reden": { body: { ...goedeBody(), reden: "tijdelijk niet beschikbaar" } },
  "extra veld": { body: { ...goedeBody(), sleutel: "x" } },
  "ontbrekend veld": { body: { beschikbaar: false, provider: "weatherapi" } },
  "body ontbreekt": { body: null },
  "body is array": { body: [] },
  "body is tekst": { body: "fout" }
};
for (const [naam, variant] of Object.entries(afwijkingen)) {
  assert(beoordeel(variant).length > 0, `afwijking moet worden afgekeurd: ${naam}`);
}
assert.deepEqual(beoordeelZonderSleutel({ status: 503, header: undefined, body: goedeBody() }).length > 0, true, "zonder headers kan het contract niet slagen");

/* 3. Dekkingsvoorwaarde (zelfde als de live-controles). */
const dag = i => new Date(Date.UTC(2026, 8, 6 + i)).toISOString().slice(0, 10);
const payload = (uren = 24, dagen = 7) => ({
  daily: { time: Array.from({ length: dagen }, (_, i) => dag(i)) },
  hourly: { time: Array.from({ length: dagen }, (_, i) => Array.from({ length: uren }, (_, h) => `${dag(i)}T${String(h).padStart(2, "0")}:00`)).flat() }
});
assert.equal(volledigeForecastDekking(payload()), true);
assert.equal(volledigeForecastDekking(payload(23)), true);
assert.equal(volledigeForecastDekking(payload(25)), true);
assert.equal(volledigeForecastDekking(payload(22)), false);
assert.equal(volledigeForecastDekking(payload(24, 6)), false);
assert.equal(volledigeForecastDekking({}), false);
assert.equal(volledigeForecastDekking(null), false);

/* 4. De echte route. */
(async () => {
  const { default: worker } = await import("../api/forecast.mjs");
  const verzoek = () => new Request("https://abc123.watishetweer-preview.pages.dev/api/forecast?lat=52.3508&lon=5.2647");
  const naarInvoer = async r => ({ status: r.status, header: naam => r.headers.get(naam), body: await r.json() });

  /* 4a. Zonder enige sleutel: precies het contract dat de preview-smoke en de browsertest eisen. */
  for (const env of [{}, { VISUAL_CROSSING_API_KEY: "", WEATHERAPI_KEY: "" }, { VISUAL_CROSSING_API_KEY: "  ", WEATHERAPI_KEY: "  " }, undefined]) {
    const r = await worker.fetch(verzoek(), env);
    const invoer = await naarInvoer(r);
    assert.deepEqual(beoordeelZonderSleutel(invoer), [], "de echte route zonder sleutels moet het foutcontract leveren: " + JSON.stringify(env));
  }
  const bron = fs.readFileSync(path.join(__dirname, "..", "api", "forecast.mjs"), "utf8");
  assert(bron.includes(REDEN_ZONDER_SLEUTEL), "REDEN_ZONDER_SLEUTEL moet in api/forecast.mjs voorkomen (anders wijkt het contract af)");

  /* 4b. Een geslaagde live-fallback (200, bron visualcrossing, volledige payload) is nooit het foutcontract zonder sleutel. */
  const geslaagdeFallback = {
    status: 200,
    header: naam => ({ "x-wiw-weather-source": "visualcrossing", "cache-control": "public, max-age=0", "cloudflare-cdn-cache-control": "s-maxage=300" })[naam] || null,
    body: { provider: "visualcrossing", ...payload(), timezone: "Europe/Amsterdam", current: { temperature_2m: 15 } }
  };
  assert(beoordeelZonderSleutel(geslaagdeFallback).length >= 3, "een geslaagde Visual Crossing-fallback mag nooit als foutcontract zonder sleutel slagen");
  assert(volledigeForecastDekking(geslaagdeFallback.body), "testfixture van de geslaagde fallback moet zelf volledig zijn");

  console.log("preview-providermodus: modusgrens (fail-closed), 503-contract van de echte route zonder sleutels, afkeuring van 18 afwijkingen en dekkingsvoorwaarde geslaagd.");
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
