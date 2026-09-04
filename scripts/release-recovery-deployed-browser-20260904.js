"use strict";

const assert=require("assert");
const crypto=require("crypto");
const fs=require("fs");
const path=require("path");
const {chromium}=require("playwright");

const ROOT=String(process.env.PRODUCTION_ROOT||process.env.PREVIEW_ROOT||"https://watishetweer.nl").replace(/\/$/,"");
const EXPECTED=String(process.env.EXPECTED_SHA||"").trim();
if(!/^[0-9a-f]{7,40}$/i.test(EXPECTED))throw new Error("EXPECTED_SHA ontbreekt of is ongeldig.");
const routes=["/","/weer/amsterdam/","/weer/rotterdam/","/weer/utrecht/","/weer/groningen/"];
const report={root:ROOT,expectedSha:EXPECTED,static:[],noJs:[],failedJs:[],slowJs:null,recovery:null,refresh:null,bfcache:[]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sha256=v=>crypto.createHash("sha256").update(v).digest("hex");

function htmlMeta(html,name){return (new RegExp(`<meta name="${name}" content="([^"]+)">`).exec(html)||[])[1]||"";}
function appScript(html){return (/<script src="\/(app-[0-9a-f]{12}\.min\.js)" defer><\/script>/.exec(html)||[])[1]||"";}
function canonical(html){return (/<link rel="canonical" href="([^"]+)">/.exec(html)||[])[1]||"";}
async function getText(url){const r=await fetch(url,{headers:{"cache-control":"no-cache"},signal:AbortSignal.timeout(30000)});assert(r.ok,`${url}: HTTP ${r.status}`);return {text:await r.text(),headers:Object.fromEntries(r.headers)};}

async function staticGate(){
  let sharedApp="";
  for(const route of routes){
    const {text}=await getText(ROOT+route+`?releasecheck=${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const build=htmlMeta(text,"weather-build-sha"),app=appScript(text),canon=canonical(text);
    assert.equal(build,EXPECTED,`${route}: buildmarker ${build} != ${EXPECTED}`);
    assert(app,`${route}: hoofdscript ontbreekt`);
    if(!sharedApp)sharedApp=app;else assert.equal(app,sharedApp,`${route}: functionele bundledivergentie ${app} != ${sharedApp}`);
    assert(text.includes('<meta name="weather-client-manifest" content="/release-client-manifest.json">'),`${route}: release-client-manifest-meta ontbreekt`);
    report.static.push({route,buildmarker:build,mainScript:"/"+app,canonical:canon});
  }
  const manifest=JSON.parse((await getText(ROOT+"/release-client-manifest.json?releasecheck="+Date.now())).text);
  assert.equal(manifest.buildSha,EXPECTED,"manifest: buildSha mismatch");
  assert.equal(manifest.mainScript,"/"+sharedApp,"manifest: mainScript mismatch");
  const appBody=(await getText(ROOT+manifest.mainScript+"?releasecheck="+Date.now())).text;
  assert.equal(sha256(appBody),manifest.mainScriptSha256,"manifest: mainScriptSha256 mismatch");
  const sw=(await getText(ROOT+"/sw.js?releasecheck="+Date.now())).text;
  const swApps=[...new Set([...sw.matchAll(/app-[0-9a-f]{12}\.min\.js/g)].map(m=>m[0]))];
  assert.deepEqual(swApps,[sharedApp],`serviceworker heeft app-referenties ${swApps.join(", ")}`);
  assert(sw.includes("release-client-manifest.json"),"serviceworker precachet release-client-manifest niet");
  report.manifest=manifest;
  return sharedApp;
}

async function uiState(page){return page.evaluate(()=>{
  const txt=id=>(document.getElementById(id)?.textContent||"").trim();
  let state=null;
  try{state={label:S.label,lat:S.lat,lon:S.lon,land:S.land,timezone:S.d?.timezone||null,op:S.op||null,hourTimes:(S.d?.hourly?.time||[]).slice(0,30),dayTimes:(S.d?.daily?.time||[]).slice(0,8)};}catch(_){ }
  return {
    url:location.href,location:txt("place"),briefing:txt("brief"),temperature:txt("t"),
    hourData:state?.hourTimes||[],dayData:state?.dayTimes||[],weekData:txt("days"),
    canonical:document.querySelector('link[rel="canonical"]')?.href||"",stamp:txt("stamp"),
    buildmarker:document.querySelector('meta[name="weather-build-sha"]')?.content||"",state
  };
});}
async function waitWeather(page){
  await page.waitForFunction(()=>{
    try{return !!(S.d&&document.getElementById("brief")?.textContent.trim()&&document.querySelectorAll("#days .row.day:not(.kop)").length===7);}catch(_){return false;}
  },null,{timeout:20000});
  return uiState(page);
}
function consoleCollector(page){
  const errors=[];page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});page.on("pageerror",e=>errors.push(String(e)));return errors;
}
async function noJsGate(browser,route){
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844},locale:"nl-NL",serviceWorkers:"block"});
  const page=await context.newPage();
  try{
    const r=await page.goto(ROOT+route,{waitUntil:"domcontentloaded",timeout:30000});assert(r&&r.ok(),`${route} no-JS HTTP ${r&&r.status()}`);
    const x=await page.evaluate(()=>({
      text:(document.getElementById("weather-noscript")?.textContent||"").trim(),
      controls:["q","here","ververs","thema"].map(id=>({id,disabled:!!document.getElementById(id)?.disabled})),
      seoLinks:document.querySelectorAll('a[href^="/weer/"]').length,
      stateDisplay:getComputedStyle(document.getElementById("state")).display,
      appDisplay:getComputedStyle(document.getElementById("app")).display
    }));
    assert(/JavaScript is nodig/i.test(x.text)&&/laad de pagina opnieuw/i.test(x.text),`${route}: no-JS herstelcopy ontbreekt`);
    assert(x.controls.every(c=>c.disabled),`${route}: no-JS control bleef actief`);
    assert(x.seoLinks>0,`${route}: SEO-plaatslinks verdwenen in no-JS state`);
    assert.equal(x.stateDisplay,"none",`${route}: half-functionele loadingstate zichtbaar zonder JS`);
    report.noJs.push({route,...x});
  }finally{await context.close();}
}
async function blockedMainGate(browser,route,sharedApp){
  const context=await browser.newContext({viewport:{width:390,height:844},locale:"nl-NL",serviceWorkers:"block"});
  const page=await context.newPage(),errors=consoleCollector(page);
  await page.route(`**/${sharedApp}`,r=>r.abort("failed"));
  try{
    const response=await page.goto(ROOT+route,{waitUntil:"domcontentloaded",timeout:30000});assert(response&&response.ok(),`${route} failed-JS HTTP ${response&&response.status()}`);
    await page.waitForSelector("#weather-bootstrap-status:not([hidden])",{state:"visible",timeout:17000});
    const x=await page.evaluate(()=>({
      fallback:(document.getElementById("weather-bootstrap-status")?.textContent||"").trim(),
      controls:["q","here","ververs","thema"].map(id=>({id,disabled:!!document.getElementById(id)?.disabled})),
      stateDisplay:getComputedStyle(document.getElementById("state")).display,
      failed:document.documentElement.classList.contains("weather-app-failed")
    }));
    assert(x.failed&&x.controls.every(c=>c.disabled)&&x.stateDisplay==="none",`${route}: failed-JS state niet fail-closed`);
    report.failedJs.push({route,...x,console:errors});
  }finally{await context.close();}
}
async function delayGate(browser,sharedApp,delayMs,recovery){
  const context=await browser.newContext({viewport:{width:390,height:844},locale:"nl-NL",serviceWorkers:"block"});
  const page=await context.newPage(),errors=consoleCollector(page);
  await page.route(`**/${sharedApp}`,async route=>{await sleep(delayMs);await route.continue();});
  try{
    const nav=page.goto(ROOT+"/",{waitUntil:"domcontentloaded",timeout:40000});
    let sawFailure=false;
    if(recovery){await page.waitForSelector("#weather-bootstrap-status:not([hidden])",{state:"visible",timeout:17000});sawFailure=true;}
    const response=await nav;assert(response&&response.ok(),`delayed-main HTTP ${response&&response.status()}`);
    await page.waitForFunction(()=>document.documentElement.dataset.weatherAppReady==="1",null,{timeout:5000});
    const x=await page.evaluate(()=>({ready:document.documentElement.dataset.weatherAppReady,failed:document.documentElement.classList.contains("weather-app-failed"),fallbackHidden:!!document.getElementById("weather-bootstrap-status")?.hidden,controls:["q","here","ververs","thema"].map(id=>({id,disabled:!!document.getElementById(id)?.disabled}))}));
    assert.equal(x.ready,"1","delayed-main: app niet ready");assert(!x.failed&&x.fallbackHidden&&x.controls.every(c=>!c.disabled),"delayed-main: tijdelijke state niet volledig opgeruimd");
    if(recovery)assert(sawFailure,"error→success: tijdelijke foutstate niet waargenomen");
    const row={delayMs,sawFailure,...x,console:errors};if(recovery)report.recovery=row;else report.slowJs=row;
  }finally{await context.close();}
}

async function deterministicRefreshGate(browser){
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:"nl-NL",serviceWorkers:"block"});
  const page=await context.newPage(),errors=consoleCollector(page),cache=new Map();
  const cacheRoute=async route=>{
    const key=route.request().url();
    if(cache.has(key))return route.fulfill(cache.get(key));
    const response=await route.fetch();const body=await response.body();const value={status:response.status(),headers:response.headers(),body};cache.set(key,value);return route.fulfill(value);
  };
  await page.route("**://api.open-meteo.com/v1/forecast**",cacheRoute);
  await page.route("**/api/waarschuwingen**",cacheRoute);
  try{
    await page.goto(ROOT+"/weer/amsterdam/",{waitUntil:"domcontentloaded",timeout:30000});await waitWeather(page);
    await page.evaluate(()=>{window.WeatherNowStaffAudit?.markeerNavigatie?.("push");return load(40.7128,-74.0060,"New York",false,true,"US");});
    await page.waitForFunction(()=>{try{return S.d&&S.label==="New York"&&document.getElementById("brief")?.textContent.trim();}catch(_){return false;}},null,{timeout:20000});
    const before=await uiState(page),exactUrl=before.url;
    await page.reload({waitUntil:"domcontentloaded",timeout:30000});const after=await waitWeather(page);
    assert.equal(after.url,exactUrl,"refresh: exacte URL veranderde");
    for(const key of ["location","briefing","temperature","hourData","dayData","weekData","canonical"])assert.deepEqual(after[key],before[key],`refresh: ${key} wijkt af bij identieke brondata`);
    assert.equal(after.buildmarker,EXPECTED,"refresh: buildmarker mismatch");
    report.refresh={before,after,console:errors};
  }finally{await context.close();}
}

async function bfcacheGate(browser,background){
  const context=await browser.newContext({viewport:{width:390,height:844},locale:"nl-NL",serviceWorkers:"block"});
  const page=await context.newPage(),errors=consoleCollector(page),forecast=[];
  page.on("request",r=>{if(r.url().includes("api.open-meteo.com/v1/forecast"))forecast.push({url:r.url(),at:Date.now()});});
  await page.addInitScript(()=>{
    window.__wiwPageshows=[];
    window.addEventListener("pageshow",e=>setTimeout(()=>window.__wiwPageshows.push({persisted:e.persisted,at:Date.now(),stamp:(document.getElementById("stamp")?.textContent||"").trim()}),0));
  });
  let other=null;
  try{
    await page.goto(ROOT+"/weer/amsterdam/",{waitUntil:"domcontentloaded",timeout:30000});const initial=await waitWeather(page);const beforeRequests=forecast.length;
    await page.goto(ROOT+"/over/",{waitUntil:"domcontentloaded",timeout:30000});
    if(background){other=await context.newPage();await other.goto(ROOT+"/privacy/",{waitUntil:"domcontentloaded",timeout:30000});await other.bringToFront();}
    await sleep(121000);
    if(background)await page.bringToFront();
    const started=Date.now();await page.goBack({waitUntil:"domcontentloaded",timeout:30000});
    await page.waitForFunction(()=>window.__wiwPageshows?.some(x=>x.persisted),null,{timeout:1000});
    const restored=await page.evaluate(()=>window.__wiwPageshows.filter(x=>x.persisted).at(-1));const after=await uiState(page),elapsed=Date.now()-started;
    assert(restored&&restored.persisted,`BFCache${background?" background":""}: pageshow.persisted niet bewezen`);
    assert(elapsed<=1000,`BFCache${background?" background":""}: freshnesscontrole pas na ${elapsed} ms`);
    const mins=Number((/(\d+) min geleden/.exec(after.stamp)||[])[1]||0);assert(mins>=2,`BFCache${background?" background":""}: freshnesslabel niet direct >=2 min: ${after.stamp}`);
    assert.equal(forecast.length,beforeRequests,`BFCache${background?" background":""}: onnodige extra forecastrequest op restore`);
    report.bfcache.push({background,initialStamp:initial.stamp,restored,checkedWithinMs:elapsed,stamp:after.stamp,forecastRequestsBefore:beforeRequests,forecastRequestsAfter:forecast.length,console:errors});
  }finally{if(other)await other.close();await context.close();}
}

(async()=>{
  const sharedApp=await staticGate();
  const browser=await chromium.launch({headless:true});
  try{
    await noJsGate(browser,"/");await noJsGate(browser,"/weer/amsterdam/");
    await blockedMainGate(browser,"/",sharedApp);await blockedMainGate(browser,"/weer/amsterdam/",sharedApp);
    await delayGate(browser,sharedApp,5000,false);await delayGate(browser,sharedApp,16000,true);
    await deterministicRefreshGate(browser);
    await bfcacheGate(browser,false);await bfcacheGate(browser,true);
  }finally{await browser.close();}
  const outDir=path.join(process.cwd(),"artifacts","final-release");fs.mkdirSync(outDir,{recursive:true});
  const out=path.join(outDir,"release-recovery-20260904.json");fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n","utf8");
  console.log("RELEASE_RECOVERY_DEPLOYED_PASS "+JSON.stringify({build:EXPECTED,mainScript:report.manifest.mainScript,routes:report.static.length,noJs:report.noJs.length,failedJs:report.failedJs.length,refresh:true,bfcache:report.bfcache.map(x=>({background:x.background,ms:x.checkedWithinMs,stamp:x.stamp,requests:[x.forecastRequestsBefore,x.forecastRequestsAfter]}))}));
})().catch(e=>{console.error(e&&e.stack||e);process.exitCode=1;});
