"use strict";

/* Grote MeteoAlarm-landfeed (Spanje, 4 oktober: 3,5 MB, ruim 7 s):
   - de bezoeker wacht hooguit 4 s en krijgt dan het Atom-antwoord;
   - in de Cloudflare-runtime (waitUntil) loopt de download door en komt een
     compacte kopie in de cache, zodat de volgende bezoeker plaats-specifiek is;
   - een kopie van 5–15 minuten oud wordt gebruikt terwijl op de achtergrond een
     nieuwe wordt opgehaald; ouder dan 15 minuten telt niet;
   - zonder waitUntil (Node) blijft het oude gedrag: afbreken, niets bewaren;
   - de compacte feed geeft exact dezelfde uitkomst als de volledige. */

const assert=require("assert");
const path=require("path");
const PAD=path.join(__dirname,"..","lib","waarschuwingen.cjs");
const COMPAT="https://feeds.meteoalarm.org/api/v1/warnings/feeds-spain";
const ATOM="https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-spain";
const MADRID={lat:40.4168,lon:-3.7038};

class MemoryCache{
  constructor(){this.map=new Map();this.puts=0;}
  async match(request){const r=this.map.get(request.url);return r?r.clone():undefined;}
  async put(request,response){this.puts+=1;this.map.set(request.url,response.clone());}
}

const uur=ms=>new Date(Date.now()+ms).toISOString();
const param=(niveau,soort)=>[{valueName:"awareness_level",value:niveau},{valueName:"awareness_type",value:soort},{valueName:"iets_anders",value:"x"}];
const info=(taal,extra)=>Object.assign({language:taal,event:"Aviso",headline:"Aviso amarillo",severity:"Moderate",
  onset:uur(-3600000),expires:uur(6*3600000),parameter:param("2; yellow; Moderate","10; Rain"),
  description:"Lluvia "+taal,instruction:"Precaución",web:"https://www.aemet.es",contact:"AEMET",category:["Met"],
  area:[{areaDesc:"Metropolitana y Henares",geocode:[{valueName:"EMMA_ID",value:"ES219"},{valueName:"NUTS3",value:"ES300"}]}]},extra||{});
const feed={warnings:[
  {alert:{identifier:"madrid",info:[info("es-ES"),info("en-GB",{description:"Rain in Madrid"})]}},
  /* verlopen: valt weg */
  {alert:{info:[info("es-ES",{expires:uur(-60000)}),info("en-GB",{expires:uur(-60000)})]}},
  /* groen: valt weg */
  {alert:{info:[info("es-ES",{parameter:param("1; green; Minor","10; Rain")}),info("en-GB",{parameter:param("1; green; Minor","10; Rain")})]}},
  /* polygoon elders, Nederlands blok, lange tekst en een tekst van alleen spaties */
  {alert:{info:[info("fr-FR"),info("nl-NL",{description:"Lange tekst. ".repeat(400),area:[{areaDesc:"Elders",polygon:"38,1 39,1 39,2 38,2 38,1"}]}),
    info("en-GB",{description:"   ",area:{areaDesc:"Elders",circle:"38.5,1.5 20"}})]}}
]};
const feedTekst=JSON.stringify(feed);
const legeAtom='<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>';

function laad(){delete require.cache[PAD];return require(PAD);}
function vraag(handler,extra){
  let body=null;
  const res={setHeader(){},status(){return res;},json(v){body=v;return res;}};
  return handler(Object.assign({query:{lat:String(MADRID.lat),lon:String(MADRID.lon),land:"ES"}},extra||{}),res).then(()=>body);
}
/* Nep-fetch: de compatibiliteitsfeed levert zijn body pas na `bodyMs` en
   respecteert het AbortSignal, net als de echte runtime. */
function nepFetch(log,{bodyMs=0}={}){
  return async(url,opts)=>{
    const u=String(url);log.push(u);
    const signal=opts&&opts.signal;
    if(u===COMPAT)return{ok:true,headers:{get:n=>/content-length/i.test(n)?"3481266":null},
      text:()=>new Promise((klaar,fout)=>{
        const t=setTimeout(()=>klaar(feedTekst),bodyMs);
        if(signal)signal.addEventListener("abort",()=>{clearTimeout(t);fout(new Error("afgebroken"));});
      })};
    if(u===ATOM)return{ok:true,headers:{get:()=>"100"},text:async()=>legeAtom};
    throw new Error("onverwachte url "+u);
  };
}
async function metOmgeving(fetchImpl,cache,fn){
  const oudFetch=globalThis.fetch,oudCaches=globalThis.caches;
  globalThis.fetch=fetchImpl;
  if(cache)globalThis.caches={default:cache};else delete globalThis.caches;
  try{return await fn();}
  finally{globalThis.fetch=oudFetch;if(oudCaches===undefined)delete globalThis.caches;else globalThis.caches=oudCaches;}
}
const compatInCache=cache=>[...cache.map.keys()].filter(k=>k.startsWith(COMPAT+"?__wiw_feed_cache=v2"));

