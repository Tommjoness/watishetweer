"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("./data.js");

const ROOT=__dirname,PUBLIC=path.join(ROOT,"public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("Definitieve public-artifact ontbreekt voor release-herstel-E2E.");

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
  res.writeHead(200,{"content-type":mime[path.extname(bestand).toLowerCase()]||"application/octet-stream","cache-control":"no-store"});
  fs.createReadStream(bestand).pipe(res);
});

function fetchFixtureScript(){
  return ({weather,air})=>{
    const NativeDate=Date,realStart=NativeDate.now(),fixtureStart=NativeDate.parse("2026-07-22T12:30:00Z");
    const offset=()=>{try{return Number(localStorage.getItem("__wiw_clock_offset")||0)||0;}catch(_){return 0;}};
    class ReleaseDate extends NativeDate{
      constructor(...args){super(...(args.length?args:[fixtureStart+(NativeDate.now()-realStart)+offset()]));}
      static now(){return fixtureStart+(NativeDate.now()-realStart)+offset();}
    }
    window.Date=ReleaseDate;
    window.__wiwFetchCount=0;window.__wiwPageshowPersisted=false;
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

async function wachtReady(page){
  await page.waitForFunction(()=>document.documentElement.dataset.appBootstrap==="ready",null,{timeout:10000});
}
async function snapshot(page){
  return page.evaluate(()=>({
    build:document.querySelector('meta[name="weather-build-sha"]')?.content||null,
    script:[...document.scripts].map(s=>s.getAttribute("src")||"").find(s=>/\/app-[0-9a-f]{12}\.min\.js$/.test(s))||null,
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

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true});
  try{
    /* WIW-002: volledig zonder JavaScript op root en statische plaatsroute. */
    for(const route of ["/","/weer/amsterdam/"]){
      const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:"block"});
      const page=await context.newPage();
      await page.goto(base+route,{waitUntil:"load"});
      assert(await page.locator("#weather-js-required").isVisible(),`${route}: noscript-melding moet zichtbaar zijn`);
      assert.equal(await page.locator(".tools").isVisible(),false,`${route}: bediening mag zonder JS niet actief ogen`);
      assert((await page.locator(".seo-plaatsnav a").count())>0,`${route}: SEO-plaatslinks moeten zonder JS bruikbaar blijven`);
      await context.close();
    }

    /* WIW-002: alleen hoofdapp blokkeren; onafhankelijke early-watchdog blijft draaien. */
    {
      const context=await browser.newContext({serviceWorkers:"block"});
      const page=await context.newPage();
      const errors=[];page.on("pageerror",e=>errors.push(String(e)));
      await page.route(/\/app-[0-9a-f]{12}\.min\.js$/,r=>r.abort("failed"));
      await page.goto(base+"/",{waitUntil:"load"});
      await page.waitForFunction(()=>document.documentElement.dataset.appBootstrap==="failed",null,{timeout:5000});
      assert(await page.locator("#bootstrap-failure").isVisible(),"geblokkeerde hoofdapp moet duidelijke herstelstate tonen");
      assert.equal(await page.locator("#state").isVisible(),false,"oude eindeloze laadstate moet bij appstartfout verdwijnen");
      assert.equal(await page.locator("#q").isDisabled(),true,"zoekveld moet bij appstartfout disabled zijn");
      assert.equal(await page.locator("#here").isDisabled(),true,"locatieknop moet bij appstartfout disabled zijn");
      await page.unroute(/\/app-[0-9a-f]{12}\.min\.js$/);
      await page.reload({waitUntil:"load"});
      await wachtReady(page);
      assert.equal(await page.locator("#bootstrap-failure").isVisible(),false,"reload recovery moet failed-JS-state volledig verwijderen");
      assert.equal(await page.locator("#q").isDisabled(),false,"bediening moet na succesvolle recovery weer actief zijn");
      assert.deepEqual(errors,[],"failed-JS/recoverypad mag geen pageerror veroorzaken");
      await context.close();
    }

    /* Trage maar succesvolle appstart mag de foutstate niet laten zien. */
    {
      const context=await browser.newContext({serviceWorkers:"block"});
      const page=await context.newPage();
      await page.route(/\/app-[0-9a-f]{12}\.min\.js$/,async r=>{await new Promise(resolve=>setTimeout(resolve,1500));await r.continue();});
      await page.goto(base+"/",{waitUntil:"load"});
      await wachtReady(page);
      assert.equal(await page.locator("#bootstrap-failure").isVisible(),false,"vertraagde succesvolle hoofdapp mag geen foutstate tonen");
      await context.close();
    }

    /* WIW-001: dezelfde plaatsroute + brondata blijft vóór/na refresh inhoudelijk identiek. */
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
      for(const sleutel of ["build","script","plaats","briefing","temperatuur","uurdata","dagdata","weekdata","canonical"]){
        assert.equal(na[sleutel],voor[sleutel],`refresh-determinisme wijkt af voor ${sleutel}`);
      }
      assert.deepEqual(errors,[],"route/refresh-determinisme mag geen pageerror veroorzaken");
      await context.close();
    }

    /* WIW-003: BFCache-terugkeer rendert klok/freshness meteen, zonder fetch of timerherstart. */
    {
      const context=await browser.newContext({serviceWorkers:"block"});
      await context.addInitScript(fetchFixtureScript(),{weather:fixture,air});
      const page=await context.newPage();
      await page.goto(base+"/weer/amsterdam/",{waitUntil:"load"});
      await page.waitForSelector("#app",{state:"visible",timeout:10000});
      await page.waitForFunction(()=>/Gegevens opgehaald om/.test(document.getElementById("stamp")?.textContent||""));
      const fetchesVoor=await page.evaluate(()=>window.__wiwFetchCount);
      await page.goto(base+"/weer/",{waitUntil:"load"});
      await page.evaluate(()=>localStorage.setItem("__wiw_clock_offset","125000"));
      await page.goBack({waitUntil:"commit"});
      await page.waitForSelector("#stamp",{state:"attached",timeout:5000});
      const bfcache=await page.evaluate(()=>({
        persisted:window.__wiwPageshowPersisted,
        stamp:document.getElementById("stamp")?.textContent||"",
        fetches:window.__wiwFetchCount,
        plaatsTijd:document.getElementById("plaatstijd")?.textContent||""
      }));
      assert.equal(bfcache.persisted,true,"Chromium moet deze terugkeer werkelijk uit BFCache herstellen");
      assert(/2 min geleden/.test(bfcache.stamp),`freshnesslabel moet direct 2 min geleden tonen, kreeg: ${bfcache.stamp}`);
      assert(/^\d{2}:\d{2}$/.test(bfcache.plaatsTijd.trim()),"locatieklok moet direct geldig zijn na BFCache");
      assert.equal(bfcache.fetches,fetchesVoor,"pageshow-freshnessfix mag geen extra weatherrequest starten");
      await context.close();
    }

    console.log("Release-herstel-E2E geslaagd: no-JS, failed-JS + recovery, trage start, route-refresh-determinisme en BFCache-freshness zonder extra fetch.");
  }finally{
    await browser.close().catch(()=>{});
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{console.error(err&&err.stack||err);try{server.close(()=>{});}catch(_){ }process.exit(1);});
