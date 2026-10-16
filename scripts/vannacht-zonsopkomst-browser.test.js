"use strict";

/* Live bug 16 okt 2026 (Montréal, 07:12–07:15): "Vannacht koelt het af naar
   ongeveer 6 graden" terwijl de komende nacht richting 0 graden ging. Het uur
   waarin de zon opkomt heeft nog is_day 0; dat uur werd als "vannacht" gelezen.
   Hier: Amsterdam 05:50 (zonsopkomst 05:44), het uur 05:00 is 15 graden en de
   echte komende nacht 9 graden. De briefing moet 9 noemen, nooit 15.
   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");
const {vindBrowser}=require("./vind-browser.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function fixture(){
  const d=bouw({temp:(u,dag)=>u>=6&&u<21?18:(dag===0&&u===5?15:9),cc:()=>60,wc:()=>3,pp:()=>5,pr:()=>0,som:0});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map(()=>3600);
  d.current.time="2026-07-22T05:45";d.current.interval=900;d.current.is_day=1;
  d.current.temperature_2m=15.5;d.current.apparent_temperature=14.5;
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
    await page.goto(root+"/weer/utrecht/",{waitUntil:"domcontentloaded"});
    await page.waitForSelector("#app",{state:"visible",timeout:10000});
    await page.waitForFunction(()=>!document.getElementById("here")?.disabled,null,{timeout:10000});
    await sleep(1500);
    const tekst=await page.evaluate(()=>document.body.innerText);
    const m=/Vannacht koelt het af naar (?:ongeveer )?(-?\d+)/.exec(tekst);
    assert(m,"briefing noemt geen nachttemperatuur: "+tekst.slice(0,400));
    assert.equal(Number(m[1]),9,`"Vannacht" hoort bij de komende nacht (9 graden), niet bij het zonsopkomstuur (15): kreeg ${m[1]}`);
    assert.deepEqual(fouten,[],"runtimefouten: "+fouten.join(" | "));
    console.log(`Vannacht na zonsopkomst groen: briefing meldt ${m[1]} graden (komende nacht), niet het zonsopkomstuur.`);
    await context.close();
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
