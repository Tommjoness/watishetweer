"use strict";

/* Indeling van het eerste scherm, op het finale artifact met de echte runtime.
   - Desktop (1366x768): het modelsignaal staat rechts onder de tegels, niet
     over de volle breedte onder het raster; de grafiek begint daardoor hoger.
   - Tegels: in iedere rij staan de getallen op één lijn, ook als een label
     over twee regels loopt (390, 768, 1366 en 1920px).
   - Samenvatting: noemt de titel het waarschuwingsniveau al ("Code geel"),
     dan staat er geen "(geel)" in de kop.
   - Grafiek overdag zonder nacht in het venster: geen lege omlijnde band.
   - Telefoon: het modelsignaal blijft na de tegels.
   - Zes tegels (zonder "Tijd tot zonsondergang" en, bij goed zicht, "Zicht")
     staan vanaf 600px in drie kolommen (ook 1024px).
   - Lijnen over de volle breedte: luchttegels zonder inspringing, het
     modelsignaal even breed als de tegels.
   - Geen tekst onder 11px in tegelkoppen en het label "Modelsignaal".
   - Luchtkwaliteit in inkt, ook bij "redelijk".
   - Dauwpunt: getal en °C breken niet over twee regels (vaste spatie).
   - Weergave-schakelaar: ieder vakje breed genoeg voor icoon en woord.
   - "Komende 24 uur" (dagweergave): minstens 11px, op de telefoon 44px hoog.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const SCENARIO={
  /* 17:39, natte avond, code geel, slechte luchtkwaliteit (modelsignaal). */
  avond:{klok:"2026-07-22T15:39:00Z",meting:"2026-07-22T17:30",waarschuwing:true,aqi:82,
    temp:(u,dag)=>+(15.5+4.5*Math.sin((u-9)/24*Math.PI*2)-dag*0.4).toFixed(1),
    pp:(u,dag)=>dag===0&&u>=19&&u<=23?[40,70,80,65,30][u-19]:8,
    pr:(u,dag)=>dag===0&&u>=19&&u<=23?[0.2,1.4,2.1,0.8,0.1][u-19]:0},
  /* 09:10, droog, geen waarschuwing: het desktopvenster valt helemaal overdag. */
  ochtend:{klok:"2026-07-22T07:10:00Z",meting:"2026-07-22T09:00",waarschuwing:false,aqi:24,
    temp:(u,dag)=>+(14+4.4*Math.sin((u-9)/24*Math.PI*2)-dag*0.3).toFixed(1),pp:()=>6,pr:()=>0}
};
function fixture(sc){
  const d=bouw({temp:sc.temp,pp:sc.pp,pr:sc.pr,som:0});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map(()=>21600);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,16));}
  const nu=h.time.indexOf(sc.meting.slice(0,14)+"00");
  d.current.time=sc.meting;d.current.temperature_2m=h.temperature_2m[nu];d.current.apparent_temperature=h.temperature_2m[nu]-1;
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

async function open(browser,root,sc,w,h){
  const mobiel=w<700;
  const context=await browser.newContext({viewport:{width:w,height:h},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:mobiel,hasTouch:mobiel});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(k=>{const N=Date,s=N.now(),e=N.parse(k);class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;},sc.klok);
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:fixture(sc)});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:sc.aqi,uv_index:3},hourly:{time:[sc.meting.slice(0,14)+"00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:sc.waarschuwing?[{titel:"Code geel: windstoten",tekst:"Zware windstoten tot 80 km/u.",niveau:"geel",van:"2026-07-22T12:00:00Z",tot:"2026-07-22T23:00:00Z",gebied:"Utrecht"}]:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+"/weer/utrecht/",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:15000});
  await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelectorAll("#chart circle").length>0,null,{timeout:15000});
  await sleep(2000);
  return {context,page,fouten};
}

