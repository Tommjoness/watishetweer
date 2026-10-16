"use strict";

/* Verslag 16 okt, onderdeel 1: de avondsamenvatting volgt nu → vannacht → morgen en noemt
   de regen van morgen met tijdvak en hoeveelheid. Hier: Amsterdam 23:43, de komende twee
   uur droog, morgen valt er tussen 17:00 en 21:00 regen (1,0 + 1,2 + 0,6 + 0,3 = 3,1 mm).
   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");
const {vindBrowser}=require("./vind-browser.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function fixture(){
  const regen={18:1.0,19:1.2,20:0.6,21:0.3};
  const d=bouw({temp:(u,dag)=>u>=6&&u<21?(dag===1?19:18):(dag===0&&u<6?14:12),cc:()=>40,wc:(u,dag)=>dag===1&&regen[u]?61:3,pp:(u,dag)=>dag===1&&regen[u]?90:3,pr:(u,dag)=>dag===1?(regen[u]||0):0,som:0});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map(()=>3600);
  d.current.time="2026-07-22T23:43";d.current.interval=900;d.current.is_day=0;
  d.current.temperature_2m=13;d.current.apparent_temperature=12;
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png",".webp":"image/webp"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:vindBrowser()||undefined});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:true,hasTouch:true});
    const page=await context.newPage(),fouten=[];
    page.on("pageerror",e=>fouten.push(String(e)));
    await page.addInitScript(()=>{const N=Date,s=N.now(),e=N.parse("2026-07-22T03:50:00Z");class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;});
    await page.route("**/*",async r=>{
      const u=new URL(r.request().url());
      if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:fixture()});
      if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:["2026-07-22T05:00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
      if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
      if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
      if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
      if(u.origin!==root)return r.fulfill({status:204,body:""});
      return r.continue();
    });
    async function lees(taal){
      await page.goto(root+"/weer/utrecht/"+(taal==="en"?"?taal=en":""),{waitUntil:"domcontentloaded"});
      await page.waitForSelector("#app",{state:"visible",timeout:10000});
      await page.waitForFunction(()=>!document.getElementById("here")?.disabled,null,{timeout:10000});
      if(taal==="en")await page.waitForFunction(()=>document.documentElement.lang==="en-GB",null,{timeout:10000});
      await sleep(1500);
      return page.evaluate(()=>document.getElementById("brief").innerText.replace(/\s+/g," ").trim());
    }
    const nl=await lees("nl");
    const iNacht=nl.indexOf("Vannacht"),iMax=nl.indexOf("Het verwachte maximum ligt morgen"),iRegen=nl.indexOf("Morgen wordt tussen 17:00 en 21:00 regen verwacht (ongeveer 3,1 mm).");
    assert(iNacht>=0&&iMax>=0&&iRegen>=0,"briefing mist vannacht, maximum of regen van morgen: "+nl);
    assert(iNacht<iMax&&iMax<iRegen,"volgorde moet nu → vannacht → morgen (maximum, regen) zijn: "+nl);
    const en=await lees("en");
    assert(/Rain is expected tomorrow between 17:00 and 21:00 \(about 3\.1 mm\)\./.test(en),"Engelse briefing mist de regen van morgen: "+en);
    assert(en.indexOf("Tonight")>=0&&en.indexOf("Tonight")<en.search(/[Tt]omorrow/),"Engelse volgorde: vannacht vóór morgen: "+en);
    assert.deepEqual(fouten,[],"runtimefouten: "+fouten.join(" | "));
    console.log("Avondbriefing groen: vannacht vóór morgen, regen van morgen met tijdvak en hoeveelheid (NL en EN).");
    await context.close();
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
