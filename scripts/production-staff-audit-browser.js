"use strict";

const assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const ROOT=String(process.env.PRODUCTION_ROOT||"https://watishetweer.nl").replace(/\/$/,"");
const verwacht=String(process.env.EXPECTED_SHA||"").trim();
if(!/^[0-9a-f]{7,40}$/i.test(verwacht))throw new Error("EXPECTED_SHA ontbreekt of is ongeldig.");

/* De workflow controleert vlak vóór deze test al de echte Open-Meteo-keten op
   vijf wereldlocaties × mobiel/desktop. Deze staff-smoke toetst daarna andere
   risico's: history, toetsenbord, touch targets, resize, metadata en invalid
   deep links. Als ook dié test opnieuw tientallen providerrequests doet vanaf
   hetzelfde CI-IP, kan Open-Meteo na de wereldmonitor tijdelijk vertragen en
   verandert een frontend-interactietest in een tweede provider-loadtest.

   Daarom blijft HTML/CSS/JS hier exact van het publieke Cloudflare-domein komen,
   inclusief de echte build-SHA en headers, maar krijgen uitsluitend de reeds in
   de vorige stap live-gevalideerde data-API's deterministische fixtures. Zo
   blijft een frontendregressie hard rood zonder dat rate limiting een vals rood
   resultaat kan geven. De aparte wereldmonitor blijft de live provider-gate. */
const locaties={
  Sydney:{lat:-33.8688,lon:151.2093,land:"AU",tz:"Australia/Sydney",offset:36000,temp:18,tijd:"2026-07-22T22:00",isDag:0},
  Amsterdam:{lat:52.3676,lon:4.9041,land:"NL",tz:"Europe/Amsterdam",offset:7200,temp:21,tijd:"2026-07-22T14:00",isDag:1}
};
function forecast(loc){
  const d=bouw({tempNu:loc.temp,wcNu:1,ccNu:25,pp:()=>22,som:3.2});
  d.latitude=loc.lat;d.longitude=loc.lon;d.timezone=loc.tz;d.utc_offset_seconds=loc.offset;
  d.current.time=loc.tijd;d.current.temperature_2m=loc.temp;d.current.apparent_temperature=loc.temp;
  d.current.weather_code=1;d.current.is_day=loc.isDag;d.current.precipitation=0;
  d.daily.sunshine_duration=d.daily.time.map(()=>7*3600);
  return d;
}
const forecasts=Object.fromEntries(Object.entries(locaties).map(([naam,loc])=>[naam,forecast(loc)]));
const air={
  current:{european_aqi:24,us_aqi:40},
  hourly:{
    time:[forecasts.Amsterdam.current.time],
    alder_pollen:[0],birch_pollen:[0],grass_pollen:[2],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]
  }
};
/* Beide locatie-fixtures stellen hetzelfde echte moment voor: Amsterdam 14:00
   en Sydney 22:00. Vijftien minuten erna voorkomt een kunstmatige grenssituatie
   exact op het uur, terwijl dag, uurdata en plaatsklok onderling kloppen. */
const fixedNow=Date.parse(forecasts.Amsterdam.current.time+"Z")-(Number(forecasts.Amsterdam.utc_offset_seconds)||0)*1000+15*60000;

function jsonFulfill(route,payload){
  return route.fulfill({
    status:200,
    contentType:"application/json; charset=utf-8",
    headers:{"access-control-allow-origin":"*","cache-control":"no-store"},
    body:JSON.stringify(payload)
  });
}
async function installeerDeterministischeData(context){
  await context.addInitScript(now=>{Date.now=()=>now;},fixedNow);
  await context.route("**/*",async route=>{
    const rauw=route.request().url();
    let u=null;try{u=new URL(rauw);}catch(_){return route.continue();}

    if(u.hostname==="geocoding-api.open-meteo.com"&&u.pathname==="/v1/search"){
      const q=(u.searchParams.get("name")||"").trim().toLowerCase();
      const item=Object.entries(locaties).find(([naam])=>naam.toLowerCase()===q);
      if(!item)return jsonFulfill(route,{results:[]});
      const [naam,loc]=item;
      return jsonFulfill(route,{results:[{name:naam,latitude:loc.lat,longitude:loc.lon,admin1:"Testregio",country_code:loc.land}]});
    }
    if(u.hostname==="api.open-meteo.com"&&u.pathname==="/v1/forecast"){
      const lat=Number(u.searchParams.get("latitude"));
      const item=Object.entries(locaties).find(([,loc])=>Math.abs(loc.lat-lat)<0.01);
      return jsonFulfill(route,item?forecasts[item[0]]:forecasts.Amsterdam);
    }
    if(u.hostname==="air-quality-api.open-meteo.com")return jsonFulfill(route,air);

    if(u.origin===ROOT&&u.pathname==="/api/waarschuwingen"){
      const land=(u.searchParams.get("land")||"").toUpperCase();
      return jsonFulfill(route,{bron:"productie-interactiefixture",dekking:true,land:land||null,lijst:[]});
    }
    if(u.origin===ROOT&&u.pathname==="/api/neerslag")return jsonFulfill(route,{beschikbaar:false,provider:"knmi",reden:"niet beschikbaar"});
    if(u.origin===ROOT&&u.pathname==="/api/plaatsnaam")return jsonFulfill(route,{naam:null,land:null,bron:"productie-interactiefixture"});
    return route.continue();
  });
}

