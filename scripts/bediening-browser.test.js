"use strict";

/* Bediening op het finale artifact, met de echte runtime.
   - Zoekveld: aantikken selecteert de huidige plaats, typen vervangt haar.
   - Zoeksuggesties: regio staat onder de naam, niet erachter.
   - Tapdoelen: mobiel minstens 44px, desktop minstens 24px.
   - Auto volgt de systeeminstelling, ook live.

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
    /* Mobiel, systeem donker */
    {
      const {context,page,fouten}=await open(browser,root,390,844,"dark");
      try{
        assert.equal(await page.evaluate(()=>document.documentElement.dataset.thema),"donker","390px: Auto volgt een donker systeem niet");
        await page.locator("#q").tap();
        await sleep(150);
        const selectie=await page.evaluate(()=>{const q=document.getElementById("q");return {start:q.selectionStart,eind:q.selectionEnd,lengte:q.value.length,waarde:q.value};});
        assert(selectie.lengte>0&&selectie.start===0&&selectie.eind===selectie.lengte,"390px: aantikken selecteert de huidige plaats niet: "+JSON.stringify(selectie));
        await page.keyboard.type("Ams");
        const nieuweWaarde=await page.inputValue("#q");assert.equal(nieuweWaarde,"Ams","390px: typen plakt achter de oude plaatsnaam in plaats van haar te vervangen: "+JSON.stringify({selectie,nieuweWaarde}));
        await page.waitForSelector("#res.on [data-lat]",{timeout:5000});
        const optie=await page.evaluate(()=>{const o=document.querySelector("#res [data-lat]"),n=o.querySelector(".zoekresultaat-naam").getBoundingClientRect(),d=o.querySelector(".zoekresultaat-detail").getBoundingClientRect();return {naamOnder:n.bottom,detailBoven:d.top,naamLinks:n.left,detailLinks:d.left};});
        assert(optie.detailBoven>=optie.naamOnder-1&&Math.abs(optie.naamLinks-optie.detailLinks)<=1,"390px: regio staat niet onder de plaatsnaam: "+JSON.stringify(optie));
        await page.keyboard.press("Escape");
        await page.evaluate(()=>{document.querySelectorAll("#nights details").forEach(d=>d.open=false);});
        const doelen=await page.evaluate(()=>{
          const maat=e=>{const r=e.getBoundingClientRect();return {t:(e.textContent||"").trim().slice(0,24),w:Math.round(r.width),h:Math.round(r.height)};};
          const zichtbaar=e=>e.getClientRects().length>0;
          return [...document.querySelectorAll("#chipdeel,#nights .nacht-meta-details>summary,.seo-breadcrumb a,.seo-route-nearby-links a")].filter(zichtbaar).map(maat);
        });
        assert(doelen.length>=4,"390px: te weinig tapdoelen gevonden: "+JSON.stringify(doelen));
        for(const d of doelen)assert(d.h>=44&&(d.t!=="Delen"||d.w>=44),"390px: tapdoel '"+d.t+"' is kleiner dan 44px ("+d.w+"x"+d.h+")");
        await page.emulateMedia({colorScheme:"light"});
        await page.waitForFunction(()=>document.documentElement.dataset.thema==="licht",null,{timeout:3000});
        assert.deepEqual(fouten,[],"390px: runtimefouten "+fouten.join(" | "));
        console.log("BEDIENING 390px: zoekveld vervangt de plaats, regio onder de naam, "+doelen.length+" tapdoelen van minstens 44px, Auto volgt het systeem live.");
      }finally{await context.close();}
    }
    /* Desktop, systeem licht */
    {
      const {context,page,fouten}=await open(browser,root,1440,900,"light");
      try{
        assert.equal(await page.evaluate(()=>document.documentElement.dataset.thema),"licht","1440px: Auto volgt een licht systeem niet (ook na zonsondergang)");
        await page.click("#q");
        await sleep(150);
        await page.keyboard.type("Ams");
        assert.equal(await page.inputValue("#q"),"Ams","1440px: na een muisklik plakt typen achter de oude plaatsnaam");
        await page.keyboard.press("Escape");
        await page.locator("#q").fill("Utrecht");
        await page.locator("body").click({position:{x:5,y:5}});
        const m=await page.evaluate(()=>{
          const links=[...document.querySelectorAll("footer a,.seo-breadcrumb a,.seo-route-nearby-links a,.seo-plaatsnav-links a")].filter(e=>e.getClientRects().length).map(e=>({t:(e.textContent||"").trim().slice(0,30),h:Math.round(e.getBoundingClientRect().height)}));
          const meer=document.querySelector("#nights .nacht-meer"),nights=document.getElementById("nights");
          const s=meer&&getComputedStyle(meer);
          const midden=meer&&(()=>{const b=meer.getBoundingClientRect(),rg=document.createRange();rg.selectNodeContents(meer);const t=rg.getClientRects()[0];return t?Math.abs((t.top+t.bottom)/2-(b.top+b.bottom)/2):null;})();
          return {links,meer:meer?{w:meer.getBoundingClientRect().width,container:nights.getBoundingClientRect().width,rand:s.borderTopWidth,transform:s.textTransform,midden}:null,auto:document.getElementById("thema-auto")?.getAttribute("aria-label")};
        });
        for(const l of m.links)assert(l.h>=24,"1440px: link '"+l.t+"' is lager dan 24px ("+l.h+")");
        assert(m.meer&&m.meer.w<m.meer.container/2&&m.meer.rand!=="0px"&&m.meer.transform==="none"&&m.meer.midden!==null&&m.meer.midden<=2,"1440px: Meer nachten bekijken ziet er niet uit als knop: "+JSON.stringify(m.meer));
        assert.equal(m.auto,"Automatisch (volgt je systeem)","1440px: Auto-knop legt het systeemgedrag niet uit");
        assert.deepEqual(fouten,[],"1440px: runtimefouten "+fouten.join(" | "));
        console.log("BEDIENING 1440px: "+m.links.length+" links van minstens 24px, Meer nachten als knop, Auto licht na zonsondergang bij een licht systeem.");
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Bediening OK op 390 en 1440px.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});
