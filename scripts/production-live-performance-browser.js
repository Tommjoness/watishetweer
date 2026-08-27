"use strict";

const assert=require("assert");
const {chromium,webkit,devices}=require("playwright");

const ROOT=String(process.env.PRODUCTION_ROOT||"https://watishetweer.nl").replace(/\/$/,"");
const verwacht=String(process.env.EXPECTED_SHA||"").trim();
if(!/^[0-9a-f]{7,40}$/i.test(verwacht))throw new Error("EXPECTED_SHA ontbreekt of is ongeldig.");

const profielen=[
  {naam:"Chromium desktop",type:chromium,opties:{viewport:{width:1440,height:1000}}},
  {naam:"WebKit iPhone",type:webkit,opties:{...devices["iPhone 13"]}}
];
const LIMIET={dom:10000,weer:15000,grafiek:18000};

function isForecast(url){try{const u=new URL(url);return u.hostname==="api.open-meteo.com"&&u.pathname==="/v1/forecast";}catch(e){return false;}}
function isBeacon(url){return /cloudflareinsights|beacon\.min\.js|\/cdn-cgi\/(?:rum|trace)/i.test(String(url));}

(async()=>{
  for(const profiel of profielen){
    const browser=await profiel.type.launch({headless:true});
    try{
      const context=await browser.newContext({...profiel.opties,locale:"nl-NL",serviceWorkers:"block"});
      const page=await context.newPage(),requests=[],responses=[],mislukt=[],consoleErrors=[],pageErrors=[];
      page.on("request",r=>requests.push(r.url()));
      page.on("response",r=>responses.push({url:r.url(),status:r.status()}));
      page.on("requestfailed",r=>mislukt.push({url:r.url(),fout:r.failure()?.errorText||"mislukt"}));
      page.on("console",m=>{if(m.type()==="error")consoleErrors.push(m.text());});
      page.on("pageerror",e=>pageErrors.push(String(e)));

      const params=new URLSearchParams({lat:"52.3508",lon:"5.2647",plaats:"Almere",land:"NL"});
      const start=Date.now();
      const response=await page.goto(ROOT+"/?"+params,{waitUntil:"domcontentloaded",timeout:30000});
      const domMs=Date.now()-start;
      assert(response&&response.ok(),`${profiel.naam}: homepage HTTP ${response&&response.status()}`);
      await page.waitForFunction(()=>{
        const app=document.getElementById("app"),temp=document.getElementById("t"),stamp=document.getElementById("stamp");
        return app&&getComputedStyle(app).display!=="none"&&temp&&!/^(?:--|–)$/.test(temp.textContent.trim())&&/^Gegevens opgehaald om \d{2}:\d{2}/.test(stamp?.textContent||"");
      },null,{timeout:LIMIET.weer});
      const weerMs=Date.now()-start;
      await page.waitForFunction(()=>{
        const chart=document.getElementById("chart");
        return chart&&chart.getBoundingClientRect().width>250&&chart.querySelectorAll("text").length>=4;
      },null,{timeout:LIMIET.grafiek});
      const grafiekMs=Date.now()-start;

      const sha=await page.locator('meta[name="weather-build-sha"]').getAttribute("content");
      assert.equal(sha,verwacht,`${profiel.naam}: verkeerde build ${sha}`);
      assert(domMs<LIMIET.dom,`${profiel.naam}: DOMContentLoaded ${domMs}ms overschrijdt ${LIMIET.dom}ms`);
      assert(weerMs<LIMIET.weer,`${profiel.naam}: zichtbare weerdata ${weerMs}ms overschrijdt ${LIMIET.weer}ms`);
      assert(grafiekMs<LIMIET.grafiek,`${profiel.naam}: bruikbare grafiek ${grafiekMs}ms overschrijdt ${LIMIET.grafiek}ms`);

      const succesvolleForecasts=responses.filter(r=>isForecast(r.url)&&r.status>=200&&r.status<300);
      assert.equal(succesvolleForecasts.length,1,`${profiel.naam}: verwacht één succesvolle Open-Meteo-forecast, kreeg ${succesvolleForecasts.length}`);
      const forecastUrl=new URL(succesvolleForecasts[0].url);
      assert.equal(forecastUrl.searchParams.get("forecast_hours"),"170",`${profiel.naam}: forecast_hours wijkt af`);
      assert.equal(forecastUrl.searchParams.get("past_hours"),"24",`${profiel.naam}: past_hours wijkt af`);
      const beacons=requests.filter(isBeacon);
      assert.equal(beacons.length,0,`${profiel.naam}: Cloudflare Analytics-beacon werd geïnjecteerd: ${beacons.join(" | ")}`);

      const voorKlik=responses.filter(r=>isForecast(r.url)).length;
      await page.locator("#days .row.day:not(.kop)").nth(1).click();
      await page.waitForFunction(()=>document.querySelector("#days .row.day.on")?.getAttribute("data-i")==="1",null,{timeout:5000});
      await page.waitForTimeout(300);
      assert.equal(responses.filter(r=>isForecast(r.url)).length,voorKlik,`${profiel.naam}: dagselectie veroorzaakte een dubbele forecastaanvraag`);

      await page.evaluate(async()=>{
        const wacht=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        for(const y of [0,document.body.scrollHeight*.33,document.body.scrollHeight*.66,document.body.scrollHeight]){scrollTo(0,y);await wacht();}
      });
      const ui=await page.evaluate(()=>({
        overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth,
        chartWidth:document.getElementById("chart")?.getBoundingClientRect().width||0,
        dagen:document.querySelectorAll("#days .row.day:not(.kop)").length
      }));
      assert(ui.overflow<=1,`${profiel.naam}: ${ui.overflow}px horizontale overflow na scrollen`);
      assert(ui.chartWidth>250,`${profiel.naam}: grafiek niet bruikbaar na scrollen`);
      assert.equal(ui.dagen,7,`${profiel.naam}: dagtabel verloor rijen tijdens scrollen`);
      assert.deepEqual(pageErrors,[],`${profiel.naam}: pageerrors ${pageErrors.join(" | ")}`);
      assert.deepEqual(consoleErrors,[],`${profiel.naam}: console-errors ${consoleErrors.join(" | ")}`);
      assert(!mislukt.some(x=>isForecast(x.url)),`${profiel.naam}: mislukte forecastaanvraag ${mislukt.map(x=>x.url+": "+x.fout).join(" | ")}`);

      const herkomsten={};for(const url of requests){try{const o=new URL(url).origin;herkomsten[o]=(herkomsten[o]||0)+1;}catch(e){}}
      console.log(JSON.stringify({profiel:profiel.naam,sha,domMs,weerMs,grafiekMs,forecastRequests:succesvolleForecasts.length,totaalRequests:requests.length,herkomsten,overflow:ui.overflow}));
      await context.close();
    }finally{await browser.close();}
  }
  console.log(`LIVE PERFORMANCE GESLAAGD: ${verwacht}; Chromium desktop en WebKit iPhone, één forecastaanvraag, grafiekinteractie en volledige scroll.`);
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
