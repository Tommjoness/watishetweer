"use strict";

/* Kop op het finale artifact, met de echte runtime.
   - Bewaren, Delen en bewaarde plaatsen staan in de kop onder de zoekbalk, vóór
     de inhoud; op mobiel in dezelfde volgorde als voorheen.
   - Desktop: briefing en tegels beginnen op dezelfde lijn; vanaf 1360px staan
     knoppen en ophaaltijd op één regel en begint de inhoud hoger in beeld.
   - Met drie bewaarde plaatsen blijft alles binnen de kolom zonder overlap.

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

async function open(browser,root,w,h,bewaard){
  const context=await browser.newContext({viewport:{width:w,height:h},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:w<700,hasTouch:w<700});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(lijst=>{
    const N=Date,s=N.now(),e=N.parse("2026-07-22T15:39:00Z");class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;
    try{if(lijst)localStorage.setItem("weerbriefing.lijst",JSON.stringify(lijst));}catch(_){}
  },bewaard||null);
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
  await page.waitForFunction(()=>document.getElementById("chipdeel")&&/opgehaald/.test(document.getElementById("stamp")?.textContent||""),null,{timeout:15000});
  await sleep(700);
  return {context,page,fouten};
}

function meet(){
  const r=s=>{const e=document.querySelector(s);if(!e||!e.getClientRects().length)return null;const b=e.getBoundingClientRect();return {l:b.left,r:b.right,t:b.top+scrollY,b:b.bottom+scrollY,w:b.width,h:b.height};};
  const chips=document.getElementById("chips");
  return {
    chipsInKop:!!chips.closest(".mast .mastright"),
    q:r("#q"),stamp:r("#stamp"),chips:r("#chips"),deel:r("#chipdeel"),mastright:r(".mastright"),
    brief:r("#brief"),stats:r(".stats"),grid:r(".final-top-grid"),chart:r(".dashrow-chart .chartkop")||r(".chartkop"),
    overflow:document.documentElement.scrollWidth-innerWidth
  };
}
const raakt=(a,b)=>a.l<b.r-0.5&&a.r>b.l+0.5&&a.t<b.b-0.5&&a.b>b.t+0.5;

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const drie=[{lat:52.37,lon:4.89,label:"Amsterdam",land:"NL"},{lat:51.92,lon:4.48,label:"Rotterdam",land:"NL"},{lat:53.22,lon:6.57,label:"Groningen",land:"NL"}];
  try{
    for(const [w,h,bewaard] of [[390,844],[768,1024],[1100,800],[1366,768],[1440,900],[1440,900,drie],[1920,1080]]){
      const label=w+"px"+(bewaard?" met bewaarde plaatsen":"");
      const {context,page,fouten}=await open(browser,root,w,h,bewaard);
      try{
        const m=await page.evaluate(meet);
        assert(m.chipsInKop,label+": Bewaren/Delen staan niet in de kop onder de zoekbalk");
        assert(m.overflow<=1,label+": horizontale overflow "+m.overflow+"px");
        assert(m.chips.l>=m.mastright.l-0.5&&m.chips.r<=m.mastright.r+0.5,label+": knoppen steken buiten de kopkolom: "+JSON.stringify(m.chips));
        assert(!raakt(m.chips,m.stamp),label+": knoppen en ophaaltijd overlappen: "+JSON.stringify({chips:m.chips,stamp:m.stamp}));
        assert(m.chips.t>=m.q.b,label+": knoppen staan niet onder de zoekbalk");
        if(w<=900){
          assert(m.stamp.t>=m.q.b-0.5&&m.chips.t>=m.stamp.b-0.5,label+": mobiele volgorde zoekbalk, tijd, knoppen is veranderd");
        }else{
          assert(Math.abs(m.brief.t-m.stats.t)<=1,label+": briefing ("+m.brief.t+") en tegels ("+m.stats.t+") beginnen niet op dezelfde lijn");
          if(w>=1360&&!bewaard){
            const midden=x=>(x.t+x.b)/2;
            assert(Math.abs(midden(m.deel)-midden(m.stamp))<=4,label+": knoppen en ophaaltijd staan niet op één regel");
            assert(m.grid.t<=215,label+": inhoud begint pas op "+Math.round(m.grid.t)+"px");
          }
          assert(m.chart.t<=h-100,label+": grafiek begint pas op "+Math.round(m.chart.t)+"px");
        }
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        console.log("KOP "+label+": knoppen onder de zoekbalk"+(w>900?", inhoud vanaf "+Math.round(m.grid.t)+"px, grafiek op "+Math.round(m.chart.t)+"px":"")+".");
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Kop OK op 390, 768, 1100, 1366, 1440 en 1920px, ook met bewaarde plaatsen.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});
