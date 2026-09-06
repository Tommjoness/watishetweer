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
  return metEdgeCache(context,route,fn);
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
  const a=canoniekeCacheUrl(new Request(BASE+"/api/forecast?lat=52.37020&lon=4.89520"),"forecast");
  const b=canoniekeCacheUrl(new Request(BASE+"/api/forecast?lon=4.89549&lat=52.37049"),"forecast");
  const c=canoniekeCacheUrl(new Request(BASE+"/api/forecast?lon=4.8956&lat=52.3706"),"forecast");
  assert.equal(a,b,"WeatherAPI-punten binnen dezelfde driedecimalencel horen één edge-cacheobject te delen");
  assert.notEqual(a,c,"een andere driedecimalencel mag niet met de WeatherAPI-cache botsen");
  assert.match(a,/lat=52\.370/);
  assert.match(a,/lon=4\.895/);
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
  assert.equal(canoniekeCacheUrl(new Request(BASE+"/api/plaatsnaam?lat=&lon=4"),"plaatsnaam"),null);
  assert.equal(canoniekeCacheUrl(new Request(BASE+"/api/plaatsnaam?lon=4"),"plaatsnaam"),null);
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
  const dagen=Array.from({length:7},(_,i)=>`2026-09-${String(6+i).padStart(2,"0")}`);
  const geldig={
    provider:"weatherapi",
    current:{temperature_2m:14},
    hourly:{time:dagen.flatMap(dag=>Array.from({length:24},(_,i)=>`${dag}T${String(i).padStart(2,"0")}:00`))},
    daily:{time:dagen}
  };
  let calls=0;
  const eerste=await run({request:new Request(BASE+"/api/forecast?lat=52.3702&lon=4.8952"),cache},"forecast",async()=>{
    calls+=1;return jsonResponse(geldig,"s-maxage=600, stale-while-revalidate=300");
  });
  assert.equal(eerste.headers.get("x-wiw-edge-cache"),"MISS");
  assert.equal(cache.puts,1);
  const tweede=await run({request:new Request(BASE+"/api/forecast?lat=52.3703&lon=4.8953"),cache},"forecast",async()=>{
    calls+=1;throw new Error("WeatherAPI cachehit had upstream niet opnieuw mogen raken");
  });
  assert.equal(tweede.headers.get("x-wiw-edge-cache"),"HIT");
  assert.equal(calls,1);
  assert.equal((await tweede.json()).provider,"weatherapi");
}

{
  const cache=new MemoryCache();
  const dagen=Array.from({length:7},(_,i)=>`2026-09-${String(6+i).padStart(2,"0")}`);
  const incompleet={
    provider:"weatherapi",
    current:{temperature_2m:14},
    hourly:{time:dagen.flatMap((dag,dagIndex)=>Array.from({length:dagIndex===3?22:24},(_,i)=>`${dag}T${String(i).padStart(2,"0")}:00`))},
    daily:{time:dagen}
  };
  const r=await run({request:new Request(BASE+"/api/forecast?lat=52.37&lon=4.89"),cache},"forecast",async()=>jsonResponse(incompleet));
  assert.equal(r.headers.get("x-wiw-edge-cache"),"BYPASS","onvolledige kalenderdag mag niet als WeatherAPI-fallback worden gecachet");
  assert.equal(cache.puts,0);
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
  cache.put=async()=>{cache.puts+=1;throw new Error("cache write stuk");};
  const r=await run({request:new Request(BASE+"/api/plaatsnaam?lat=52.37&lon=4.89"),cache},"plaatsnaam",async()=>
    jsonResponse({naam:"Amsterdam",land:"NL",bron:"viaNominatim"},"s-maxage=86400, stale-while-revalidate=604800")
  );
  assert.equal(r.status,200);
  assert.equal(r.headers.get("x-wiw-edge-cache"),"BYPASS","mislukte cachewrite mag nooit als MISS worden gerapporteerd");
  assert.equal(cache.puts,1);
  assert.equal((await r.json()).naam,"Amsterdam","cachefout mag de API-response niet breken");
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
