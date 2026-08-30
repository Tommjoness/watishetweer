import assert from "node:assert/strict";
import { canoniekeCacheUrl, metEdgeCache, _intern } from "../lib/cloudflare-edge-cache.mjs";

const BASE = "https://watishetweer.nl";

class MemoryCache {
  constructor(){ this.map = new Map(); this.puts = 0; this.matches = 0; }
  async match(request){
    this.matches += 1;
    const r = this.map.get(request.url);
    return r ? r.clone() : undefined;
  }
  async put(request,response){
    this.puts += 1;
    this.map.set(request.url,response.clone());
  }
}

function jsonResponse(body, edge="s-maxage=120, stale-while-revalidate=180"){
  return new Response(JSON.stringify(body),{
    status:200,
    headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"public, max-age=0, must-revalidate",
      "Cloudflare-CDN-Cache-Control":edge
    }
  });
}

async function run(context,route,fn){
  const pending=[];
  const r=await metEdgeCache({...context,waitUntil:p=>pending.push(Promise.resolve(p))},route,fn);
  await Promise.all(pending);
  return r;
}

{
  const a=canoniekeCacheUrl(new Request(BASE+"/api/plaatsnaam?lat=52.37020&lon=4.89520&rommel=1"),"plaatsnaam");
  const b=canoniekeCacheUrl(new Request(BASE+"/api/plaatsnaam?lon=4.8952&lat=52.3702"),"plaatsnaam");
  assert.equal(a,b);
  assert.match(a,/lat=52\.3702/);
  assert.match(a,/lon=4\.8952/);
  assert.doesNotMatch(a,/rommel/);
}

{
  const a=canoniekeCacheUrl(new Request(BASE+"/api/neerslag?lat=52.370201&lon=4.895201&land=nl"),"neerslag");
  const b=canoniekeCacheUrl(new Request(BASE+"/api/neerslag?lon=4.895204&land=NL&lat=52.370204"),"neerslag");
  const c=canoniekeCacheUrl(new Request(BASE+"/api/neerslag?lat=52.370216&lon=4.895201&land=NL"),"neerslag");
  assert.equal(a,b,"KNMI-equivalente vijfdecimalenpunten horen één cacheobject te delen");
  assert.notEqual(a,c,"een ander KNMI-vijfdecimalenpunt mag niet botsen");
  assert.match(a,/land=NL/);
}

{
  const a=canoniekeCacheUrl(new Request(BASE+"/api/waarschuwingen?lat=52.37020&lon=4.89520&land=nl"),"waarschuwingen");
  const b=canoniekeCacheUrl(new Request(BASE+"/api/waarschuwingen?lon=4.8952&lat=52.3702&land=NL"),"waarschuwingen");
  const c=canoniekeCacheUrl(new Request(BASE+"/api/waarschuwingen?lat=52.37021&lon=4.8952&land=NL"),"waarschuwingen");
  assert.equal(a,b,"alleen numeriek equivalente waarschuwingcoördinaten worden gecanoniseerd");
  assert.notEqual(a,c,"waarschuwingpunten worden niet ruimtelijk afgerond");
}

{
  assert.equal(canoniekeCacheUrl(new Request(BASE+"/api/plaatsnaam?lat=91&lon=4"),"plaatsnaam"),null);
  assert.equal(canoniekeCacheUrl(new Request(BASE+"/api/plaatsnaam?lat=abc&lon=4"),"plaatsnaam"),null);
}

{
  const cache=new MemoryCache();
  let calls=0;
  const eerste=await run({request:new Request(BASE+"/api/plaatsnaam?lat=52.37020&lon=4.89520"),cache},"plaatsnaam",async()=>{
    calls+=1;return jsonResponse({naam:"Amsterdam",land:"NL",bron:"viaNominatim"},"s-maxage=86400, stale-while-revalidate=604800");
  });
  assert.equal(eerste.headers.get("x-wiw-edge-cache"),"MISS");
  assert.equal(cache.puts,1);
  assert.equal(calls,1);

  const tweede=await run({request:new Request(BASE+"/api/plaatsnaam?lon=4.8952&lat=52.3702&extra=genegeerd"),cache},"plaatsnaam",async()=>{
    calls+=1;throw new Error("cachehit had de handler niet opnieuw mogen uitvoeren");
  });
  assert.equal(tweede.headers.get("x-wiw-edge-cache"),"HIT");
  assert.equal(tweede.headers.get("cache-control"),"public, max-age=0, must-revalidate");
  assert.equal((await tweede.json()).naam,"Amsterdam");
  assert.equal(calls,1);
}

{
  const cache=new MemoryCache();
  const r=await run({request:new Request(BASE+"/api/neerslag?lat=52.37&lon=4.89&land=NL"),cache},"neerslag",async()=>
    jsonResponse({beschikbaar:false,provider:"knmi",reden:"KNMI-neerslag tijdelijk niet beschikbaar"},"s-maxage=15, stale-while-revalidate=15")
  );
  assert.equal(r.headers.get("x-wiw-edge-cache"),"BYPASS");
  assert.equal(cache.puts,0,"tijdelijke providerfouten mogen niet in caches.default terechtkomen");
}

{
  const cache=new MemoryCache();
  const r=await run({request:new Request(BASE+"/api/waarschuwingen?lat=35.68&lon=139.76&land=JP"),cache},"waarschuwingen",async()=>
    jsonResponse({bron:null,dekking:false,lijst:[],reden:"geen waarschuwingsbron voor JP",land:"JP"},"s-maxage=600, stale-while-revalidate=1800")
  );
  assert.equal(r.headers.get("x-wiw-edge-cache"),"MISS");
  assert.equal(cache.puts,1,"stabiele providerdekking mag wel worden gecachet");
}

{
  const cache=new MemoryCache();
  let calls=0;
  const r=await run({request:new Request(BASE+"/api/plaatsnaam?lat=52.37&lon=4.89",{headers:{"Cache-Control":"no-cache"}}),cache},"plaatsnaam",async()=>{
    calls+=1;return jsonResponse({naam:"Amsterdam",land:"NL"});
  });
  assert.equal(r.headers.get("x-wiw-edge-cache"),"BYPASS");
  assert.equal(cache.matches,0);
  assert.equal(cache.puts,0);
  assert.equal(calls,1);
}

{
  assert.equal(_intern.edgeTtl(jsonResponse({},"s-maxage=999999, stale-while-revalidate=1")),86400,"cache-TTL is defensief begrensd");
}

console.log("Cloudflare edge-cache regressies: ok");
