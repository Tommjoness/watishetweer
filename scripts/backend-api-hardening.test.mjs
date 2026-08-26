import assert from "node:assert/strict";

import neerslagRoute from "../api/neerslag.mjs";
import plaatsnaamRoute from "../api/plaatsnaam.mjs";
import waarschuwingenRoute from "../api/waarschuwingen.mjs";

const BASE = "https://watishetweer.nl";

async function json(response) {
  const tekst = await response.text();
  return tekst ? JSON.parse(tekst) : null;
}

async function metFetchMock(mock, fn) {
  const origineel = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await fn();
  } finally {
    globalThis.fetch = origineel;
  }
}

{
  const r = await neerslagRoute.fetch(new Request(BASE + "/api/neerslag?lat=52.37&lon=4.90", { method: "POST" }));
  assert.equal(r.status, 405);
  assert.equal(r.headers.get("allow"), "GET, HEAD");
  assert.match(r.headers.get("cache-control") || "", /no-store/i);
}

{
  const r = await neerslagRoute.fetch(new Request(BASE + "/api/neerslag?lat=abc&lon=4.90"));
  const body = await json(r);
  assert.equal(r.status, 400);
  assert.equal(body?.reden, "ongeldige coördinaten");
  assert.match(r.headers.get("cache-control") || "", /no-store/i);
  assert.equal(r.headers.get("cloudflare-cdn-cache-control"), null);
}

{
  const r = await plaatsnaamRoute.fetch(new Request(BASE + "/api/plaatsnaam?lat=&lon=4.90"));
  const body = await json(r);
  assert.equal(r.status, 400);
  assert.equal(body?.reden, "ongeldige coordinaten");
  assert.match(r.headers.get("cache-control") || "", /no-store/i);
  assert.equal(r.headers.get("cloudflare-cdn-cache-control"), null);
}

{
  const r = await waarschuwingenRoute.fetch(new Request(BASE + "/api/waarschuwingen?lat=91&lon=4.90"));
  const body = await json(r);
  assert.equal(r.status, 400);
  assert.equal(body?.reden, "geen geldige locatie");
  assert.match(r.headers.get("cache-control") || "", /no-store/i);
  assert.equal(r.headers.get("cloudflare-cdn-cache-control"), null);
}

await metFetchMock(async () => {
  throw new Error("geheime upstream detail");
}, async () => {
  const r = await plaatsnaamRoute.fetch(new Request(BASE + "/api/plaatsnaam?lat=52.3702&lon=4.8952"));
  const body = await json(r);
  assert.equal(r.status, 200);
  assert.deepEqual(body, { naam: null, land: null, reden: "plaatsnaambron tijdelijk niet beschikbaar" });
  assert.doesNotMatch(JSON.stringify(body), /geheime upstream detail/i);
  assert.equal(r.headers.get("cloudflare-cdn-cache-control"), "s-maxage=30, stale-while-revalidate=30");
  assert.equal(r.headers.get("cache-control"), "public, max-age=0, must-revalidate");
});

await metFetchMock(async () => {
  throw new Error("KNMI intern detail");
}, async () => {
  const r = await neerslagRoute.fetch(new Request(BASE + "/api/neerslag?lat=52.3702&lon=4.8952&land=NL"));
  const body = await json(r);
  assert.equal(r.status, 200);
  assert.equal(body?.beschikbaar, false);
  assert.equal(body?.provider, "knmi");
  assert.equal(body?.reden, "KNMI-neerslag tijdelijk niet beschikbaar");
  assert.doesNotMatch(JSON.stringify(body), /KNMI intern detail/i);
  assert.equal(r.headers.get("cloudflare-cdn-cache-control"), "s-maxage=15, stale-while-revalidate=15");
  assert.equal(r.headers.get("cache-control"), "public, max-age=0, must-revalidate");
});

await metFetchMock(async () => {
  throw new Error("MeteoAlarm intern detail");
}, async () => {
  const r = await waarschuwingenRoute.fetch(new Request(BASE + "/api/waarschuwingen?lat=52.3702&lon=4.8952&land=NL"));
  const body = await json(r);
  assert.equal(r.status, 200);
  assert.equal(body?.dekking, false);
  assert.equal(body?.reden, "bron onbereikbaar");
  assert.doesNotMatch(JSON.stringify(body), /MeteoAlarm intern detail/i);
  assert.equal(r.headers.get("cloudflare-cdn-cache-control"), "s-maxage=30, stale-while-revalidate=30");
  assert.equal(r.headers.get("cache-control"), "public, max-age=0, must-revalidate");
});

{
  const r = await neerslagRoute.fetch(new Request(BASE + "/api/neerslag?lat=abc&lon=4.90", { method: "HEAD" }));
  assert.equal(r.status, 400);
  assert.equal(await r.text(), "");
}

console.log("backend API hardening: ok");
