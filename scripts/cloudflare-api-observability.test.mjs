import assert from "node:assert/strict";
import { metEdgeCache, _intern } from "../lib/cloudflare-edge-cache.mjs";

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

const logs = [];
const origineelLog = console.log;
let response;
try {
  console.log = (...args) => logs.push(args);
  response = await metEdgeCache(
    { request },
    "neerslag",
    async () => new Response(JSON.stringify({ beschikbaar: true, provider: "knmi" }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    })
  );
} finally {
  console.log = origineelLog;
}

assert.equal(response.status, 200);
assert.equal(response.headers.get("x-wiw-edge-cache"), "BYPASS");
const requestId = response.headers.get("x-wiw-request-id");
assert.ok(requestId && requestId.length >= 12, "iedere API-response krijgt een niet-persoonlijk correlatie-id");

const events = logs
  .map(args => args[0])
  .filter(value => value && typeof value === "object" && value.event === "wiw_api_request");
assert.equal(events.length, 1, "precies één gestructureerd requestevent per API-aanroep");
const event = events[0];
assert.deepEqual(
  Object.keys(event).sort(),
  ["duration_ms", "edge_cache", "event", "method", "request_id", "route", "status"].sort(),
  "observability houdt bewust een kleine allowlist van velden"
);
assert.equal(event.route, "neerslag");
assert.equal(event.method, "GET");
assert.equal(event.status, 200);
assert.equal(event.edge_cache, "BYPASS");
assert.equal(event.request_id, requestId);
assert.ok(Number.isInteger(event.duration_ms) && event.duration_ms >= 0);

const serialized = JSON.stringify(event);
for (const geheim of ["52.12345", "4.98765", "private-place", "supersecret", "verysecret", "private-agent", "?lat=", "land=NL"]) {
  assert.equal(serialized.includes(geheim), false, `observability mag ${geheim} niet loggen`);
}

{
  const warnings = [];
  const requestMetGeheim = new Request("https://watishetweer.nl/api/plaatsnaam?lat=51.11111&lon=5.22222&q=zeer-prive");
  const origineelWarn = console.warn;
  const origineelLog2 = console.log;
  try {
    console.warn = (...args) => warnings.push(args);
    console.log = () => {};
    const uit = await metEdgeCache(
      {
        request: requestMetGeheim,
        cache: {
          async match() { throw new Error("cachefout voor https://watishetweer.nl/api/plaatsnaam?lat=51.11111&lon=5.22222&q=zeer-prive"); },
          async put() {}
        }
      },
      "plaatsnaam",
      async () => new Response(JSON.stringify({ naam: null, land: null, reden: "plaatsnaambron tijdelijk niet beschikbaar" }), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      })
    );
    assert.equal(uit.headers.get("x-wiw-edge-cache"), "BYPASS");
  } finally {
    console.warn = origineelWarn;
    console.log = origineelLog2;
  }

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

console.log("Cloudflare API-observability: gestructureerd, correleerbaar en zonder URL/coördinaten/IP/clientheaders, ook bij cachefouten.");