/* Cloudflare kan op het publieke domein zijn eigen Browser Insights-beacon in
   de HTML injecteren. Onze CSP staat bewust alleen eigen scripts toe, waardoor
   Chromium die platforminjectie blokkeert en daar een console-error voor meldt.
   Dat is geen applicatiefout en we willen de CSP niet verruimen voor analytics.
   Alleen deze exact herkenbare, geblokkeerde Cloudflare-beacon wordt daarom uit
   de console-errorgate gefilterd; alle andere console- en pageerrors blijven
   onverkort een productiefout. */
function verwachteCloudflareInsightsCspMelding(tekst){
  const t=String(tekst||"");
  return t.includes("https://static.cloudflareinsights.com/beacon.min.js/")
    &&t.includes("violates the following Content Security Policy directive")
    &&t.includes("script-src 'self' 'unsafe-inline'")
    &&t.includes("The action has been blocked");
}

async function wachtVolledig(page,naam){
  try{
    await page.waitForFunction(n=>{
      const app=document.getElementById("app");
      if(!app)return false;
      const stijl=getComputedStyle(app);
      const zichtbaar=stijl.display!=="none"&&stijl.visibility!=="hidden";
      const plaats=document.getElementById("place")?.getAttribute("aria-label")||"";
      const dagen=document.querySelectorAll("#days .row.day:not(.kop)").length;
      return zichtbaar&&plaats===n&&dagen===7;
    },naam,{timeout:10000});
  }catch(err){
    const diagnose=await page.evaluate(()=>{
      const app=document.getElementById("app"),state=document.getElementById("state");
      const stijl=app?getComputedStyle(app):null;
      return {
        href:location.href,
        build:document.querySelector('meta[name="weather-build-sha"]')?.content||"",
        appAanwezig:!!app,
        appDisplay:stijl&&stijl.display||null,
        appVisibility:stijl&&stijl.visibility||null,
        appClass:app&&app.className||"",
        appBusy:app&&app.getAttribute("aria-busy")||null,
        plaats:document.getElementById("place")?.getAttribute("aria-label")||"",
        dagen:document.querySelectorAll("#days .row.day:not(.kop)").length,
        state:(state?.textContent||"").trim(),
        stateClass:state&&state.className||""
      };
    }).catch(()=>({diagnose:"browser-evaluatie mislukt"}));
    throw new Error(`Productie-interactiefixture werd niet volledig voor ${naam}: ${JSON.stringify(diagnose)}; oorzaak=${err&&err.message||err}`);
  }
}
async function kiesZoekresultaat(page,naam){
  const q=page.locator("#q");await q.fill(naam);
  await page.waitForSelector("#res.on div[data-lat]",{timeout:5000});
  const exact=page.locator("#res div[data-lat]").filter({hasText:new RegExp("^"+naam.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i")}).first();
  if(await exact.count())await exact.click();else await page.locator("#res div[data-lat]").first().click();
  await wachtVolledig(page,naam);
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},locale:"nl-NL",serviceWorkers:"block"});
    await installeerDeterministischeData(context);
    const page=await context.newPage(),errors=[];
    page.on("pageerror",e=>errors.push(String(e)));
    page.on("console",m=>{
      if(m.type()!=="error")return;
      const tekst=m.text();
      if(!verwachteCloudflareInsightsCspMelding(tekst))errors.push(tekst);
    });

    const start=ROOT+"/?lat=-33.8688&lon=151.2093&plaats=Sydney&land=AU";
    const response=await page.goto(start,{waitUntil:"domcontentloaded",timeout:30000});
    assert(response&&response.ok(),`Sydney start HTTP ${response&&response.status()}`);
    await wachtVolledig(page,"Sydney");
    await page.evaluate(()=>document.fonts&&document.fonts.ready);
    const eerste=await page.evaluate(()=>({
      sha:document.querySelector('meta[name="weather-build-sha"]')?.content||"",
      uur:[...document.querySelectorAll("#chart text")].filter(el=>/^\d{2}$/.test((el.textContent||"").trim())).length,
      tabel:document.querySelectorAll("#chartdata tbody tr").length,
      main:document.querySelectorAll("main#app").length,
      skip:!!document.querySelector('.skiplink[href="#app"]'),
      og:document.querySelector('meta[property="og:image"]')?.content||"",
      twitter:document.querySelector('meta[name="twitter:image"]')?.content||""
    }));
    assert.equal(eerste.sha,verwacht,`verkeerde productiebuild ${eerste.sha}`);
    assert(eerste.uur>0,"uurlabels ontbreken op de eerste mobiele render");
    assert(eerste.tabel>0,"toegankelijke grafiektabel is leeg");
    assert.equal(eerste.main,1,"productie heeft niet exact één main-landmark");
    assert(eerste.skip,"skiplink ontbreekt op productie");
    assert.equal(eerste.og,ROOT+"/icon-512.png","og:image wijkt af");
    assert.equal(eerste.twitter,ROOT+"/icon-512.png","twitter:image wijkt af");

    const grafiekSummary=page.locator("#chartdata > summary");
    await grafiekSummary.focus();await page.keyboard.press("Enter");
    assert(await page.locator("#chartdata").evaluate(el=>el.open),"grafiekgegevens openen niet met toetsenbord");

    await kiesZoekresultaat(page,"Amsterdam");
    assert(/plaats=Amsterdam/.test(page.url()),`Amsterdam-keuze synchroniseert URL niet: ${page.url()}`);
    await page.goBack({waitUntil:"domcontentloaded"});await wachtVolledig(page,"Sydney");
    assert(/plaats=Sydney/.test(page.url()),`Back herstelt Sydney-URL niet: ${page.url()}`);
    await page.goForward({waitUntil:"domcontentloaded"});await wachtVolledig(page,"Amsterdam");
    assert(/plaats=Amsterdam/.test(page.url()),`Forward herstelt Amsterdam-URL niet: ${page.url()}`);
    assert.equal(await page.title(),"Amsterdam · watishetweer.nl","Forward synchroniseert titel niet");

    const add=page.locator("#chipadd");if(await add.count())await add.click();
    const del=page.locator(".chip .x").first();
    assert(await del.count(),"bewaarde locatie heeft geen verwijderknop");
    for(const width of [320,360,375,390,430]){
      await page.setViewportSize({width,height:844});await page.waitForTimeout(50);
      const box=await del.boundingBox();
      assert(box&&box.width>=39.5&&box.height>=39.5,`${width}px: verwijdertarget ${box&&box.width}x${box&&box.height}`);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      assert(overflow<=2,`${width}px: ${overflow}px pagina-overflow`);
    }

    await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(100);
    const resized=await page.evaluate(()=>({
      uur:[...document.querySelectorAll("#chart text")].filter(el=>/^\d{2}$/.test((el.textContent||"").trim())).length,
      tabel:document.querySelectorAll("#chartdata tbody tr").length,
      overflow:document.documentElement.scrollWidth-window.innerWidth
    }));
    assert(resized.uur>0&&resized.tabel>0,"resize verloor grafieklabels of toegankelijke data");
    assert(resized.overflow<=2,`1280px: ${resized.overflow}px pagina-overflow`);

    /* Zelfde context behoudt Amsterdam als persoonlijke laatst-gebruikte plaats.
       Een beschadigde gedeelde URL moet desondanks fail-closed blijven. */
    const invalid=await context.newPage();
    const invalidResponse=await invalid.goto(ROOT+"/?lat=52abc&lon=5&plaats=KapotteLink",{waitUntil:"domcontentloaded",timeout:30000});
    assert(invalidResponse&&invalidResponse.ok(),`kapotte share-URL HTTP ${invalidResponse&&invalidResponse.status()}`);
    await invalid.waitForFunction(()=>/ongeldig/i.test(document.getElementById("state")?.textContent||""),null,{timeout:8000});
    const fout=await invalid.evaluate(()=>({
      state:(document.getElementById("state")?.textContent||"").trim(),
      app:getComputedStyle(document.getElementById("app")).display,
      plaats:document.getElementById("place")?.getAttribute("aria-label")||""
    }));
    assert(/gedeelde locatie is ongeldig/i.test(fout.state),`kapotte link mist expliciete melding: ${fout.state}`);
    assert.equal(fout.app,"none","kapotte link toont weerdata");
    assert.notEqual(fout.plaats,"Amsterdam","kapotte link toont oude plaatsidentiteit");
    await invalid.close();

    assert.deepEqual(errors,[],`productie-browserfouten: ${errors.join(" | ")}`);
    console.log(`PRODUCTIE STAFF-AUDIT GESLAAGD: ${verwacht}; echte Cloudflare-frontend met deterministische datafixture: eerste grafiekstate, tabel/keyboard, Sydney→Amsterdam Back/Forward, 320–430px targets, resize, metadata en invalid deep link.`);
    await context.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
