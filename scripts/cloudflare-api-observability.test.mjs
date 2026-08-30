import assert from "node:assert/strict";
import { metEdgeCache, _intern } from "../lib/cloudflare-edge-cache.mjs";

function jsonResponse(body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}

async function metGevangenLogs(actie) {
  const logs = [];
  const warnings = [];
  const origineelLog = console.log;
  const origineelWarn = console.warn;
  try {
    console.log = (...args) => logs.push(args);
    console.warn = (...args) => warnings.push(args);
    const resultaat = await actie();
    return { resultaat, logs, warnings };
  } finally {
    console.log = origineelLog;
    console.warn = origineelWarn;
  }
}

function requestEvents(logs) {
  return logs
    .map(args => args[0])
    .filter(value => value && typeof value === "object" && value.event === "wiw_api_request");
}

function controleerRequestEvent(event, response, cacheStatus) {
  assert.deepEqual(
    Object.keys(event).sort(),
    ["duration_ms", "edge_cache", "event", "method", "request_id", "route", "status"].sort(),
    "observability houdt bewust een kleine allowlist van velden"
  );
  assert.equal(event.event, "wiw_api_request");
  assert.equal(event.route, "neerslag");
  assert.equal(event.method, "GET");
  assert.equal(event.status, response.status);
  assert.equal(event.edge_cache, cacheStatus);
  assert.equal(event.request_id, response.headers.get("x-wiw-request-id"));
  assert.ok(Number.isInteger(event.duration_ms) && event.duration_ms >= 0);
}

{
  const request = new Request(
    "https://watishetweer.nl/api/neerslag?lat=52.12345&lon=4.98765&land=NL&q=private-place",
    {
      headers: {
        "Cache-Control": "no-cache",
        "Authorization": "Bearer supersecret",
        "Cookie": "sid=verysecret",
        "User-Agent": "private-agent"
      }
    }
  );

  const { resultaat: response, logs } = await metGevangenLogs(() => metEdgeCache(
    { request },
    "neerslag",
    async () => jsonResponse({ beschikbaar: true, provider: "knmi" })
  ));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-wiw-edge-cache"), "BYPASS");
  const requestId = response.headers.get("x-wiw-request-id");
  assert.ok(requestId && requestId.length >= 12, "iedere API-response krijgt een niet-persoonlijk correlatie-id");
  assert.deepEqual(await response.clone().json(), { beschikbaar: true, provider: "knmi" }, "observability consumeert de responsebody niet");

  const events = requestEvents(logs);
  assert.equal(events.length, 1, "BYPASS schrijft precies één requestevent");
  controleerRequestEvent(events[0], response, "BYPASS");

  const serialized = JSON.stringify(events[0]);
  for (const geheim of ["52.12345", "4.98765", "private-place", "supersecret", "verysecret", "private-agent", "?lat=", "land=NL"]) {
    assert.equal(serialized.includes(geheim), false, `observability mag ${geheim} niet loggen`);
  }
}

{
  let opgeslagen = null;
  const request = new Request("https://watishetweer.nl/api/neerslag?lat=52.12345&lon=4.98765&land=NL");
  const cache = {
    async match() { return null; },
    async put(_key, response) { opgeslagen = response.clone(); }
  };
  const { resultaat: response, logs } = await metGevangenLogs(() => metEdgeCache(
    { request, cache },
    "neerslag",
    async () => jsonResponse(
      { beschikbaar: true, provider: "knmi" },
      { "Cloudflare-CDN-Cache-Control": "s-maxage=60" }
    )
  ));

  assert.equal(response.headers.get("x-wiw-edge-cache"), "MISS");
  assert.ok(response.headers.get("x-wiw-request-id"));
  assert.ok(opgeslagen, "MISS schrijft een cachekopie");
  assert.equal(opgeslagen.headers.get("x-wiw-request-id"), null, "correlatie-id wordt nooit in de gedeelde cache opgeslagen");
  assert.equal(opgeslagen.headers.get("x-wiw-edge-cache"), null, "cachebewijs wordt nooit in de gedeelde cache opgeslagen");
  assert.deepEqual(await response.clone().json(), { beschikbaar: true, provider: "knmi" });
  const events = requestEvents(logs);
  assert.equal(events.length, 1, "MISS schrijft precies één requestevent");
  controleerRequestEvent(events[0], response, "MISS");
}