function meet(){
  const box=el=>{if(!el)return null;const r=el.getBoundingClientRect();return r.height?{x:r.left,y:r.top+scrollY,w:r.width,h:r.height,b:r.bottom+scrollY}:null;};
  const stats=document.querySelector(".final-top-grid>.stats")||document.querySelector(".stats");
  const tegels=stats?[...stats.children].filter(el=>el.classList.contains("stat")&&el.getBoundingClientRect().height>0):[];
  const rijen=new Map();
  tegels.forEach(t=>{const k=Math.round(t.getBoundingClientRect().top);if(!rijen.has(k))rijen.set(k,[]);const v=t.querySelector(".sval"),e=t.querySelector(".eyebrow");rijen.get(k).push({label:(e&&e.textContent||"").trim(),waarde:v?v.getBoundingClientRect().top:null,labelOnder:e?e.getBoundingClientRect().bottom:null});});
  const svg=document.getElementById("chart"),g=S.geo;
  const band=svg?[...svg.querySelectorAll("rect")].filter(r=>r.getAttribute("fill")==="none"&&Number(r.getAttribute("y"))<Number(g.pt)).length:0;
  const nacht=svg?[...svg.querySelectorAll("rect")].filter(r=>Number(r.getAttribute("y"))<Number(g.pt)&&r.getAttribute("fill")!=="none"&&Number(r.getAttribute("height"))<30).length:0;
  const brief=document.getElementById("brief");
  const aq=document.getElementById("aq"),aqTegels=aq?[...aq.children].filter(el=>el.classList.contains("stat")):[];
  const ink=getComputedStyle(document.body).color;
  const klein=[...document.querySelectorAll(".stats>.stat>.eyebrow,#modelrisico .modelrisico-label")].filter(el=>el.getBoundingClientRect().height>0&&parseFloat(getComputedStyle(el).fontSize)<10.95).map(el=>el.textContent.trim()+" "+getComputedStyle(el).fontSize);
  const schakelaar=[...document.querySelectorAll(".wiw-weergave-voet #thema .wiw-theme-icon, .wiw-weergave-voet #thema .wiw-theme-auto")].map(el=>Math.round(el.getBoundingClientRect().width));
  return {stats:box(stats),model:box(document.getElementById("modelrisico")),chart:box(svg),
    kolommen:new Set(tegels.map(t=>Math.round(t.getBoundingClientRect().left))).size,
    aqInspring:aq&&aqTegels.length?Math.round(aqTegels[0].getBoundingClientRect().left-aq.getBoundingClientRect().left):null,
    aqKleur:aqTegels.map(t=>{const v=t.querySelector(".sval");return v?getComputedStyle(v).color:null;}).filter(Boolean),ink,klein,schakelaar,
    dauwpunt:(document.getElementById("humsub")||{}).textContent||"",
    rijen:[...rijen.values()].filter(r=>r.length>1),band,nacht,brief:(brief&&brief.textContent||"").replace(/\s+/g," ").trim(),
    overflow:document.documentElement.scrollWidth-innerWidth};
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [naam,w,h] of [["avond",390,844],["avond",768,1024],["avond",1024,768],["avond",1366,768],["avond",1920,1080],["ochtend",1366,768]]){
      const label=naam+" "+w+"px";
      const {context,page,fouten}=await open(browser,root,SCENARIO[naam],w,h);
      try{
        const m=await page.evaluate(meet);
        for(const rij of m.rijen){
          const w0=rij.map(t=>t.waarde),l0=rij.map(t=>t.labelOnder);
          assert(Math.max(...w0)-Math.min(...w0)<=2,label+": getallen in de tegelrij "+rij.map(t=>t.label).join(" / ")+" staan niet op één lijn ("+w0.map(Math.round).join("/")+")");
          assert(Math.max(...l0)-Math.min(...l0)<=2,label+": labels in de tegelrij "+rij.map(t=>t.label).join(" / ")+" eindigen niet op één lijn");
        }
        if(SCENARIO[naam].aqi>=80){
          assert(m.model,label+": het modelsignaal ontbreekt in de testdata");
          if(w>=1100){
            assert(m.model.x>=m.stats.x-1&&m.model.x+m.model.w<=m.stats.x+m.stats.w+1,label+": het modelsignaal staat niet in de rechterkolom onder de tegels");
            assert(m.model.y>=m.stats.b-1&&m.model.y<=m.stats.b+30,label+": het modelsignaal sluit niet aan onder de tegels ("+Math.round(m.model.y)+" / "+Math.round(m.stats.b)+")");
          }else{
            assert(m.model.y>=m.stats.b-1,label+": het modelsignaal staat niet meer na de tegels");
          }
        }
        if(naam==="avond"&&w===1366)assert(m.chart.y<=660,label+": de grafiek begint pas op y="+Math.round(m.chart.y));
        if(SCENARIO[naam].waarschuwing){
          assert(/Officiële weerwaarschuwing: Code geel/.test(m.brief)&&!/\(geel\)/.test(m.brief),label+": de samenvatting herhaalt het niveau: "+m.brief.slice(0,80));
        }
        /* Een omlijnde zonneband alleen als er nacht in het venster valt. */
        assert(!(m.band>0&&m.nacht===0),label+": lege zonneband zonder nacht in het venster");
        if(naam==="avond")assert.equal(m.band,1,label+": de zonneband met nacht ontbreekt");
        /* Zes zichtbare tegels (goed zicht in deze fixtures) staan vanaf 600px in drie kolommen. */
        if(w>=600)assert.equal(m.kolommen,3,label+": zes tegels staan in "+m.kolommen+" kolommen in plaats van drie");
        assert.equal(m.aqInspring,0,label+": de luchttegels springen "+m.aqInspring+"px in ten opzichte van hun lijn");
        if(m.model)assert(Math.abs(m.model.w-m.stats.w)<=1,label+": het modelsignaal ("+Math.round(m.model.w)+"px) is niet even breed als de tegels ("+Math.round(m.stats.w)+"px)");
        assert.deepEqual(m.klein,[],label+": tekst kleiner dan 11px");
        assert(m.aqKleur.length&&m.aqKleur.every(k=>k===m.ink),label+": luchtwaarden niet in inkt: "+m.aqKleur.join(", "));
        if(/Dauwpunt/.test(m.dauwpunt))assert(/\d\u00a0°C/.test(m.dauwpunt)&&!/\d °C/.test(m.dauwpunt),label+": dauwpunt zonder vaste spatie: "+m.dauwpunt);
        if(w>430&&m.schakelaar.length)assert(m.schakelaar.every(b=>b>=86),label+": vakjes van de weergave-schakelaar te smal: "+m.schakelaar.join("/"));
        /* Dagweergave: terugknop leesbaar en op de telefoon goed te raken. */
        const rij=await page.$$("#days .row.day");
        if(rij[3]){
          await rij[3].click();await sleep(1200);
          const terug=await page.evaluate(()=>{const k=document.getElementById("back");const r=k.getBoundingClientRect();return {h:r.height,fs:parseFloat(getComputedStyle(k).fontSize),zichtbaar:r.height>0};});
          assert(terug.zichtbaar&&terug.fs>=11,label+": terugknop kleiner dan 11px ("+terug.fs+")");
          if(w<760)assert(terug.h>=44,label+": terugknop maar "+terug.h+"px hoog");
        }
        assert(m.overflow<=1,label+": horizontale overflow "+m.overflow+"px");
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        console.log("INDELING "+label+": "+m.rijen.length+" tegelrijen op één lijn"+(m.model?", modelsignaal op "+Math.round(m.model.x)+","+Math.round(m.model.y):"")+", grafiek vanaf y="+Math.round(m.chart.y)+".");
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Indeling OK: modelsignaal onder de tegels, zes tegels in drie kolommen, lijnen over de volle breedte, luchtwaarden in inkt, geen tekst onder 11px, terugknop en weergave-schakelaar op maat, geen dubbel niveau, geen lege zonneband.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});
