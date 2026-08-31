import assert from "node:assert/strict";
import worker from "../api/luchtkwaliteit.mjs";

{
  const r=await worker.fetch(new Request("https://watishetweer.nl/api/luchtkwaliteit?lat=abc&lon=5.26&land=NL"));
  assert.equal(r.status,400);
  assert.match(r.headers.get("content-type")||"",/application\/json/);
  assert.equal(r.headers.get("cache-control"),"private, no-store");
  const body=await r.json();
  assert.equal(body.beschikbaar,false);
  assert.equal(body.reden,"ongeldige coördinaten");
}

{
  const r=await worker.fetch(new Request("https://watishetweer.nl/api/luchtkwaliteit?lat=50.85&lon=4.35&land=BE"));
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.beschikbaar,false);
  assert.equal(body.provider,null);
  assert.equal(body.reden,"geen Nederlandse LKI voor deze locatie");
  assert.match(r.headers.get("cloudflare-cdn-cache-control")||"",/s-maxage=300/);
}

{
  const r=await worker.fetch(new Request("https://watishetweer.nl/api/luchtkwaliteit?lat=50.85&lon=4.35&land=BE",{method:"HEAD"}));
  assert.equal(r.status,200);
  assert.equal(await r.text(),"");
}

{
  const r=await worker.fetch(new Request("https://watishetweer.nl/api/luchtkwaliteit",{method:"POST"}));
  assert.equal(r.status,405);
  assert.equal(r.headers.get("allow"),"GET, HEAD");
  assert.equal(r.headers.get("cache-control"),"private, no-store");
}

console.log("Luchtkwaliteit API-contract: methods, scope en cacheheaders geslaagd.");
