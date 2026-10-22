"use strict";

/* Eerste scherm (eigenaar 15 oktober, variant A voor de telefoon; UX-opdracht oktober 2026 voor
   alle breedtes) en "vanaf nu" bij Vandaag, op het finale artifact met de echte runtime.
   - Alle breedtes: de temperatuur staat vóór de briefing en de waarschuwingen, in de DOM én op
     het scherm. Voorheen bleef vanaf tabletbreedte de volgorde briefing, waarschuwingen,
     temperatuur; die volgorde is bewust vervangen om de actuele weersituatie prominenter te maken.
   - Wissel van breedte (draaien, venster) houdt de volgorde gelijk.
   - Vandaag toont onder de neerslag een grijs "vanaf nu" (EN "from now"),
     verborgen voor schermlezers; de andere dagen niet.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function fixture(){
  const d=bouw({som:2.4,pp:(u,dag)=>dag===0&&u>=19&&u<=22?60:8,pr:(u,dag)=>dag===0&&u>=19&&u<=22?0.8:0});
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

async function open(browser,root,w,h,taal){
  const context=await browser.newContext({viewport:{width:w,height:h},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:w<760,hasTouch:w<760});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(()=>{const N=Date,s=N.now(),e=N.parse("2026-07-22T15:39:00Z");class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;});
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:fixture()});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:["2026-07-22T17:00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+"/weer/utrecht/"+(taal==="en"?"?taal=en":""),{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:10000});
  await page.waitForFunction(()=>!document.getElementById("here")?.disabled,null,{timeout:10000});
  await page.waitForSelector("#days .row.day:not(.kop) .drain",{timeout:10000});
  await sleep(800);
  return {context,page,fouten};
}

const meet=page=>page.evaluate(()=>{
  const left=document.querySelector(".final-top-left");
  const r=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {top:b.top+scrollY,height:b.height};};
  const kinderen=left?[...left.children].filter(e=>e.matches("#brief,#waarschuwingen,.hero")).map(e=>e.id||e.className.split(" ")[0]):[];
  const rijen=[...document.querySelectorAll("#days .row.day:not(.kop)")].map(rij=>{const l=rij.querySelector(".drain .wiw-vanaf-nu");return {
    label:l?l.textContent.trim():null,verborgen:l?l.getAttribute("aria-hidden"):null,zichtbaar:l?l.getClientRects().length>0:false,
    letter:l?parseFloat(getComputedStyle(l).fontSize):null,aria:(rij.querySelector(".drain")||{}).getAttribute?.("aria-label")||""};});
  return {kinderen,hero:r(".final-top-left > .hero"),brief:r("#brief"),warn:r("#waarschuwingen"),rijen,overflow:document.documentElement.scrollWidth-innerWidth};
});

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [w,h] of [[360,780],[390,844],[768,1024],[1100,800],[1366,768]]){
      const label=`${w}px`;
      const {context,page,fouten}=await open(browser,root,w,h,"nl");
      try{
        const m=await meet(page);
        assert.deepEqual(m.kinderen,["hero","brief","waarschuwingen"],`${label}: volgorde in het eerste scherm ${m.kinderen.join(" > ")}`);
        assert(m.hero.top<m.brief.top&&m.brief.top<m.warn.top,`${label}: temperatuur (${Math.round(m.hero.top)}) staat niet zichtbaar boven briefing (${Math.round(m.brief.top)}) en waarschuwingen (${Math.round(m.warn.top)})`);
        assert(m.hero.top<=320,`${label}: temperatuur begint pas op ${Math.round(m.hero.top)}px`);
        const [vandaag,...rest]=m.rijen;
        assert.equal(vandaag.label,"vanaf nu",`${label}: Vandaag mist "vanaf nu" onder de neerslag`);
        assert(vandaag.zichtbaar,`${label}: "vanaf nu" is niet zichtbaar`);
        assert.equal(vandaag.verborgen,"true",`${label}: "vanaf nu" wordt dubbel voorgelezen`);
        assert(vandaag.letter>=11,`${label}: "vanaf nu" is kleiner dan 11px (${vandaag.letter})`);
        assert(/in de rest van vandaag/.test(vandaag.aria),`${label}: schermlezernaam van Vandaag noemt het tijdvak niet: ${vandaag.aria}`);
        assert(!/vanaf nu/.test(vandaag.aria),`${label}: "vanaf nu" lekt in de schermlezernaam`);
        assert(rest.length&&rest.every(x=>x.label===null),`${label}: een andere dag dan Vandaag toont "vanaf nu"`);
        assert(m.overflow<=1,`${label}: horizontale overflow ${m.overflow}px`);
        assert.deepEqual(fouten,[],`${label}: runtimefouten ${fouten.join(" | ")}`);
        console.log(`EERSTE SCHERM ${label}: ${m.kinderen.join(" > ")}, temperatuur op ${Math.round(m.hero.top)}px; Vandaag "vanaf nu".`);
      }finally{await context.close();}
    }

    /* Draaien of venster verbreden: de volgorde gaat mee, heen en terug. */
    {
      const {context,page,fouten}=await open(browser,root,390,844,"nl");
      try{
        await page.setViewportSize({width:1366,height:768});await sleep(300);
        assert.deepEqual((await meet(page)).kinderen,["hero","brief","waarschuwingen"],"390→1366: volgorde niet gelijk gebleven");
        await page.setViewportSize({width:390,height:844});await sleep(300);
        assert.deepEqual((await meet(page)).kinderen,["hero","brief","waarschuwingen"],"1366→390: volgorde niet gelijk gebleven");
        assert.deepEqual(fouten,[],`wissel: runtimefouten ${fouten.join(" | ")}`);
        console.log("EERSTE SCHERM wissel 390 → 1366 → 390: volgorde blijft gelijk.");
      }finally{await context.close();}
    }

    /* Engels: "from now". */
    {
      const {context,page,fouten}=await open(browser,root,390,844,"en");
      try{
        await page.waitForFunction(()=>document.documentElement.lang==="en-GB",null,{timeout:10000});await sleep(500);
        const label=await page.$eval("#days .row.day:not(.kop) .drain .wiw-vanaf-nu",e=>e.textContent.trim());
        assert.equal(label,"from now",`EN: label is "${label}"`);
        assert.deepEqual(fouten,[],`EN: runtimefouten ${fouten.join(" | ")}`);
        console.log('EERSTE SCHERM MOBIEL EN: Vandaag "from now".');
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
