"use strict";

const assert=require("assert");
const {chromium}=require("playwright");

const ROOT=String(process.env.PRODUCTION_ROOT||process.env.PREVIEW_ROOT||"https://watishetweer.nl").replace(/\/$/,"");
const EXPECTED_SHA=String(process.env.EXPECTED_SHA||"").trim();

function timeout(promise,ms,label){
  let timer=null;
  return Promise.race([
    promise,
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+" timeout na "+ms+" ms")),ms);})
  ]).finally(()=>{if(timer!==null)clearTimeout(timer);});
}

function volledigeForecastDekking(payload){
  const uren=payload&&payload.hourly&&payload.hourly.time,dagen=payload&&payload.daily&&payload.daily.time;
  return Array.isArray(uren)&&Array.isArray(dagen)&&dagen.length===7&&dagen.every(dag=>{
    const aantal=uren.filter(uur=>typeof uur==="string"&&uur.startsWith(dag+"T")).length;
    return aantal>=23&&aantal<=25;
  });
}

function verwachteOpenMeteo503(msg){
  if(!msg||msg.type()!=="error")return false;
  const tekst=String(msg.text()||"");
  const locatie=msg.location&&msg.location();
  const url=String(locatie&&locatie.url||"");
  return /^https:\/\/api\.open-meteo\.com\/v1\/forecast(?:\?|$)/i.test(url)
    && /Failed to load resource: the server responded with a status of 503/i.test(tekst);
}

(async()=>{
  assert(EXPECTED_SHA,"EXPECTED_SHA ontbreekt voor WeatherAPI live-fallbackbewijs");
  const browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext({
      serviceWorkers:"block",
      viewport:{width:390,height:844},
      locale:"nl-NL",
      timezoneId:"Europe/Amsterdam"
    });
    const page=await context.newPage();
    const consoleErrors=[],pageErrors=[];
    let openMeteoForecasts=0,verwachteOpenMeteoErrors=0;
    page.on("console",msg=>{
      if(msg.type()!=="error")return;
      if(verwachteOpenMeteo503(msg)){
        verwachteOpenMeteoErrors++;
        return;
      }
      const locatie=msg.location&&msg.location();
      const url=String(locatie&&locatie.url||"");
      consoleErrors.push(msg.text()+(url?` @ ${url}`:""));
    });
    page.on("pageerror",error=>pageErrors.push(error&&error.message||String(error)));
    await page.route(/^https:\/\/api\.open-meteo\.com\/v1\/forecast(?:\?|$)/,async route=>{
      openMeteoForecasts++;
      await route.fulfill({
        status:503,
        contentType:"application/json",
        body:JSON.stringify({reason:"gerichte testuitval Open-Meteo"})
      });
    });

    const fallbackResponse=page.waitForResponse(response=>{
      try{return new URL(response.url()).pathname==="/api/forecast";}
      catch{return false;}
    });
    await page.goto(ROOT+"/?weatherapi-fallback-proof="+Date.now(),{waitUntil:"domcontentloaded",timeout:30000});
    const response=await timeout(fallbackResponse,20000,"WeatherAPI fallbackresponse");
    assert.equal(response.status(),200,"WeatherAPI fallbackroute is niet 200");
    assert.equal(response.headers()["x-wiw-weather-source"],"weatherapi","fallbackroute mist bronbewijs");
    const payload=await response.json();
    assert.equal(payload&&payload.provider,"weatherapi","fallbackpayload mist provider");
    assert.equal(payload&&payload.daily&&payload.daily.time&&payload.daily.time.length,7,"fallbackpayload mist zeven volledige dagen");
    assert(volledigeForecastDekking(payload),"fallbackpayload mist volledige uurdekking voor een of meer kalenderdagen");

    await page.waitForFunction(()=>{
      const app=document.getElementById("app"),temp=document.getElementById("t"),brief=document.getElementById("brief");
      return app&&getComputedStyle(app).display!=="none"
        &&temp&&!/^\s*(?:--|–)?\s*$/.test(temp.textContent||"")
        &&brief&&String(brief.textContent||"").trim().length>20;
    },null,{timeout:20000});

    const bewijs=await page.evaluate(expectedSha=>({
      build:document.querySelector('meta[name="weather-build-sha"]')?.content||"",
      place:(document.getElementById("place")?.getAttribute("aria-label")||"").trim(),
      temp:(document.getElementById("t")?.textContent||"").trim(),
      briefing:(document.getElementById("brief")?.textContent||"").trim(),
      days:document.querySelectorAll("#days .day:not(.kop)").length,
      chartNodes:document.getElementById("chart")?.childElementCount||0,
      ready:window.__WEATHERNOW_APP_READY__===true&&document.documentElement.dataset.appBootstrap==="ready",
      expectedSha
    }),EXPECTED_SHA);
    assert.equal(bewijs.build,EXPECTED_SHA,"pagina serveert niet de verwachte SHA");
    assert(bewijs.place,"geselecteerde locatie ontbreekt na WeatherAPI fallback");
    assert(/^-?\d+/.test(bewijs.temp),"zichtbare temperatuur ontbreekt na WeatherAPI fallback");
    assert.equal(bewijs.days,7,"weekweergave bevat niet zeven dagen");
    assert(bewijs.chartNodes>=1,"uur-/etmaalgrafiek ontbreekt na WeatherAPI fallback");
    assert.equal(bewijs.ready,true,"app-readycontract ontbreekt na WeatherAPI fallback");
    assert(openMeteoForecasts>=2,"gerichte test heeft niet zowel volledige als lichte Open-Meteo-aanvraag laten falen");
    assert.deepEqual(pageErrors,[],"page errors tijdens fallback: "+pageErrors.join(" | "));
    assert.deepEqual(consoleErrors,[],"onverwachte console errors tijdens fallback: "+consoleErrors.join(" | "));

    console.log(JSON.stringify({ok:true,root:ROOT,openMeteoForecasts,verwachteOpenMeteoErrors,provider:payload.provider,bewijs},null,2));
    await context.close();
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error&&error.stack||error);process.exit(1);});
