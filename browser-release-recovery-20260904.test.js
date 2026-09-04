"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("./data.js");

const ROOT=__dirname,PUBLIC=path.join(ROOT,"public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("Definitieve public-artifact ontbreekt voor release-herstel-E2E.");
const solarRuntime=fs.readFileSync(path.join(ROOT,"scripts","final-consumer-polish-20260831-runtime.js"),"utf8");
const solarInterval='setInterval(()=>{zetZontegel();},30000);';
assert.equal(solarRuntime.split(solarInterval).length-1,1,"zonnecyclus moet in de canonieke bron exact één 30s-intervalowner hebben");

const fixture=bouw({tempNu:17,wcNu:2,ccNu:55,pp:()=>35,som:1.2});
fixture.latitude=52.3676;fixture.longitude=4.9041;fixture.timezone="Europe/Amsterdam";fixture.utc_offset_seconds=7200;
fixture.daily.sunshine_duration=fixture.daily.time.map(()=>6*3600);
const air={current:{european_aqi:28,us_aqi:42},hourly:{time:[fixture.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[1],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};

const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".xml":"application/xml; charset=utf-8",".txt":"text/plain; charset=utf-8"};
const server=http.createServer((req,res)=>{
  let pathname=(req.url||"/").split("?")[0];
  try{pathname=decodeURIComponent(pathname);}catch(_){ }
  let rel=pathname.replace(/^\/+/,"");
  if(!rel||pathname.endsWith("/"))rel=path.join(rel,"index.html");
  const bestand=path.normalize(path.join(PUBLIC,rel));
  if(!bestand.startsWith(PUBLIC+path.sep)||!fs.existsSync(bestand)||!fs.statSync(bestand).isFile()){
    res.writeHead(404,{"content-type":"text/plain; charset=utf-8"});res.end("not found");return;
  }
  const naam=path.basename(bestand);
  const immutable=/^(?:app|bootstrap|page|early)-[0-9a-f]{12}\.min\.js$/.test(naam);
  const cacheControl=immutable?"public, max-age=31536000, immutable":"public, max-age=0, must-revalidate";
  res.writeHead(200,{"content-type":mime[path.extname(bestand).toLowerCase()]||"application/octet-stream","cache-control":cacheControl});
  fs.createReadStream(bestand).pipe(res);
});

function fetchFixtureScript(){
  return ({weather,air})=>{
    const NativeDate=Date,realStart=NativeDate.now(),fixtureStart=NativeDate.parse("2026-07-22T12:30:00Z");
    window.__wiwClockOffset=0;
    const offset=()=>Number(window.__wiwClockOffset||0)||0;
    class ReleaseDate extends NativeDate{
      constructor(...args){super(...(args.length?args:[fixtureStart+(NativeDate.now()-realStart)+offset()]));}
      static now(){return fixtureStart+(NativeDate.now()-realStart)+offset();}
    }
    window.Date=ReleaseDate;
    window.__wiwFetchCount=0;window.__wiwPageshowPersisted=false;window.__wiwActiveIntervals=Object.create(null);
    const nativeSetInterval=window.setInterval.bind(window),nativeClearInterval=window.clearInterval.bind(window);
    window.setInterval=function(fn,ms,...args){
      const id=nativeSetInterval(fn,ms,...args);
      window.__wiwActiveIntervals[String(id)]={ms:Number(ms),name:typeof fn==="function"?String(fn.name||""):""};
      return id;
    };
    window.clearInterval=function(id){
      delete window.__wiwActiveIntervals[String(id)];
      return nativeClearInterval(id);
    };
    window.__wiwActiveIntervalOwners=()=>Object.values(window.__wiwActiveIntervals).map(x=>({
      ms:Number(x.ms),
      owner:x.name==="stempel"?"freshness":x.name==="weatherNowVerversTick"?"forecast":x.name||"anonymous"
    })).sort((a,b)=>a.ms-b.ms||a.owner.localeCompare(b.owner));
    window.addEventListener("pageshow",e=>{window.__wiwPageshowPersisted=!!e.persisted;});
    window.fetch=async function(url){
      window.__wiwFetchCount++;
      const u=String(url);
      const payload=u.includes("/api/waarschuwingen")?{bron:"test",dekking:true,land:"NL",lijst:[]}
        :u.includes("/api/neerslag")?{beschikbaar:false,provider:"test",reden:"fixture"}
        :u.includes("/api/plaatsnaam")?{naam:"Amsterdam",land:"NL",bron:"test"}
        :u.includes("air-quality-api.open-meteo.com")?air:weather;
      return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
    };
  };
}

async function wachtReady(page,timeout=10000){
  await page.waitForFunction(()=>document.documentElement.dataset.appBootstrap==="ready",null,{timeout});
}
async function snapshot(page){
  return page.evaluate(()=>({
    build:document.querySelector('meta[name="weather-build-sha"]')?.content||null,
    script:[...document.scripts].map(s=>s.getAttribute("src")||"").find(s=>/\/app-[0-9a-f]{12}\.min\.js$/.test(s))||null,
    bootstrap:[...document.scripts].map(s=>s.getAttribute("src")||"").find(s=>/\/bootstrap-[0-9a-f]{12}\.min\.js$/.test(s))||null,
    url:location.href,
    plaats:(document.getElementById("place")?.getAttribute("aria-label")||"").trim(),
    briefing:(document.getElementById("brief")?.textContent||"").trim(),
    temperatuur:(document.getElementById("t")?.textContent||"").trim(),
    uurdata:document.getElementById("chart")?.getAttribute("aria-label")||"",
    dagdata:(document.getElementById("days")?.innerText||"").trim(),
    weekdata:(document.getElementById("days")?.textContent||"").trim(),
    canonical:document.querySelector('link[rel="canonical"]')?.href||null
  }));
}
function controleerTimerOwners(owners,fase){
  const dertig=owners.filter(x=>x.ms===30000);
  assert.equal(dertig.filter(x=>x.owner==="freshness").length,1,`${fase}: exact één actieve freshness/stempel-interval van 30s vereist; actief=${JSON.stringify(owners)}`);
  assert.equal(dertig.length,2,`${fase}: exact twee actieve 30s-intervals vereist: één freshness-owner plus de statisch geborgde zonnecyclusowner; actief=${JSON.stringify(owners)}`);
  assert.equal(owners.filter(x=>x.ms===60000&&x.owner==="forecast").length,1,`${fase}: exact één actieve forecast/ververs-tick van 60s vereist; actief=${JSON.stringify(owners)}`);
}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,ignoreDefaultArgs:["--disable-back-forward-cache"]});
  try{
    for(const route of ["/","/weer/amsterdam/"]){
      const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:"block"});
      const page=await context.newPage();
      await page.goto(base+route,{waitUntil:"load"});
      assert(await page.locator("#weather-js-required").isVisible(),`${route}: noscript-melding moet zichtbaar zijn`);
      assert.equal(await page.locator(".tools").isVisible(),false,`${route}: bediening mag zonder JS niet actief ogen`);
      assert((await page.locator(".seo-plaatsnav a").count())>0,`${route}: SEO-plaatslinks moeten zonder JS bruikbaar blijven`);
      await context.close();
    }

    for(const route of ["/","/weer/amsterdam/"]){
      const context=await browser.newContext({serviceWorkers:"block"});
      const page=await context.newPage();
      const errors=[];page.on("pageerror",e=>errors.push(String(e)));
      await page.route(/\/app-[0-9a-f]{12}\.min\.js$/,r=>r.abort("failed"));
      await page.goto(base+route,{waitUntil:"load"});
      await page.waitForFunction(()=>document.documentElement.dataset.appBootstrap==="failed",null,{timeout:5000});
      assert(await page.locator("#bootstrap-failure").isVisible(),`${route}: geblokkeerde hoofdapp moet duidelijke herstelstate tonen`);
      assert.equal(await page.locator("#state").isVisible(),false,`${route}: oude eindeloze laadstate moet bij appstartfout verdwijnen`);
      for(const id of ["q","here","ververs","thema"])assert.equal(await page.locator("#"+id).isDisabled(),true,`${route}: ${id} moet bij appstartfout disabled zijn`);
      assert.deepEqual(errors,[],`${route}: blocked-main-pad mag geen pageerror veroorzaken`);
      await context.close();
    }

    {
      const context=await browser.newContext({serviceWorkers:"block"});
      const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(String(e)));
      let appRequests=0;
      await page.route(/\/app-[0-9a-f]{12}\.min\.js$/,async r=>{
        appRequests++;
        await new Promise(resolve=>setTimeout(resolve,13000));
        await r.continue();
      });
      await page.goto(base+"/",{waitUntil:"commit"});
      await page.waitForFunction(()=>document.documentElement.dataset.appBootstrap==="failed",null,{timeout:15000});
      assert(await page.locator("#bootstrap-failure").isVisible(),"12s watchdogfailure moet vóór late app-success zichtbaar worden");
      for(const id of ["q","here","ververs","thema"])assert.equal(await page.locator("#"+id).isDisabled(),true,`timeout-failure: ${id} moet disabled blijven`);
      await wachtReady(page,6000);
      assert.equal(appRequests,1,"late-successpad moet exact dezelfde ene apprequest afmaken");
      assert.equal(await page.locator("#bootstrap-failure").isVisible(),false,"late app-success moet foutmelding zonder reload verwijderen");
      for(const id of ["q","here","ververs","thema"])assert.equal(await page.locator("#"+id).isDisabled(),false,`late success: ${id} moet zonder reload actief worden`);
      const nav=await page.evaluate(()=>({type:performance.getEntriesByType("navigation")[0]?.type||"",ready:window.__WEATHERNOW_APP_READY__===true}));
      assert.equal(nav.type,"navigate","late-successherstel mag geen reload hebben uitgevoerd");
      assert.equal(nav.ready,true,"app-ready-signaal ontbreekt na late success");
      assert.deepEqual(errors,[],"timeout→late-successpad mag geen pageerror veroorzaken");
      await context.close();
    }

    {
      const context=await browser.newContext({serviceWorkers:"block"});
      await context.addInitScript(fetchFixtureScript(),{weather:fixture,air});
      const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(String(e)));
      await page.goto(base+"/weer/amsterdam/",{waitUntil:"load"});
      await page.waitForSelector("#app",{state:"visible",timeout:10000});
      const voor=await snapshot(page);
      await page.reload({waitUntil:"load"});
      await page.waitForSelector("#app",{state:"visible",timeout:10000});
      const na=await snapshot(page);
      for(const sleutel of ["build","script","bootstrap","plaats","briefing","temperatuur","uurdata","dagdata","weekdata","canonical"]){
        assert.equal(na[sleutel],voor[sleutel],`refresh-determinisme wijkt af voor ${sleutel}`);
      }
      assert.deepEqual(errors,[],"route/refresh-determinisme mag geen pageerror veroorzaken");
      await context.close();
    }

    {
      const context=await browser.newContext({serviceWorkers:"block"});
      await context.addInitScript(fetchFixtureScript(),{weather:fixture,air});
      const page=await context.newPage();
      await page.goto(base+"/weer/amsterdam/",{waitUntil:"load"});
      await page.waitForSelector("#app",{state:"visible",timeout:10000});
      await page.waitForFunction(()=>/Gegevens opgehaald om/.test(document.getElementById("stamp")?.textContent||""));
      const voor=await page.evaluate(()=>({fetches:window.__wiwFetchCount,intervals:window.__wiwActiveIntervalOwners()}));
      controleerTimerOwners(voor.intervals,"voor BFCache");
      await page.evaluate(()=>{window.__wiwClockOffset=125000;});
      await page.goto(base+"/weer/",{waitUntil:"load"});
      await page.goBack({waitUntil:"commit"});
      await page.waitForSelector("#stamp",{state:"attached",timeout:5000});
      const bfcache=await page.evaluate(()=>{
        const nav=performance.getEntriesByType("navigation")[0];
        let notRestoredReasons=null;
        try{notRestoredReasons=nav&&"notRestoredReasons" in nav?JSON.parse(JSON.stringify(nav.notRestoredReasons)):null;}catch(_){notRestoredReasons="unavailable";}
        return {
          persisted:window.__wiwPageshowPersisted,
          stamp:document.getElementById("stamp")?.textContent||"",
          fetches:window.__wiwFetchCount,
          plaatsTijd:document.getElementById("plaatstijd")?.textContent||"",
          intervals:window.__wiwActiveIntervalOwners(),
          notRestoredReasons
        };
      });
      assert.equal(bfcache.persisted,true,`Chromium moet deze terugkeer werkelijk uit BFCache herstellen; notRestoredReasons=${JSON.stringify(bfcache.notRestoredReasons)}`);
      assert(/2 min geleden/.test(bfcache.stamp),`freshnesslabel moet direct 2 min geleden tonen, kreeg: ${bfcache.stamp}`);
      assert(/^\d{2}:\d{2}$/.test(bfcache.plaatsTijd.trim()),"locatieklok moet direct geldig zijn na BFCache");
      assert.equal(bfcache.fetches,voor.fetches,"pageshow-freshnessfix mag geen extra weatherrequest starten");
      assert.deepEqual(bfcache.intervals,voor.intervals,"BFCache-pageshow mag de actieve intervalowners niet wijzigen");
      controleerTimerOwners(bfcache.intervals,"na BFCache");
      await context.close();
    }

    console.log("Release-herstel-E2E geslaagd: no-JS, blocked-main op root/Amsterdam, echte 12s→13s late success zonder reload, route-refresh-determinisme en BFCache-freshness/intervalownerstabiliteit.");
  }finally{
    await browser.close().catch(()=>{});
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{console.error(err&&err.stack||err);try{server.close(()=>{});}catch(_){ }process.exit(1);});