"use strict";

/* Leesbaarheid op het finale artifact, met de echte runtime.
   Geen zichtbare tekst buiten de grafiek onder 11px; waarden en gewone tekst
   (uurtabel, tijdstempel, mm, maan, footer) minstens 12px.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function fixture(){
  const d=bouw({som:0});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map(()=>21600);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,16));}
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

async function open(browser,root,w,h,colorScheme){
  const context=await browser.newContext({viewport:{width:w,height:h},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:w<700,hasTouch:w<700,colorScheme});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  /* 21:30 lokaal: na zonsondergang. Auto hoort toch het systeem te volgen. */
  await page.addInitScript(()=>{const N=Date,s=N.now(),e=N.parse("2026-07-22T19:30:00Z");class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;});
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:fixture()});
    if(u.hostname==="geocoding-api.open-meteo.com")return r.fulfill({json:{results:[{name:"Amsterdam",latitude:52.37,longitude:4.89,country_code:"NL",admin1:"Noord-Holland",country:"Nederland"},{name:"Amstelveen",latitude:52.3,longitude:4.86,country_code:"NL",admin1:"Noord-Holland",country:"Nederland"}]}});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:["2026-07-22T21:00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+"/weer/utrecht/",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:10000});
  await page.waitForFunction(()=>!document.getElementById("q")?.disabled,null,{timeout:10000});
  await sleep(700);
  return {context,page,fouten};
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [w,h] of [[390,844],[1440,900]]){
      const {context,page,fouten}=await open(browser,root,w,h,"light");
      try{
        const m=await page.evaluate(()=>{
          const zichtbaar=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none";};
          const klein=[];
          for(const e of document.querySelectorAll("body *")){
            if(e.closest("svg,.sr-only,.wiw-visually-hidden,#scrub")||!zichtbaar(e))continue;
            const eigen=[...e.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).map(n=>n.textContent.trim()).join(" ");
            if(!eigen)continue;
            const f=parseFloat(getComputedStyle(e).fontSize);
            if(f>0&&f<10.95)klein.push(f.toFixed(1)+"px «"+eigen.slice(0,30)+"»");
          }
          const waarden=[...document.querySelectorAll((innerWidth<=900?".wiw-hour-secondary,.wiw-hour-date,":"")+"small.q1-dag-mm,#stamp,#final-rain-summary,#moonlab span,footer a,.nachtvenster")].filter(zichtbaar).map(e=>({t:(e.textContent||"").trim().slice(0,24),f:parseFloat(getComputedStyle(e).fontSize)}));
          return {klein,waarden,overflow:document.documentElement.scrollWidth-innerWidth};
        });
        assert.deepEqual(m.klein,[],w+"px: zichtbare tekst onder 11px: "+m.klein.join(" · "));
        assert(m.waarden.length>=5,w+"px: te weinig waardeteksten gevonden: "+JSON.stringify(m.waarden));
        for(const v of m.waarden)assert(v.f>=11.95,w+"px: waarde '"+v.t+"' is "+v.f+"px (minimaal 12px)");
        assert(m.overflow<=1,w+"px: horizontale overflow "+m.overflow+"px");
        assert.deepEqual(fouten,[],w+"px: runtimefouten "+fouten.join(" | "));
        console.log("LEESBAARHEID "+w+"px: geen tekst onder 11px, "+m.waarden.length+" waarden van minstens 12px.");
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Leesbaarheid OK op 390 en 1440px.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});
