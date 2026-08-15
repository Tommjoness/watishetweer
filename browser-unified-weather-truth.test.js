"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

/* Productieregressie van 15 augustus 2026, maar generiek gemaakt:
   - het model zegt dat het NU regent (code 61 + 0,2 mm);
   - de toekomstige modelkans is 12%;
   - een verse officiële KNMI-puntmeting zegt 0 mm/u.
   Geen enkele zichtbare consumentendrager mag dan nog actuele regen claimen.
   De toekomstige kleine kans moet wel behouden blijven. */
const d=bouw({
  temp:()=>22,
  tempNu:22,
  pp:()=>12,
  pr:()=>0,
  som:0,
  ws:2,
  wsNu:2,
  cc:()=>55,
  ccNu:55,
  wg:()=>8,
  wc:()=>3,
  wcNu:61
});
d.current.time="2026-07-22T14:17";
d.current.interval=900;
d.current.temperature_2m=22;
d.current.apparent_temperature=22;
d.current.is_day=1;
d.current.precipitation=0.2;
d.current.weather_code=61;
d.current.cloud_cover=55;
d.current.wind_speed_10m=2;
d.current.wind_direction_10m=225;
d.current.wind_gusts_10m=8;
d.current.pressure_msl=1014;
d.current.visibility=16000;
d.elevation=3;
d.latitude=52.35;
d.longitude=5.26;

d.minutely_15=null;
d.daily.precipitation_probability_max=d.daily.time.map(()=>12);
d.daily.precipitation_sum=d.daily.time.map(()=>0);
d.daily.weather_code=d.daily.time.map(()=>3);

const knmi={
  beschikbaar:true,
  opgehaaldOp:"2026-07-22T12:17:20Z",
  actueel:{waarde:0,tijd:"2026-07-22T12:15:00Z"},
  nowcast:null
};

const air={
  current:{european_aqi:30,us_aqi:40},
  hourly:{
    time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],
    mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]
  }
};