{
  let originAangeroepen = false;
  const request = new Request("https://watishetweer.nl/api/neerslag?lat=52.12345&lon=4.98765&land=NL");
  const cache = {
    async match() {
      return jsonResponse(
        { beschikbaar: true, provider: "knmi" },
        {
          "X-WIW-Request-ID": "oude-cache-id",
          "X-WIW-Edge-Cache": "MISS",
          "Cache-Control": "public, max-age=60"
        }
      );
    },
    async put() { throw new Error("put hoort bij HIT niet te draaien"); }
  };
  const { resultaat: response, logs } = await metGevangenLogs(() => metEdgeCache(
    { request, cache },
    "neerslag",
    async () => {
      originAangeroepen = true;
      return jsonResponse({ beschikbaar: true, provider: "knmi" });
    }
  ));

  assert.equal(originAangeroepen, false, "HIT raakt de provider niet");
  assert.equal(response.headers.get("x-wiw-edge-cache"), "HIT");
  assert.ok(response.headers.get("x-wiw-request-id"));
  assert.notEqual(response.headers.get("x-wiw-request-id"), "oude-cache-id", "iedere HIT krijgt een vers correlatie-id");
  const events = requestEvents(logs);
  assert.equal(events.length, 1, "HIT schrijft precies één requestevent");
  controleerRequestEvent(events[0], response, "HIT");
}

{
  const requestMetGeheim = new Request("https://watishetweer.nl/api/plaatsnaam?lat=51.11111&lon=5.22222&q=zeer-prive");
  const { resultaat: response, logs, warnings } = await metGevangenLogs(() => metEdgeCache(
    {
      request: requestMetGeheim,
      cache: {
        async match() { throw new Error("cachefout voor https://watishetweer.nl/api/plaatsnaam?lat=51.11111&lon=5.22222&q=zeer-prive"); },
        async put() {}
      }
    },
    "plaatsnaam",
    async () => jsonResponse({ naam: null, land: null, reden: "plaatsnaambron tijdelijk niet beschikbaar" })
  ));

  assert.equal(response.headers.get("x-wiw-edge-cache"), "BYPASS");
  assert.ok(response.headers.get("x-wiw-request-id"));
  assert.equal(requestEvents(logs).length, 1, "ook een cachefout houdt één requestevent");

  const fout = warnings.map(args => args[0]).find(value => value && value.event === "wiw_edge_cache_error");
  assert.ok(fout, "cachefout krijgt een gestructureerd privacyarm event");
  assert.deepEqual(Object.keys(fout).sort(), ["error_name", "event", "operation", "route"].sort());
  assert.equal(fout.operation, "match");
  const foutTekst = JSON.stringify(fout);
  for (const geheim of ["51.11111", "5.22222", "zeer-prive", "https://watishetweer.nl/api/"]) {
    assert.equal(foutTekst.includes(geheim), false, `cachefoutlogging mag ${geheim} niet lekken`);
  }
}

const vast = _intern.observabilityRecord(
  "plaatsnaam",
  new Request("https://watishetweer.nl/api/plaatsnaam?lat=1&lon=2"),
  new Response(null, { status: 204 }),
  "HIT",
  100,
  "request-test",
  142.4
);
assert.equal(vast.duration_ms, 42);
assert.equal(vast.status, 204);
assert.equal(vast.request_id, "request-test");
assert.equal(Object.isFrozen(vast), true);
assert.equal(_intern.REQUEST_ID_HEADER, "X-WIW-Request-ID");

console.log("Cloudflare API-observability: HIT/MISS/BYPASS correleerbaar, bodyveilig en zonder URL/coördinaten/IP/clientheaders, ook bij cachefouten.");