(async()=>{
  /* 1. Compacte feed: kleiner, zelfde uitkomst voor ieder punt en beide talen. */
  {
    const {compacteFeed,uitCap}=laad()._intern;
    const compact=compacteFeed(JSON.parse(feedTekst));
    assert.equal(compact.warnings.length,2,"verlopen en groene berichten vallen weg");
    assert.ok(JSON.stringify(compact).length<feedTekst.length/2,"compacte feed is veel kleiner");
    const madrid=compact.warnings[0].alert.info;
    assert.deepEqual(madrid.map(i=>i.language),["en-GB"],"alleen de taalblokken die kiesInfo kiest (Spaans valt weg)");
    assert.equal(madrid[0].web,undefined,"ongebruikte velden vallen weg");
    assert.deepEqual(madrid[0].area[0].geocode,[{valueName:"EMMA_ID",value:"ES219"}],"alleen de EMMA_ID-code blijft");
    assert.deepEqual(madrid[0].parameter.map(p=>p.valueName),["awareness_level","awareness_type"]);
    assert.deepEqual(compact.warnings[1].alert.info.map(i=>i.language),["nl-NL","en-GB"],"het Franse blok kiest kiesInfo nooit");
    for(const [lat,lon] of [[MADRID.lat,MADRID.lon],[38.5,1.5],[38.6,1.6],[41.98,2.82],[37,-6]])
      for(const taal of ["nl","en"])
        assert.deepEqual(uitCap(compact,lat,lon,Date.now(),taal),uitCap(JSON.parse(feedTekst),lat,lon,Date.now(),taal),
          "compacte feed geeft dezelfde uitkomst ("+lat+","+lon+","+taal+")");
  }

  /* 2. Cloudflare-runtime: te trage download → Atom nu, compacte feed daarna. */
  {
    const handler=laad(),cache=new MemoryCache(),log=[],achtergrond=[];
    const waitUntil=p=>{achtergrond.push(p);};
    await metOmgeving(nepFetch(log,{bodyMs:4600}),cache,async()=>{
      const start=Date.now();
      const eerste=await vraag(handler,{waitUntil});
      const duur=Date.now()-start;
      assert.ok(duur<5000,"bezoeker wacht niet op de volledige download ("+duur+" ms)");
      assert.equal(eerste.dekking,true);
      assert.equal(eerste.plaatsSpecifiek,false,"eerste bezoeker krijgt het Atom-antwoord");
      assert.ok(log.includes(ATOM));
      assert.equal(achtergrond.length,1,"de lopende download gaat naar waitUntil");
      await Promise.all(achtergrond);
      assert.equal(compatInCache(cache).length,1,"na de achtergronddownload staat de compacte feed in de cache");
      const tweede=await vraag(handler,{waitUntil});
      assert.equal(tweede.plaatsSpecifiek,true,"volgende bezoeker krijgt plaats-specifieke waarschuwingen");
      assert.equal(tweede.lijst.length,1);
      assert.equal(tweede.lijst[0].gebied,"Metropolitana y Henares");
      assert.equal(log.filter(u=>u===COMPAT).length,1,"tweede bezoeker downloadt niets opnieuw");
    });
  }

  /* 3. Zonder waitUntil (Node): afbreken na 4 s, niets bewaren — oud gedrag. */
  {
    const handler=laad(),cache=new MemoryCache(),log=[];
    await metOmgeving(nepFetch(log,{bodyMs:6000}),cache,async()=>{
      const uit=await vraag(handler);
      assert.equal(uit.plaatsSpecifiek,false);
      assert.equal(compatInCache(cache).length,0,"zonder waitUntil komt een afgebroken download niet in de cache");
    });
  }

  /* 4. Kopie van 10 minuten: gebruiken en op de achtergrond verversen. */
  {
    const handler=laad(),cache=new MemoryCache(),log=[],achtergrond=[];
    const {compacteFeed}=handler._intern;
    const zet=(leeftijdS)=>{
      const sleutel=COMPAT+"?__wiw_feed_cache=v2";
      cache.map.set(sleutel,new Response(JSON.stringify(compacteFeed(JSON.parse(feedTekst))),{headers:{
        "Content-Type":"application/json","X-WIW-Feed-Opgeslagen":String(Date.now()-leeftijdS*1000)}}));
    };
    await metOmgeving(nepFetch(log,{bodyMs:800}),cache,async()=>{
      zet(600);
      const start=Date.now();
      const uit=await vraag(handler,{waitUntil:p=>{achtergrond.push(p);}});
      assert.equal(uit.plaatsSpecifiek,true,"kopie van 10 minuten wordt gebruikt");
      assert.ok(Date.now()-start<500,"de bezoeker wacht niet op de verversing");
      assert.equal(achtergrond.length,1,"wel één verversing op de achtergrond");
      await Promise.all(achtergrond);
      assert.equal(log.filter(u=>u===COMPAT).length,1);
      const opgeslagen=Number((await cache.match(new Request(COMPAT+"?__wiw_feed_cache=v2"))).headers.get("x-wiw-feed-opgeslagen"));
      assert.ok(Date.now()-opgeslagen<5000,"verversing bewaart een nieuwe kopie");

      /* zonder waitUntil telt een kopie van 10 minuten niet: gewone download */
      log.length=0;zet(600);
      const node=await vraag(handler);
      assert.equal(node.plaatsSpecifiek,true);
      assert.equal(log.filter(u=>u===COMPAT).length,1,"zonder waitUntil wordt een oude kopie niet gebruikt");

      /* ouder dan 15 minuten telt nooit */
      log.length=0;achtergrond.length=0;zet(1000);
      await vraag(handler,{waitUntil:p=>{achtergrond.push(p);}});
      assert.equal(log.filter(u=>u===COMPAT).length,1,"kopie van ruim 16 minuten wordt niet gebruikt");
      assert.equal(achtergrond.length,0,"snelle download in de voorgrond, geen achtergrondtaak");

      /* een kopie zonder opslagmoment telt nooit */
      log.length=0;
      cache.map.set(COMPAT+"?__wiw_feed_cache=v2",new Response(feedTekst,{headers:{"Content-Type":"application/json"}}));
      await vraag(handler,{waitUntil:()=>{}});
      assert.equal(log.filter(u=>u===COMPAT).length,1,"kopie zonder opslagmoment wordt niet gebruikt");
    });
  }

  /* 5. Twee bezoekers in het venster van 5–15 minuten: één verversing per isolate. */
  {
    const handler=laad(),cache=new MemoryCache(),log=[],achtergrond=[];
    const {compacteFeed}=handler._intern;
    cache.map.set(COMPAT+"?__wiw_feed_cache=v2",new Response(JSON.stringify(compacteFeed(JSON.parse(feedTekst))),{headers:{
      "Content-Type":"application/json","X-WIW-Feed-Opgeslagen":String(Date.now()-600000)}}));
    await metOmgeving(nepFetch(log,{bodyMs:300}),cache,async()=>{
      const waitUntil=p=>{achtergrond.push(p);};
      const [a,b]=await Promise.all([vraag(handler,{waitUntil}),vraag(handler,{waitUntil})]);
      assert.equal(a.plaatsSpecifiek,true);assert.equal(b.plaatsSpecifiek,true);
      assert.equal(achtergrond.length,1,"twee bezoekers, één achtergrondverversing");
      await Promise.all(achtergrond);
      assert.equal(log.filter(u=>u===COMPAT).length,1);
    });
  }

  /* 6. De route geeft waitUntil van Cloudflare door aan de handler. */
  {
    /* Via een kopie van 10 minuten: die geeft direct antwoord en ververst via waitUntil. */
    const log=[],achtergrond=[],cache=new MemoryCache();
    await metOmgeving(nepFetch(log,{bodyMs:10}),cache,async()=>{
      delete require.cache[PAD];
      cache.map.set(COMPAT+"?__wiw_feed_cache=v2",new Response(feedTekst,{headers:{
        "Content-Type":"application/json","X-WIW-Feed-Opgeslagen":String(Date.now()-600000)}}));
      const worker=(await import(path.join(__dirname,"..","api","waarschuwingen.mjs"))).default;
      const r=await worker.fetch(new Request("https://watishetweer.nl/api/waarschuwingen?lat=40.4168&lon=-3.7038&land=ES"),{},{waitUntil:p=>{achtergrond.push(p);}});
      assert.equal(r.status,200);
      assert.equal(achtergrond.length,1,"api/waarschuwingen.mjs geeft ctx.waitUntil door");
      await Promise.all(achtergrond);
    });
    const fn=require("fs").readFileSync(path.join(__dirname,"..","functions","api","waarschuwingen.js"),"utf8");
    assert.ok(fn.includes("worker.fetch(context.request, context.env, context)"),"Pages Function geeft de context (met waitUntil) door");
  }

  console.log("MeteoAlarm grote landfeed: bezoeker wacht hooguit 4 s, download loopt door via waitUntil, compacte feed (zelfde uitkomst) in de cache, verversen op de achtergrond, Node-gedrag ongewijzigd.");
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
