"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");

const root=path.join(__dirname,"..");
const analytics=fs.readFileSync(path.join(root,"posthog-analytics.js"),"utf8");
const over=fs.readFileSync(path.join(root,"over","index.html"),"utf8");
const privacy=fs.readFileSync(path.join(root,"privacy.html"),"utf8");

new vm.Script(analytics,{filename:"posthog-analytics.js"});

assert(!over.includes("geen advertentietracking of analytics"),"Over-pagina mag analytics niet ontkennen terwijl analytics actief is");
assert(over.includes("geen gebruikersaccount of advertentietracking"),"Over-pagina moet het ontbreken van account en advertentietracking blijven benoemen");
assert(over.includes("privacygerichte bezoekstatistieken"),"Over-pagina moet bezoekstatistieken transparant benoemen");
assert(privacy.includes("geen account of advertentietracking"),"Privacyverklaring moet het ontbreken van account en advertentietracking blijven benoemen");
assert(privacy.includes("privacygerichte bezoekstatistieken"),"Privacyverklaring moet privacygerichte bezoekstatistieken blijven benoemen");
assert(privacy.includes("herkomstcategorie")&&privacy.includes("dat adres zelf, de domeinnaam en eventuele zoektermen worden niet verstuurd"),"Privacyverklaring moet de grove herkomstcategorie en het niet-versturen van de verwijzer uitleggen");
assert(privacy.includes("als app of in de browser")&&privacy.includes("Welke plaatsen je hebt bewaard, gaat nooit mee."),"Privacyverklaring moet startmodus en het ja/nee-signaal voor bewaarde plaatsen uitleggen");
for(const provider of ["PostHog Cloud EU","Cloudflare Web Analytics","Google Analytics 4"]){
  assert(privacy.includes(provider),"Privacyverklaring mist analyticsprovider: "+provider);
}

function voerAnalyticsUit(opt={}){
  const requests=[];
  const handlers={};
  const q={
    value:String(opt.typedValue||""),
    addEventListener(type,fn){handlers["q:"+type]=fn;}
  };
  const local={
    getItem(key){
      if(key==="weerbriefing.ga4.consent.v1")return opt.ga4Consent||"denied";
      return null;
    },
    setItem(){}
  };
  const context={
    location:{
      protocol:"https:",
      hostname:"watishetweer.nl",
      origin:"https://watishetweer.nl",
      pathname:opt.pathname||"/",
      search:opt.search||"",
      hash:opt.hash||""
    },
    navigator:{
      globalPrivacyControl:opt.gpc===true,
      doNotTrack:opt.navigatorDnt||"0"
    },
    localStorage:local,
    window:{
      doNotTrack:opt.windowDnt||"0",
      innerWidth:1280,
      matchMedia:opt.standalone?(media=>({matches:media==="(display-mode: standalone)"})):undefined
    },
    document:{
      referrer:opt.referrer||"",
      getElementById(id){return id==="q"&&opt.withSearchInput?q:null;},
      querySelector(){return null;}
    },
    crypto:{randomUUID(){return "privacy-contract-test";}},
    fetch(url,fetchOpt){
      requests.push({url,fetchOpt});
      return Promise.resolve({ok:true});
    }
  };
  vm.runInNewContext(analytics,context,{filename:"posthog-analytics.js"});
  if(opt.triggerSearch&&handlers["q:input"])handlers["q:input"]();
  return requests.map(({url,fetchOpt})=>({url,fetchOpt,payload:JSON.parse(fetchOpt.body)}));
}

function pageviewVoor(pathname,opt={}){
  const captures=voerAnalyticsUit(Object.assign({},opt,{pathname}));
  assert(captures.length>=1,"verwacht minimaal één analyticscapture voor "+pathname);
  assert.equal(captures[0].payload.event,"$pageview","eerste event moet pageview zijn");
  return captures[0];
}

for(const alias of ["/privacy","/privacy.html"]){
  const capture=pageviewVoor(alias,{search:"?plaats=Almere&lat=52.3702",hash:"#lon=5.2141"});
  assert.equal(capture.payload.properties.$pathname,"/privacy",alias+" moet als generieke canonieke privacyroute worden verstuurd");
  assert.equal(capture.payload.properties.$current_url,"https://watishetweer.nl/privacy",alias+" mag geen querystring of hash in current_url opnemen");
  const serialized=JSON.stringify(capture.payload);
  for(const geheim of ["Almere","52.3702","5.2141","?plaats=","#lon="]){
    assert(!serialized.includes(geheim),alias+" lekt verboden URL-data naar analytics: "+geheim);
  }
}

