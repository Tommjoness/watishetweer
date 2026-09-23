"use strict";

const assert=require("assert");
const handler=require("../lib/waarschuwingen.cjs");

const COMPAT="https://feeds.meteoalarm.org/api/v1/warnings/feeds-netherlands";

class MemoryCache{
  constructor(){this.map=new Map();this.puts=0;}
  async match(request){const r=this.map.get(request.url);return r?r.clone():undefined;}
  async put(request,response){this.puts+=1;this.map.set(request.url,response.clone());}
}

/* Eén CAP-waarschuwing met een polygoon rond Noord-Holland (lat,lon-paren). */
const feed={warnings:[{info:[{
  event:"Zware windstoten",severity:"Moderate",description:"Windstoten tot 90 km/u.",
  onset:"2026-09-23T10:00:00Z",expires:"2026-09-23T20:00:00Z",
  area:[{areaDesc:"Noord-Holland",polygon:"52.0,4.4 53.0,4.4 53.0,5.3 52.0,5.3 52.0,4.4"}]
}]}]};

function vraag(lat,lon){
  let status=null,body=null;
  const res={setHeader(){},status(c){status=c;return res;},json(v){body=v;return res;}};
  return handler({query:{lat:String(lat),lon:String(lon),land:"NL"}},res).then(()=>({status,body}));
}

(async()=>{
  const origineleFetch=globalThis.fetch;
  const origineleCaches=globalThis.caches;
  const downloads=[];
  let antwoord=()=>new Response(JSON.stringify(feed),{status:200,headers:{"Content-Type":"application/json"}});
  globalThis.fetch=async url=>{downloads.push(String(url));return antwoord();};
  try{
    /* Zonder Cloudflare-cache (Node): gedrag ongewijzigd, iedere aanvraag downloadt. */
    delete globalThis.caches;
    await vraag(52.3702,4.8952);
    await vraag(52.3874,4.6462);
    assert.equal(downloads.filter(u=>u===COMPAT).length,2,"zonder caches.default blijft iedere aanvraag de feed downloaden");

    /* Met caches.default: één download per landfeed, ook voor andere coördinaten. */
    downloads.length=0;
    const cache=new MemoryCache();
    globalThis.caches={default:cache};
    const amsterdam=await vraag(52.3702,4.8952);
    const haarlem=await vraag(52.3874,4.6462);
    const maastricht=await vraag(50.8514,5.6910);
    assert.equal(downloads.filter(u=>u===COMPAT).length,1,"tweede en derde coördinaat in hetzelfde land hergebruiken de gecachte feed");
    assert.equal(cache.puts,1);
    assert.equal(amsterdam.body.dekking,true);
    assert.equal(amsterdam.body.lijst.length,1,"punt binnen het gebied houdt zijn waarschuwing");
    assert.equal(haarlem.body.lijst.length,1);
    assert.equal(maastricht.body.dekking,true);
    assert.equal(maastricht.body.lijst.length,0,"de gecachte feed wordt per coördinaat opnieuw tegen het gebied getoetst");
    for(const [sleutel,response] of cache.map){
      assert.ok(sleutel.startsWith(COMPAT+"?__wiw_feed_cache=v1"),"feedcache gebruikt een eigen, geversioneerde sleutel");
      assert.match(response.headers.get("cache-control")||"",/max-age=300/,"feedcache bewaart maximaal vijf minuten");
    }

    /* Een ongeldige (niet-JSON) compatibiliteitsrespons wordt nooit gecachet. */
    downloads.length=0;
    const leeg=new MemoryCache();
    globalThis.caches={default:leeg};
    antwoord=url=>new Response("<html>storing</html>",{status:200,headers:{"Content-Type":"text/html"}});
    await vraag(52.3702,4.8952);
    assert.equal(leeg.puts,0,"een storingspagina mag de feedcache niet vullen");

    /* Een kapotte cache valt stil terug op de gewone download. */
    downloads.length=0;
    antwoord=()=>new Response(JSON.stringify(feed),{status:200,headers:{"Content-Type":"application/json"}});
    globalThis.caches={default:{async match(){throw new Error("cache stuk");},async put(){throw new Error("cache stuk");}}};
    const zonderCache=await vraag(52.3702,4.8952);
    assert.equal(zonderCache.body.dekking,true);
    assert.equal(zonderCache.body.lijst.length,1,"cachefout mag waarschuwingen niet blokkeren");
  }finally{
    globalThis.fetch=origineleFetch;
    if(origineleCaches===undefined)delete globalThis.caches;else globalThis.caches=origineleCaches;
  }
  console.log("MeteoAlarm-landfeedcache: één download per landfeed, per-punttoetsing behouden, storing niet gecachet en cachefout faalt veilig.");
})().catch(error=>{console.error(error);process.exit(1);});
