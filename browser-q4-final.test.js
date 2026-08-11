"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

const basisWeer=bouw({geenKwartier:true,pp:()=>10,pr:()=>0,som:0,cc:()=>35,wc:()=>3,wcNu:3});
basisWeer.latitude=52.35;basisWeer.longitude=5.26;basisWeer.timezone="Europe/Amsterdam";basisWeer.utc_offset_seconds=7200;
basisWeer.daily.sunshine_duration=basisWeer.daily.time.map(()=>7*3600);
const gewoneAir={current:{european_aqi:24,us_aqi:33},hourly:{time:[basisWeer.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[2],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};

let html=fs.readFileSync(path.join(__dirname,"public/index.html"),"utf8");
const stub=`<script>
(function(){
  const weer=${JSON.stringify(basisWeer)};
  const gewoneAir=${JSON.stringify(gewoneAir)};
  const clone=x=>JSON.parse(JSON.stringify(x));
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  window.__q4Counts={full:0,minimal:0,air:0,warnings:0,geocode:0,place:0};
  const mode=new URL(location.href).searchParams.get("mode")||"normal";
  window.fetch=async function(url,opt){
    const u=String(url),q=new URL(u,location.href),lat=Number(q.searchParams.get("latitude")||q.searchParams.get("lat"));
    const isWeather=u.includes("api.open-meteo.com/v1/forecast"),isFull=isWeather&&u.includes("minutely_15=");
    const isAir=u.includes("air-quality-api.open-meteo.com"),isWarn=u.includes("/api/waarschuwingen");
    const isGeo=u.includes("geocoding-api.open-meteo.com"),isPlace=u.includes("/api/plaatsnaam");
    if(isWeather){if(isFull)window.__q4Counts.full++;else window.__q4Counts.minimal++;}
    else if(isAir)window.__q4Counts.air++;
    else if(isWarn)window.__q4Counts.warnings++;
    else if(isGeo)window.__q4Counts.geocode++;
    else if(isPlace)window.__q4Counts.place++;

    if(mode==="fallback"&&isFull)return {ok:false,status:503,json:async()=>({}),text:async()=>"503"};
    if(mode==="hardfail"&&isWeather)return {ok:false,status:503,json:async()=>({}),text:async()=>"503"};
    if(mode==="airfail"&&isAir)return {ok:false,status:503,json:async()=>({}),text:async()=>"503"};
    if(mode==="warningfail"&&isWarn)return {ok:false,status:503,json:async()=>({}),text:async()=>"503"};

    let payload;
    if(isWeather){
      payload=clone(weer);payload.latitude=Number.isFinite(lat)?lat:weer.latitude;
      payload.longitude=Number(q.searchParams.get("longitude"))||weer.longitude;
    }else if(isAir){
      if(mode==="race"&&Math.abs(lat-40.71)<0.02){await sleep(500);payload={current:{european_aqi:180,us_aqi:180},hourly:gewoneAir.hourly};}
      else if(mode==="race"&&Math.abs(lat-35.68)<0.02){payload={current:{european_aqi:12,us_aqi:12},hourly:gewoneAir.hourly};}
      else payload=clone(gewoneAir);
    }else if(isWarn){
      if(mode==="race"&&Math.abs(lat-40.71)<0.02){await sleep(500);payload={bron:"test",dekking:true,land:"US",lijst:[{titel:"Oude waarschuwing A",tekst:"Oud",niveau:"rood"}]};}
      else if(mode==="race"&&Math.abs(lat-35.68)<0.02){payload={bron:"test",dekking:true,land:"JP",lijst:[{titel:"Nieuwe waarschuwing B",tekst:"Nieuw",niveau:"geel"}]};}
      else payload={bron:"test",dekking:true,land:"NL",lijst:[]};
    }else if(isGeo)payload={results:[]};
    else if(isPlace)payload={naam:"Testplaats",land:"NL",bron:"test"};
    else payload={};
    return {ok:true,status:200,json:async()=>clone(payload),text:async()=>JSON.stringify(payload)};
  };
  try{Object.defineProperty(navigator,"geolocation",{value:undefined,configurable:true});}catch(e){}
})();
</script>`;
html=html.replace("</head>",stub+"</head>");

const server=http.createServer((req,res)=>{
  const p=(req.url||"").split("?")[0];
  if(p==="/"||p==="/index.html"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;}
  const rel=p.startsWith("/")?p.slice(1):p,f=path.join(__dirname,"public",rel);
  if(fs.existsSync(f)&&fs.statSync(f).isFile()){
    const ext=path.extname(f).toLowerCase(),types={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
    res.writeHead(200,{"content-type":types[ext]||"application/octet-stream"});fs.createReadStream(f).pipe(res);
  }else{res.writeHead(404);res.end("not found");}
});

async function openScenario(browser,mode,breedte=390){
  const context=await browser.newContext({viewport:{width:breedte,height:900},deviceScaleFactor:breedte<760?3:1});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
  const url=`http://127.0.0.1:${server.address().port}/?mode=${mode}&lat=52.35&lon=5.26&plaats=Eindtest&land=NL`;
  await page.goto(url,{waitUntil:"networkidle"});
  return {context,page,fouten};
}

async function normaleKeten(browser,naam){
  const {context,page,fouten}=await openScenario(browser,"normal");
  try{
    await page.waitForSelector("#app",{state:"visible"});
    await page.waitForFunction(()=>document.querySelectorAll("#aq .stat").length>0);
    const r=await page.evaluate(()=>({
      counts:window.__q4Counts,
      trendKop:document.getElementById("prec")?.parentElement?.querySelector(".eyebrow")?.textContent.trim()||"",
      trend:document.getElementById("prec")?.textContent.trim()||"",
      perf:window.WeatherNowQ1Performance||null,
      overflow:document.documentElement.scrollWidth-window.innerWidth,
      state:(document.getElementById("state")?.textContent||"").trim()
    }));
    assert.deepEqual(fouten,[],naam+": normale keten zonder runtimefouten");
    assert.equal(r.counts.full,1,naam+": initiële volledige forecast exact één request");
    assert.equal(r.counts.minimal,0,naam+": fallbackforecast niet onnodig opgevraagd");
    assert.equal(r.counts.air,1,naam+": luchtkwaliteit exact één request");
    assert.equal(r.counts.warnings,1,naam+": waarschuwingen exact één request");
    assert.equal(r.trendKop,"Temperatuurtrend",naam+": nieuwe temperatuurtrend blijft actief");
    assert.match(r.trend,/^-?\d+\s*→\s*-?\d+°C$/,naam+": trend blijft twee echte temperatuurwaarden tonen");
    assert.ok(r.perf&&typeof r.perf==="object",naam+": performance-instrumentatie blijft aanwezig");
    assert.ok(r.overflow<=2,naam+": geen horizontale overflow in normale eindketen");
  }finally{await context.close();}
}

async function fallbackKeten(browser,naam){
  const {context,page,fouten}=await openScenario(browser,"fallback");
  try{
    await page.waitForSelector("#app",{state:"visible"});
    const r=await page.evaluate(()=>({counts:window.__q4Counts,temp:(document.getElementById("t")?.textContent||"").trim()}));
    assert.deepEqual(fouten,[],naam+": forecastfallback zonder runtimefouten");
    assert.equal(r.counts.full,1,naam+": zware forecast één keer geprobeerd");
    assert.equal(r.counts.minimal,1,naam+": minimal forecast exact één keer als fallback");
    assert.notEqual(r.temp,"–",naam+": fallback levert echte weerdata");
  }finally{await context.close();}
}

async function nietBlokkerendeBron(browser,naam,mode,verwacht){
  const {context,page,fouten}=await openScenario(browser,mode);
  try{
    await page.waitForSelector("#app",{state:"visible"});
    await page.waitForTimeout(80);
    const tekst=await page.evaluate(()=>document.body.textContent||"");
    assert.deepEqual(fouten,[],`${naam}: ${mode} zonder runtimefouten`);
    assert.match(tekst,verwacht,`${naam}: ${mode} wordt eerlijk gemeld zonder weerpagina te blokkeren`);
  }finally{await context.close();}
}

async function hardeUitval(browser,naam){
  const {context,page,fouten}=await openScenario(browser,"hardfail");
  try{
    await page.waitForFunction(()=>/Ophalen mislukt|Geen verbinding/.test(document.getElementById("state")?.textContent||""));
    const r=await page.evaluate(()=>({counts:window.__q4Counts,state:(document.getElementById("state")?.textContent||"").trim(),app:getComputedStyle(document.getElementById("app")).display}));
    assert.deepEqual(fouten,[],naam+": totale weeruitval zonder runtimecrash");
    assert.equal(r.counts.full,1,naam+": volledige forecast één poging bij uitval");
    assert.equal(r.counts.minimal,1,naam+": fallback één poging bij uitval");
    assert.match(r.state,/Ophalen mislukt|Geen verbinding/,naam+": totale uitval wordt zichtbaar gemeld");
    assert.equal(r.app,"none",naam+": zonder geldige briefing wordt geen verzonnen dashboard getoond");
  }finally{await context.close();}
}

async function raceKeten(browser,naam){
  const {context,page,fouten}=await openScenario(browser,"race");
  try{
    await page.waitForSelector("#app",{state:"visible"});
    await page.evaluate(()=>{
      load(40.71,-74.01,"Oude A",false,true,"US");
      setTimeout(()=>load(35.68,139.69,"Nieuwe B",false,true,"JP"),20);
    });
    await page.waitForTimeout(750);
    const r=await page.evaluate(()=>({
      label:S.label,lat:S.lat,lon:S.lon,
      aq:(document.getElementById("aq")?.textContent||"").replace(/\s+/g," ").trim(),
      warn:(document.getElementById("waarschuwingen")?.textContent||"").replace(/\s+/g," ").trim(),
      counts:window.__q4Counts
    }));
    assert.deepEqual(fouten,[],naam+": raceketen zonder runtimefouten");
    assert.equal(r.label,"Nieuwe B",naam+": nieuwste locatie blijft eigenaar");
    assert.ok(Math.abs(r.lat-35.68)<0.001&&Math.abs(r.lon-139.69)<0.001,naam+": coördinaten blijven bij nieuwste locatie");
    assert.match(r.aq,/Amerikaanse AQI/i,naam+": luchtkwaliteit volgt nieuwste niet-Europese locatie");
    assert.match(r.aq,/12/,naam+": snelle B-luchtkwaliteit blijft zichtbaar");
    assert.doesNotMatch(r.aq,/180/,naam+": trage A-luchtkwaliteit mag B niet overschrijven");
    assert.match(r.warn,/Nieuwe waarschuwing B/,naam+": waarschuwing B blijft zichtbaar");
    assert.doesNotMatch(r.warn,/Oude waarschuwing A/,naam+": trage waarschuwing A mag B niet overschrijven");
    assert.ok(r.counts.air>=3&&r.counts.warnings>=3,naam+": race heeft daadwerkelijk meerdere concurrerende bronrequests uitgevoerd");
  }finally{await context.close();}
}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try{
    for(const [naam,type] of [["Chromium",chromium],["WebKit",webkit]]){
      const browser=await type.launch({headless:true});
      try{
        await normaleKeten(browser,naam);
        await fallbackKeten(browser,naam);
        await nietBlokkerendeBron(browser,naam,"airfail",/Luchtkwaliteit is voor deze locatie niet beschikbaar/i);
        await nietBlokkerendeBron(browser,naam,"warningfail",/Officiële weerwaarschuwingen konden niet worden gecontroleerd/i);
        await hardeUitval(browser,naam);
        await raceKeten(browser,naam);
      }finally{await browser.close();}
    }
    console.log("Checkpoint 100 browser-eindgate geslaagd: requestbudget, forecastfallback, bronuitval en weather/air/warning-races in Chromium/WebKit.");
  }finally{server.close();}
})().catch(err=>{console.error(err);process.exit(1);});