for(const weatherPath of ["/weer/Almere","/weer/52.3702,5.2141"]){
  const capture=pageviewVoor(weatherPath,{search:"?bron=zoekveld",hash:"#detail"});
  assert.equal(capture.payload.properties.$pathname,"/weer/:location","weerroutes moeten plaatsnaam/coördinaten generaliseren");
  assert.equal(capture.payload.properties.$current_url,"https://watishetweer.nl/weer/:location","current_url moet dezelfde gegeneraliseerde weerrroute gebruiken");
  const serialized=JSON.stringify(capture.payload);
  for(const geheim of ["Almere","52.3702","5.2141","bron=zoekveld","#detail"]){
    assert(!serialized.includes(geheim),"weerroute lekt locatie- of URL-data naar analytics: "+geheim);
  }
}

const zoekCaptures=voerAnalyticsUit({
  pathname:"/",
  withSearchInput:true,
  typedValue:"Almere 52.3702,5.2141",
  triggerSearch:true
});
assert.equal(zoekCaptures.length,2,"een ingevuld zoekveld hoort alleen pageview + generiek search-start event te sturen");
assert.equal(zoekCaptures[1].payload.event,"weather_search_started");
assert(!JSON.stringify(zoekCaptures[1].payload).includes("Almere"),"ingetypte plaatsnaam mag geen eventproperty worden");
assert(!JSON.stringify(zoekCaptures[1].payload).includes("52.3702"),"ingetypte coördinaten mogen geen eventproperty worden");

/* Herkomst en startmodus: alleen vaste categorieën, nooit het verwijzende adres,
   het domein of een zoekterm. */
for(const [referrer,verwacht] of [
  ["","none"],
  ["niet-een-url","none"],
  ["https://www.google.nl/search?q=weer+almere","search"],
  ["https://www.bing.com/search?q=weer%20utrecht","search"],
  ["https://duckduckgo.com/?q=regen+zwolle","search"],
  ["https://chatgpt.com/c/abc123","ai_assistant"],
  ["https://www.perplexity.ai/search/weer-almere","ai_assistant"],
  ["https://gemini.google.com/app/xyz","ai_assistant"],
  ["https://watishetweer.nl/weer/almere/","internal"],
  ["https://www.watishetweer.nl/","internal"],
  ["https://nieuws.example.org/artikel?id=7","other"],
  ["https://google.evil.example/","other"]
]){
  const pv=voerAnalyticsUit({pathname:"/weer/almere/",referrer})[0];
  assert.equal(pv.payload.properties.entry_source,verwacht,"herkomstcategorie voor "+JSON.stringify(referrer));
  assert(["search","ai_assistant","internal","other","none"].includes(pv.payload.properties.entry_source),"alleen vaste herkomstcategorieën zijn toegestaan");
  const serialized=JSON.stringify(pv.payload);
  for(const geheim of ["google","bing","duckduckgo","chatgpt","perplexity","gemini","example","almere","utrecht","zwolle","abc123","q="]){
    assert(!serialized.toLowerCase().includes(geheim),"herkomst lekt verwijzer-inhoud naar analytics: "+geheim+" (bron "+referrer+")");
  }
}
assert.equal(voerAnalyticsUit({pathname:"/"})[0].payload.properties.launch_mode,"browser","zonder app-weergave hoort de startmodus browser te zijn");
assert.equal(voerAnalyticsUit({pathname:"/",standalone:true})[0].payload.properties.launch_mode,"app","geïnstalleerde app-weergave hoort als app te tellen");

assert.equal(voerAnalyticsUit({pathname:"/privacy",gpc:true}).length,0,"GPC moet alle PostHog-capture blokkeren");
assert.equal(voerAnalyticsUit({pathname:"/privacy",navigatorDnt:"1"}).length,0,"navigator DNT moet alle PostHog-capture blokkeren");
assert.equal(voerAnalyticsUit({pathname:"/privacy",windowDnt:"1"}).length,0,"window DNT moet alle PostHog-capture blokkeren");

console.log("privacy-analytics-consistency: over/privacy-copy, canonieke privacyroute, URL-/locatieredactie, GA4-vermelding en GPC/DNT OK");
