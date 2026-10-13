"use strict";

/* Spacing van de pagina op het finale artifact, met de echte runtime.
   Deze test begon op 3 september met een nagebouwde pagina; die leek niet meer
   op de site (kop, Nachtzicht en voet zijn later opnieuw ingedeeld). Hij meet
   nu de echte pagina, met de eisen die nog gelden en de latere eisen waar
   een ontwerpronde de oude verving:
   - desktop: zoekbalk en tegels delen dezelfde rechterkolom; zoekveld breed;
   - Nachtzicht: Beste zichtperiode en Maan gecentreerd onder hun kop
     (eigenaar, 29 september), Beste zichtperiode breed genoeg, scorebalk compact;
   - sectieritme: koppen 24–30px boven de sectie, kop en instructie compact;
   - voet: compact (opnieuw ingedeeld op 25 september), bronnen op één regel;
   - populaire plaatsen: zachte overgang van 10px (12 september), compact;
   - telefoon: tapdoelen van 44px in voet en plaatsen.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("./data.js");

const OUT=path.join(__dirname,"public");
if(!fs.existsSync(path.join(OUT,"index.html")))throw new Error("public/index.html ontbreekt; voer eerst de build uit.");
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

async function open(browser,root,w,h){
  const context=await browser.newContext({viewport:{width:w,height:h},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:w<700,hasTouch:w<700});
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
  await page.goto(root+"/weer/utrecht/",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:15000});
  await page.waitForFunction(()=>document.querySelectorAll("#days .row.day:not(.kop)").length===7&&document.querySelectorAll("#nights .row.night:not(.kop)").length>0,null,{timeout:15000});
  await sleep(1200);
  return {context,page,fouten};
}

function meet(){
  const cs=e=>getComputedStyle(e),rr=e=>e.getBoundingClientRect(),px=v=>parseFloat(v)||0,o={};
  const mr=document.querySelector(".mastright"),ts=document.querySelector(".final-top-grid>.stats"),q=document.getElementById("q");
  o.mastAxis=mr&&ts?Math.abs(rr(mr).left-rr(ts).left):999;o.mastWidthDelta=mr&&ts?Math.abs(rr(mr).width-rr(ts).width):999;o.search=q?rr(q).width:0;
  const rij=[...document.querySelectorAll("#nights .row.night:not(.kop)")].find(e=>e.getClientRects().length);
  const ven=rij&&rij.querySelector(".nachtvenster"),maan=rij&&rij.querySelector(".nachtmaan"),bar=rij&&rij.querySelector(".sbar");
  o.venAlign=ven?cs(ven).textAlign:"";o.maanAlign=maan?cs(maan).textAlign:"";o.venW=ven?rr(ven).width:0;o.barW=bar?rr(bar).width:999;
  /* Sectiekoppen: de kop vóór de instructieregel van Zeven dagen, Nachtzicht en Lucht. */
  const kop=id=>{const h=document.getElementById(id);return h&&h.previousElementSibling;};
  o.koppen={};for(const [n,id] of [["dagen","dagenhint"],["nacht","nachthint"],["lucht","pollenhint"]]){const k=kop(id),h=document.getElementById(id);o.koppen[n]={top:k?px(cs(k).marginTop):-1,onder:k?px(cs(k).marginBottom):-1,hintTop:h?px(cs(h).marginTop):-1,hintOnder:h?px(cs(h).marginBottom):-1};}
  const f=document.querySelector("footer"),aq=document.getElementById("aq"),nav=document.querySelector(".seo-plaatsnav"),bron=f.querySelector(".bron-bronnen");
  o.voet={top:px(cs(f).marginTop),pad:px(cs(f).paddingTop),hoogte:rr(f).height,gat:aq?rr(f).top-rr(aq).bottom:999};
  const bronLinks=bron?[...bron.querySelectorAll(".bronitem a")].filter(a=>a.getClientRects().length):[];
  o.bronRegels=new Set(bronLinks.map(a=>Math.round(rr(a).top))).size;
  o.nav=nav?{top:px(cs(nav).marginTop),hoogte:rr(nav).height,rand:px(cs(nav).borderTopWidth)}:null;
  const navKop=nav&&nav.querySelector(".seo-plaatsnav-kop");o.navKop=navKop?rr(navKop).height:0;
  const zichtbaar=e=>e&&e.getClientRects().length>0;
  o.voetDoelen=[f.querySelector('a[href="/over/"]'),f.querySelector('a[href="/privacy"]'),...bronLinks].filter(zichtbaar).map(e=>rr(e).height);
  o.plaatsDoelen=nav?[...nav.querySelectorAll("a")].filter(zichtbaar).map(e=>rr(e).height):[];
  o.overflow=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth;
  return o;
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [w,h] of [[390,844],[1366,900],[1600,900],[1680,900],[1920,1080]]){
      const {context,page,fouten}=await open(browser,root,w,h);
      try{
        const m=await page.evaluate(meet),label=w+"px";
        assert(m.overflow<=2,label+": "+m.overflow+"px horizontale overflow");
        if(w>=1100){
          assert(m.mastAxis<=2&&m.mastWidthDelta<=2,label+": zoekbalk en tegels delen niet dezelfde rechterkolom (as "+m.mastAxis+"px, breedteverschil "+m.mastWidthDelta+"px)");
          assert(m.search>=200,label+": zoekveld blijft onnodig smal ("+m.search+"px)");
          assert(m.venAlign==="center"&&m.maanAlign==="center",label+": Beste zichtperiode/Maan staan niet gecentreerd ("+m.venAlign+"/"+m.maanAlign+")");
          assert(m.venW>=330,label+": Beste zichtperiode te smal ("+m.venW+"px)");
          assert(m.barW<=625,label+": Nachtzicht-scorebalk te breed ("+m.barW+"px)");
          for(const [n,k] of Object.entries(m.koppen)){
            assert(k.top>=24&&k.top<=30,label+": sectiekop "+n+" heeft "+k.top+"px ruimte erboven, verwacht 24–30px");
            assert(k.hintOnder>=7&&k.hintOnder<=9,label+": instructie onder "+n+" sluit niet compact aan ("+k.hintOnder+"px)");
          }
          assert(m.voet.top<=20&&m.voet.pad<=16&&m.voet.gat<=20,label+": voet staat te los (marge "+m.voet.top+", padding "+m.voet.pad+", gat "+m.voet.gat+")");
          assert(m.voet.hoogte<=160,label+": voet te hoog ("+m.voet.hoogte+"px)");
          assert(m.bronRegels===1,label+": bronnen beslaan "+m.bronRegels+" regels in plaats van één");
          assert(m.nav&&Math.abs(m.nav.top-10)<=.6&&m.nav.hoogte<=66&&m.nav.rand<=1.2,label+": populaire-plaatsenstrook niet compact met zachte overgang: "+JSON.stringify(m.nav));
          if(w>=1300)assert(m.navKop<=30,label+": kop van de populaire plaatsen breekt over meerdere regels ("+m.navKop+"px)");
        }else{
          assert(m.voetDoelen.length>=3&&m.voetDoelen.every(x=>x>=43.5),label+": voetlink lager dan 44px: "+JSON.stringify(m.voetDoelen));
          assert(m.plaatsDoelen.length>=6&&m.plaatsDoelen.every(x=>x>=43.5),label+": plaatslink lager dan 44px: "+JSON.stringify(m.plaatsDoelen));
          assert(m.bronRegels<=2,label+": bronnen beslaan "+m.bronRegels+" regels");
        }
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        console.log(`${label} spacing groen: zoekveld ${Math.round(m.search)}px, Beste zichtperiode ${Math.round(m.venW)}px, voet ${Math.round(m.voet.hoogte)}px, plaatsen ${m.nav?Math.round(m.nav.hoogte):0}px, overflow ${m.overflow}px.`);
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Spacing-browsertest geslaagd op 390/1366/1600/1680/1920 px met de echte runtime.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});
