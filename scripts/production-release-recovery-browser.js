"use strict";

const assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const ROOT=(process.env.PRODUCTION_ROOT||"https://watishetweer.nl").replace(/\/+$/,"");
const EXPECTED_SHA=String(process.env.EXPECTED_SHA||"").trim();

const amsterdam=bouw({tempNu:17,wcNu:2,ccNu:55,pp:()=>35,som:1.2});
amsterdam.latitude=52.3676;amsterdam.longitude=4.9041;amsterdam.timezone="Europe/Amsterdam";amsterdam.utc_offset_seconds=7200;
amsterdam.daily.sunshine_duration=amsterdam.daily.time.map(()=>6*3600);
const tokyo=JSON.parse(JSON.stringify(amsterdam));
tokyo.latitude=35.6762;tokyo.longitude=139.6503;tokyo.timezone="Asia/Tokyo";tokyo.utc_offset_seconds=32400;
const air={current:{european_aqi:28,us_aqi:42},hourly:{time:[amsterdam.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[1],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};

function fixtureInit(){
  return ({ams,tokyo,air})=>{
    const NativeDate=Date,realStart=NativeDate.now(),fixtureStart=NativeDate.parse("2026-07-22T12:30:00Z");
    const offset=()=>{try{return Number(localStorage.getItem("__wiw_prod_clock_offset")||0)||0;}catch(_){return 0;}};
    class ReleaseDate extends NativeDate{
      constructor(...args){super(...(args.length?args:[fixtureStart+(NativeDate.now()-realStart)+offset()]));}
      static now(){return fixtureStart+(NativeDate.now()-realStart)+offset();}
    }
    window.Date=ReleaseDate;
    window.__wiwProdFetchCount=0;window.__wiwProdPageshowPersisted=false;
    window.addEventListener("pageshow",e=>{window.__wiwProdPageshowPersisted=!!e.persisted;});
    window.fetch=async function(url){
      window.__wiwProdFetchCount++;
      const u=String(url);
      let payload;
      if(u.includes("geocoding-api.open-meteo.com")){
        payload={results:[{name:"Tokyo",latitude:35.6762,longitude:139.6503,country_code:"JP",admin1:"Tokyo"}]};
      }else if(u.includes("/api/waarschuwingen"))payload={bron:"test",dekking:true,land:u.includes("139.650")?"JP":"NL",lijst:[]};
      else if(u.includes("/api/neerslag"))payload={beschikbaar:false,provider:"test",reden:"fixture"};
      else if(u.includes("/api/plaatsnaam"))payload={naam:"Amsterdam",land:"NL",bron:"test"};
      else if(u.includes("air-quality-api.open-meteo.com"))payload=air;
      else payload=u.includes("139.650")||u.includes("139.65")?tokyo:ams;
      return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
    };
  };
}

async function ready(page){await page.waitForFunction(()=>document.documentElement.dataset.appBootstrap==="ready",null,{timeout:10000});}
async function visibleApp(page){await page.waitForSelector("#app",{state:"visible",timeout:10000});}
async function snap(page){return page.evaluate(()=>({
  build:document.querySelector('meta[name="weather-build-sha"]')?.content||null,
  script:[...document.scripts].map(s=>s.getAttribute("src")||"").find(s=>/\/app-[0-9a-f]{12}\.min\.js$/.test(s))||null,
  url:location.href,
  plaats:(document.getElementById("place")?.getAttribute("aria-label")||"").trim(),
  briefing:(document.getElementById("brief")?.textContent||"").trim(),
  temp:(document.getElementById("t")?.textContent||"").trim(),
  uur:document.getElementById("chart")?.getAttribute("aria-label")||"",
  dag:(document.getElementById("days")?.innerText||"").trim(),
  week:(document.getElementById("days")?.textContent||"").trim(),
  canonical:document.querySelector('link[rel="canonical"]')?.href||null
}));}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    /* No-JS op root én route: duidelijke uitleg, geen nepbediening, SEO-links blijven. */
    for(const route of ["/","/weer/amsterdam/"]){
      const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:"block"});
      const page=await context.newPage();
      await page.goto(ROOT+route,{waitUntil:"domcontentloaded",timeout:30000});
      assert(await page.locator("#weather-js-required").isVisible(),`${route}: noscript-melding ontbreekt`);
      assert.equal(await page.locator(".tools").isVisible(),false,`${route}: tools mogen zonder JS niet actief ogen`);
      assert((await page.locator(".seo-plaatsnav a").count())>0,`${route}: SEO-links ontbreken zonder JS`);
      await context.close();
    }

    /* Alleen hoofdclient geblokkeerd: early watchdog moet zelfstandig herstellen naar een bruikbare foutstate. */
    {
      const context=await browser.newContext({serviceWorkers:"block"}),page=await context.newPage();
      await page.route(/\/app-[0-9a-f]{12}\.min\.js(?:\?.*)?$/,r=>r.abort("failed"));
      await page.goto(ROOT+"/",{waitUntil:"load",timeout:30000});
      await page.waitForFunction(()=>document.documentElement.dataset.appBootstrap==="failed",null,{timeout:7000});
      assert(await page.locator("#bootstrap-failure").isVisible(),"productie moet failed-JS-herstel tonen");
      assert.equal(await page.locator("#state").isVisible(),false,"eindeloze laadstate moet verdwijnen bij geblokkeerde hoofdclient");
      assert.equal(await page.locator("#q").isDisabled(),true,"zoekveld moet disabled zijn bij appstartfout");
      await page.unroute(/\/app-[0-9a-f]{12}\.min\.js(?:\?.*)?$/);
      await page.reload({waitUntil:"load",timeout:30000});await ready(page);
      assert.equal(await page.locator("#bootstrap-failure").isVisible(),false,"reload moet failed-JS-state opruimen");
      assert.equal(await page.locator("#q").isDisabled(),false,"bediening moet na recovery actief zijn");
      await context.close();
    }

    /* Vertraagde maar succesvolle hoofdclient: geen foutflits. */
    {
      const context=await browser.newContext({serviceWorkers:"block"}),page=await context.newPage();
      await page.route(/\/app-[0-9a-f]{12}\.min\.js(?:\?.*)?$/,async r=>{await new Promise(resolve=>setTimeout(resolve,1500));await r.continue();});
      await page.goto(ROOT+"/",{waitUntil:"load",timeout:30000});await ready(page);
      assert.equal(await page.locator("#bootstrap-failure").isVisible(),false,"trage succesvolle start mag geen foutstate tonen");
      await context.close();
    }

    /* Plaatsroute -> client-side Tokyo -> exacte URL refresh: dezelfde clientlogica en zichtbare state. */
    {
      const context=await browser.newContext({serviceWorkers:"block"});
      await context.addInitScript(fixtureInit(),{ams:amsterdam,tokyo,air});
      const page=await context.newPage(),pageErrors=[];page.on("pageerror",e=>pageErrors.push(String(e)));
      await page.goto(ROOT+"/weer/amsterdam/",{waitUntil:"load",timeout:30000});await visibleApp(page);
      const routeStart=await snap(page);
      if(EXPECTED_SHA)assert.equal(routeStart.build,EXPECTED_SHA,"Amsterdam-route draait niet op verwachte productie-SHA");
      await page.locator("#q").fill("Tokyo");
      await page.locator("#res div[data-lat]").first().waitFor({state:"visible",timeout:5000});
      await page.locator("#res div[data-lat]").first().click();
      await page.waitForFunction(()=>document.getElementById("place")?.getAttribute("aria-label")==="Tokyo",null,{timeout:10000});
      const voor=await snap(page);
      assert(voor.url.startsWith(ROOT+"/?"),`route-exit moet naar root-query URL gaan, kreeg ${voor.url}`);
      assert.equal(voor.canonical,ROOT+"/","client-side locatiewissel moet homepage-canonical krijgen");
      assert.equal(voor.script,routeStart.script,"plaatsroute en client-side rootstate moeten dezelfde hoofdclient gebruiken");
      const exacteUrl=voor.url;
      await page.goto(exacteUrl,{waitUntil:"load",timeout:30000});await visibleApp(page);
      const na=await snap(page);
      for(const sleutel of ["build","script","plaats","briefing","temp","uur","dag","week","canonical"]){
        assert.equal(na[sleutel],voor[sleutel],`productie refresh-determinisme wijkt af voor ${sleutel}`);
      }
      assert.deepEqual(pageErrors,[],"route-switch + refresh mag geen pageerror veroorzaken");
      await context.close();
    }

    /* Echte BFCache-return: freshness direct +2 minuten, zonder nieuwe weatherfetch. */
    {
      const context=await browser.newContext({serviceWorkers:"block"});
      await context.addInitScript(fixtureInit(),{ams:amsterdam,tokyo,air});
      const page=await context.newPage();
      await page.goto(ROOT+"/weer/amsterdam/",{waitUntil:"load",timeout:30000});await visibleApp(page);
      await page.waitForFunction(()=>/Gegevens opgehaald om/.test(document.getElementById("stamp")?.textContent||""));
      const fetchesVoor=await page.evaluate(()=>window.__wiwProdFetchCount);
      await page.goto(ROOT+"/weer/",{waitUntil:"domcontentloaded",timeout:30000});
      await page.evaluate(()=>localStorage.setItem("__wiw_prod_clock_offset","125000"));
      await page.goBack({waitUntil:"commit",timeout:15000});
      const resultaat=await page.evaluate(()=>({
        persisted:window.__wiwProdPageshowPersisted,
        stamp:document.getElementById("stamp")?.textContent||"",
        klok:document.getElementById("plaatstijd")?.textContent||"",
        fetches:window.__wiwProdFetchCount
      }));
      assert.equal(resultaat.persisted,true,"productietest moet werkelijk via BFCache terugkomen");
      assert(/2 min geleden/.test(resultaat.stamp),`freshness moet binnen pageshow direct 2 min geleden zijn, kreeg ${resultaat.stamp}`);
      assert(/^\d{2}:\d{2}$/.test(resultaat.klok.trim()),"locatieklok moet direct geldig zijn na BFCache");
      assert.equal(resultaat.fetches,fetchesVoor,"pageshow mag geen extra weatherrequest starten");
      await context.close();
    }

    console.log("Productie release-herstelbrowser geslaagd: no-JS, failed-JS/recovery, trage start, route-switch+refresh en BFCache-freshness.");
  }finally{await browser.close();}
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
