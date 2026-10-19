/* Verslag B4: /api/forecast logt per mislukte provider een gesloten foutcategorie,
   de duur, het grove paginatype en het request-ID van de API-regel; nooit
   sleutels, URL's of coördinaten. */
import assert from "node:assert";
import worker, { _intern } from "../api/forecast.mjs";

const SLEUTEL_VC = "geheime-vc-sleutel-123";
const SLEUTEL_WA = "geheime-wa-sleutel-456";
const env = { VISUAL_CROSSING_API_KEY: SLEUTEL_VC, WEATHERAPI_KEY: SLEUTEL_WA };

assert.equal(_intern.foutCategorie(Object.assign(new Error("x"), { name: "AbortError" })), "timeout");
assert.equal(_intern.foutCategorie(new Error("upstream status 429")), "http_429");
assert.equal(_intern.foutCategorie(new Error("upstream status 401")), "http_toegang");
assert.equal(_intern.foutCategorie(new Error("upstream status 503")), "http_5xx");
assert.equal(_intern.foutCategorie(new Error("upstream status 404")), "http_4xx");
assert.equal(_intern.foutCategorie(new Error("Visual Crossing-locatie wijkt af van de aanvraag")), "locatie_afwijking");
assert.equal(_intern.foutCategorie(new Error("WeatherAPI leverde geen volledige zevendaagse verwachting")), "dekking_afgewezen");
assert.equal(_intern.foutCategorie(new SyntaxError("Unexpected token")), "ongeldige_json");
assert.equal(_intern.foutCategorie(new TypeError("fetch failed")), "netwerk");
assert.equal(_intern.foutCategorie(new Error("iets anders met https://x?key=geheim")), "onbekend");

assert.equal(_intern.paginaType(new Request("https://watishetweer.nl/api/forecast", { headers: { referer: "https://watishetweer.nl/nachtzicht/biesbosch/" } })), "park");
assert.equal(_intern.paginaType(new Request("https://watishetweer.nl/api/forecast", { headers: { referer: "https://watishetweer.nl/herfstvakantie/" } })), "vakantie");
assert.equal(_intern.paginaType(new Request("https://watishetweer.nl/api/forecast", { headers: { referer: "https://watishetweer.nl/weer/utrecht/" } })), "app");
assert.equal(_intern.paginaType(new Request("https://watishetweer.nl/api/forecast")), "onbekend");

async function met(fetchMock, referer) {
  const echteFetch = globalThis.fetch, echteWarn = console.warn;
  const logs = [];
  globalThis.fetch = fetchMock;
  console.warn = r => logs.push(r);
  try {
    const request = new Request("https://watishetweer.nl/api/forecast?lat=52.09&lon=5.12", { headers: referer ? { referer } : {} });
    const response = await worker.fetch(request, env, { requestId: "rid-42" });
    return { response, logs };
  } finally {
    globalThis.fetch = echteFetch;
    console.warn = echteWarn;
  }
}

/* Visual Crossing 503, WeatherAPI time-out: twee categorieën, zelfde request-ID. */
{
  const { response, logs } = await met(async url => {
    if (String(url).includes("visualcrossing")) return new Response("{}", { status: 503 });
    throw Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
  }, "https://watishetweer.nl/herfstvakantie/");
  assert.equal(response.status, 503);
  assert.deepEqual(logs.map(l => [l.event, l.provider, l.categorie, l.pagina, l.request_id]), [
    ["wiw_forecast_provider_error", "visualcrossing", "http_5xx", "vakantie", "rid-42"],
    ["wiw_forecast_provider_error", "weatherapi", "timeout", "vakantie", "rid-42"]
  ]);
  for (const l of logs) assert(Number.isFinite(l.duration_ms) && l.duration_ms >= 0, "duur is een getal");
  const tekst = JSON.stringify(logs);
  for (const verboden of [SLEUTEL_VC, SLEUTEL_WA, "://", "52.09", "5.12", "lat=", "key="]) assert(!tekst.includes(verboden), `log bevat "${verboden}"`);
}
/* Netwerkfout en ongeldige JSON, zonder Referer. */
{
  const { logs } = await met(async url => {
    if (String(url).includes("visualcrossing")) throw new TypeError("fetch failed");
    return new Response("geen json", { status: 200 });
  });
  assert.deepEqual(logs.map(l => [l.provider, l.categorie, l.pagina]), [["visualcrossing", "netwerk", "onbekend"], ["weatherapi", "ongeldige_json", "onbekend"]]);
}
console.log("Forecast-providerfouten: gesloten categorieën, paginatype en request-ID in het log; geen sleutels, URL's of coördinaten.");
