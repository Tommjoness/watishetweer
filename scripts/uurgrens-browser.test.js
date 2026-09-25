"use strict";

/* Huidig uur rond het hele uur, op het finale artifact met de echte runtime.
   De actuele meting van de bron loopt vaak een kwartier achter: om 17:00:20
   zegt current.time nog 16:45. Grafiek, briefing en uurtabel moeten dan toch
   bij 17:00 beginnen, zodat de mobiele uurtabel 23 komende uren toont en niet
   22. Een klok die meer dan drie uur voorloopt op de meting verschuift niets.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function fixture(meting){
  const d=bouw({som:0});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map(()=>21600);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,16));}
  d.current.time=meting;
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

async function open(browser,root,w,h,meting){
  const context=await browser.newContext({viewport:{width:w,height:h},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:w<700,hasTouch:w<700});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  /* 17:00:20 in Amsterdam */
  await page.addInitScript(()=>{const N=Date,s=N.now(),e=N.parse("2026-07-22T15:00:20Z");class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;});
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:fixture(meting)});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:["2026-07-22T17:00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+"/weer/utrecht/",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:10000});
  await page.waitForFunction(()=>document.querySelectorAll("#wiw-hour-table tbody tr").length>0&&typeof S!=="undefined"&&S.geo&&Array.isArray(S.geo.TI),null,{timeout:10000});
  await sleep(800);
  return {context,page,fouten};
}

const meet=()=>({
  rijen:[...document.querySelectorAll("#wiw-hour-table tbody tr")].map(tr=>(tr.querySelector("time")?.textContent||tr.cells[0]?.textContent||"").trim().slice(0,5)),
  grafiekStart:S.geo.TI[0],
  actueelUur:S.d.hourly.time[S.i0]
});

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [w,h] of [[320,844],[390,844]]){
      for(const meting of ["2026-07-22T17:00","2026-07-22T16:45"]){
        const label=w+"px, meting "+meting.slice(11);
        const {context,page,fouten}=await open(browser,root,w,h,meting);
        try{
          const m=await page.evaluate(meet);
          assert.equal(m.actueelUur,"2026-07-22T17:00",label+": huidig uur volgt de klok niet");
          assert.equal(m.grafiekStart,"2026-07-22T17:00",label+": grafiek begint niet bij het uur van de klok");
          assert.equal(m.rijen.length,23,label+": uurtabel toont "+m.rijen.length+" in plaats van 23 komende uren: "+m.rijen.join(","));
          assert.equal(m.rijen[0],"18:00",label+": eerste komende uur is "+m.rijen[0]);
          assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
          console.log("UURGRENS "+label+": grafiek vanaf 17:00, 23 komende uren vanaf 18:00.");
        }finally{await context.close();}
      }
    }
    /* Een meting ruim vier uur achter de klok: de klok telt niet, de bron blijft leidend. */
    const {context,page,fouten}=await open(browser,root,390,844,"2026-07-22T12:45");
    try{
      const m=await page.evaluate(meet);
      assert.equal(m.actueelUur,"2026-07-22T12:00","390px, meting 12:45: een klok die meer dan drie uur voorloopt mag het huidige uur niet verschuiven");
      assert.deepEqual(fouten,[],"390px, meting 12:45: runtimefouten "+fouten.join(" | "));
      console.log("UURGRENS 390px, meting 12:45: klok loopt te ver voor, huidig uur blijft 12:00.");
    }finally{await context.close();}
  }finally{await browser.close();server.close();}
  console.log("Uurgrens OK: rond het hele uur 23 komende uren op 320 en 390px.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});