let html=fs.readFileSync(path.join(__dirname,"public/index.html"),"utf8");
const artifactDiag={
  presentatieMarker:html.includes("/* ===== NEERSLAGPRESENTATIE V2 ===== */"),
  presentatieApiCode:html.includes("WeatherNowNeerslagPresentatieV2"),
  positiePresentatie:html.indexOf("/* ===== NEERSLAGPRESENTATIE V2 ===== */"),
  positieStart:html.indexOf("/* ---------- start ---------- */")
};
console.log("UNIFIED ARTIFACT "+JSON.stringify(artifactDiag));
const fixedNow=Date.UTC(2026,6,22,12,17,0); // 14:17 Europe/Amsterdam
const stub=`<script>
Date.now=()=>${fixedNow};
window.__unifiedFetches=[];
window.fetch=async function(url){
  const u=String(url);window.__unifiedFetches.push(u);
  const payload=u.includes('/api/neerslag')?${JSON.stringify(knmi)}
    :u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}
    :u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[{name:"Browsertest",latitude:52.35,longitude:5.26,admin1:"Flevoland",country_code:"NL"}]})}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Browsertest",land:"NL",bron:"test"})}
    :${JSON.stringify(d)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const server=http.createServer((req,res)=>{
  const pathname=(req.url||"").split("?")[0];
  if(pathname==="/"||pathname==="/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;
  }
  const rel=pathname.startsWith("/")?pathname.slice(1):pathname;
  const file=path.join(__dirname,"public",rel);
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){
    const ext=path.extname(file).toLowerCase();
    const types={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
    res.writeHead(200,{"content-type":types[ext]||"application/octet-stream"});
    fs.createReadStream(file).pipe(res);
  }else{res.writeHead(404);res.end("not found");}
});

async function lifecycleDiag(page){
  return page.evaluate(()=>{
    const p=globalThis.WeatherNowNeerslagPresentatieV2;
    const a=p&&typeof p.analyse==="function"?p.analyse(120):null;
    return {
      typeS:typeof S,
      typeMeters:typeof meters,
      typeBriefing:typeof briefing,
      typeNowcast:typeof nowcast,
      land:typeof S!=="undefined"?S.land:null,
      lat:typeof S!=="undefined"?S.lat:null,
      lon:typeof S!=="undefined"?S.lon:null,
      fetches:Array.isArray(window.__unifiedFetches)?window.__unifiedFetches.slice():[],
      hasKnmi:!!(typeof S!=="undefined"&&S.d&&S.d.__knmiNeerslag),
      knmiBeschikbaar:!!(typeof S!=="undefined"&&S.d&&S.d.__knmiNeerslag&&S.d.__knmiNeerslag.beschikbaar),
      presentatieApi:!!p,
      analyse:a?{status:a.status,genoeg:a.genoeg,kans:a.kans,currentWet:a.currentWet,currentRadarWet:a.currentRadarWet,bronActueel:a.bronActueel}:null
    };
  });
}

async function controleer(type,naam){
  const browser=await type.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),fouten=[];
    page.on("pageerror",e=>fouten.push(String(e)));
    page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
    await page.goto(`http://127.0.0.1:${server.address().port}/?lat=52.35&lon=5.26&plaats=Browsertest&land=NL`,{waitUntil:"networkidle"});
    await page.waitForSelector("#app",{state:"visible"});
    try{
      await page.waitForFunction(()=>{
        const p=globalThis.WeatherNowNeerslagPresentatieV2;
        const a=p&&typeof p.analyse==="function"?p.analyse(120):null;
        return !!(a&&a.bronActueel==="knmi-rtcor");
      },null,{timeout:5000});
    }catch(e){
      const diag=await lifecycleDiag(page);
      throw new Error(naam+": officiële KNMI-bron werd niet actief | ARTIFACT="+JSON.stringify(artifactDiag)+" | DIAG="+JSON.stringify(diag)+" | "+(e&&e.message||e));
    }

    const r=await page.evaluate(()=>{
      const tekst=id=>((document.getElementById(id)||{}).textContent||"").replace(/\s+/g," ").trim();
      const briefEl=document.getElementById("briefing")||document.getElementById("brief");
      const pop=document.getElementById("pop"),popStat=pop&&pop.closest(".stat");
      const ncHint=document.getElementById("nchint"),ncKop=ncHint&&ncHint.previousElementSibling;
      const eersteDag=document.querySelector("#days .row.day:not(.kop)");
      const presentatie=globalThis.WeatherNowNeerslagPresentatieV2;
      const a=presentatie&&typeof presentatie.analyse==="function"?presentatie.analyse(120):null;
      return {
        hero:tekst("cond"),mini:tekst("minicond"),
        briefing:briefEl?(briefEl.textContent||"").replace(/\s+/g," ").trim():"",
        briefCanoniek:tekst("brief"),briefingAlias:tekst("briefing"),
        popKop:popStat?((popStat.querySelector(".eyebrow")||{}).textContent||"").trim():"",
        pop:tekst("pop"),popSub:tekst("popsub"),tweeUur:tekst("nctext"),
        tweeUurZichtbaar:ncKop?getComputedStyle(ncKop).display!=="none":false,
        dagCond:eersteDag?((eersteDag.querySelector(".dcond")||{}).textContent||"").replace(/\s+/g," ").trim():"",
        dagKans:eersteDag?((eersteDag.querySelector(".drain")||{}).childNodes[0]?.textContent||"").trim():"",
        bronActueel:a&&a.bronActueel||"",
        analyse:a?{status:a.status,genoeg:a.genoeg,kans:a.kans,hoeveelheid:a.hoeveelheid,currentWet:a.currentWet,currentRadarWet:a.currentRadarWet,bronActueel:a.bronActueel,bronHoeveelheid:a.bronHoeveelheid}:null,
        i0:S&&S.i0,currentTime:S&&S.d&&S.d.current&&S.d.current.time
      };
    });

    console.log("UNIFIED PREASSERT "+naam+" "+JSON.stringify({r,fouten}));
    const zichtbareKeten=[r.hero,r.mini,r.briefing,r.popKop,r.pop,r.popSub,r.tweeUur,r.dagCond,r.dagKans].join(" | ");
    assert.ok(r.hero,naam+": actuele hero heeft een conditietekst");
    assert.doesNotMatch(r.hero,/regen|motregen|bui|sneeuw|neerslag/i,naam+": verse droge KNMI-meting neutraliseert de modelregen in de hero");
    assert.doesNotMatch(r.mini,/regen|motregen|bui|sneeuw|neerslag/i,naam+": mobiele actuele conditie volgt dezelfde droge waarheid");
    assert.match(r.briefing,/kleine kans op neerslag/i,naam+": toekomstige 12% blijft als kleine kans in de briefing staan");
    assert.doesNotMatch(r.briefing,/(valt|regent|sneeuwt) nu/i,naam+": briefing claimt geen actuele neerslag");
    assert.match(r.pop,/12%/,naam+": neerslagtegel behoudt de toekomstige modelkans");
    assert.doesNotMatch(r.popKop+" "+r.popSub,/(valt|regent|sneeuwt) nu/i,naam+": neerslagtegel claimt geen actuele neerslag");
    assert.doesNotMatch(r.tweeUur,/(valt|regent|sneeuwt) nu/i,naam+": twee-uursblok claimt geen actuele neerslag");
    assert.doesNotMatch(r.dagCond,/(valt|regent|sneeuwt) nu/i,naam+": dagrij maakt van de dagverwachting geen actuele claim");
    assert.doesNotMatch(zichtbareKeten,/(er valt nu|het regent nu|het sneeuwt nu)/i,naam+": geen zichtbare consumentendrager spreekt de droge actuele KNMI-meting tegen");
    assert.equal(r.bronActueel,"knmi-rtcor",naam+": test bewijst daadwerkelijk het officiële actuele KNMI-pad");
    assert.deepEqual(fouten,[],naam+": geen page/console errors");

    console.log("UNIFIED "+naam+" "+JSON.stringify(r));
  }finally{await browser.close();}
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  try{
    await controleer(chromium,"Chromium");
    await controleer(webkit,"WebKit");
    console.log("Unified weather truth browser: zichtbare keten in Chromium en WebKit geslaagd.");
  }finally{server.close();}
})().catch(e=>{console.error(e&&e.stack||e);server.close();process.exit(1);});
