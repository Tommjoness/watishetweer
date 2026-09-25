"use strict";

/* Grafiek op haar werkelijke breedte, op het finale artifact met de echte
   runtime.
   - De viewBox-breedte is de getekende breedte (schaal 1) tot 900px; telefoons
     tot 430px houden 380 en bredere grafieken houden 900 en schalen op.
   - Geen lege reserve onder de as voor de (verborgen) regenperiodes; vanaf
     1100px blijft de compacte desktopreserve voor de uurkolom.
   - Niet-mobiel: ieder temperatuurcijfer staat binnen 34px van zijn punt.
   - Is een uur smaller dan 36px, dan geldt het drie-uursritme; anders krijgt
     ieder toekomstig uur een cijfer.
   - Vanaf 760px krijgt de grafiek vlak en iconen, ook op tablet.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function fixture(){
  const d=bouw({temp:(u,dag)=>+(15.5+4.5*Math.sin((u-9)/24*Math.PI*2)-dag*0.4).toFixed(1),
    pp:(u,dag)=>dag===0&&u>=19&&u<=23?[40,70,80,65,30][u-19]:8,
    pr:(u,dag)=>dag===0&&u>=19&&u<=23?[0.2,1.4,2.1,0.8,0.1][u-19]:0,
    wc:(u,dag)=>dag===0&&u>=19&&u<=23?61:u<11?1:u<17?2:3,som:4.6});
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
  await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelectorAll("#chart circle[data-temp-index]").length>0,null,{timeout:15000});
  await sleep(1500);
  return {context,page,fouten};
}

function meet(){
  const svg=document.getElementById("chart"),g=S.geo,r=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal;
  const plotOnder=Number(g.pt)+Number(g.ih);
  const zichtbaar=el=>el.getClientRects().length&&getComputedStyle(el).display!=="none"&&!el.closest("#scrub")&&!el.closest("g[data-q4-rain-periods]");
  const teksten=[...svg.querySelectorAll("text")].filter(zichtbaar);
  /* Onderkant van tekst en iconen, in viewBox-eenheden. */
  const schaal=r.height/vb.height;
  const onderkant=Math.max(...[...teksten,...svg.querySelectorAll("[data-desktop-weather-icon]")].map(e=>(e.getBoundingClientRect().bottom-r.top)/schaal));
  const punten=[...svg.querySelectorAll("circle[data-temp-index]")].map(c=>({i:+c.getAttribute("data-temp-index"),x:+c.getAttribute("cx"),y:+c.getAttribute("cy")}));
  const temps=teksten.filter(t=>/Bodoni/i.test(t.getAttribute("font-family")||"")&&/^-?\d+°$/.test(t.textContent.trim())).map(t=>{
    const x=+t.getAttribute("x"),y=+t.getAttribute("y"),w=Number(t.textContent.trim().replace("°",""));
    let p=null,d=Infinity;punten.forEach(q=>{if(Math.round(g.T[q.i])!==w)return;const dx=Math.abs(q.x-x);if(dx<d){d=dx;p=q;}});
    const b=t.getBBox();
    return {tekst:t.textContent.trim(),x,afstand:p?Math.max(p.y-(b.y+b.height),b.y-p.y,0):null,dx:p?d:null};
  });
  return {breedte:r.width,vbW:vb.width,vbH:vb.height,M:!!g.M,cw:Number(g.cw),n:Number(g.n),plotOnder,onderkant,
    temps,aantalTemp:temps.length,vlak:!!svg.querySelector("[data-desktop-temp-area]"),
    overflow:document.documentElement.scrollWidth-innerWidth};
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [w,h] of [[390,844],[600,960],[768,1024],[820,1180],[900,1200],[1024,1366],[1100,800],[1366,768],[1920,1080]]){
      const {context,page,fouten}=await open(browser,root,w,h);
      try{
        const m=await page.evaluate(meet);
        const label=w+"px";
        if(w<=430)assert.equal(m.vbW,380,label+": telefoon houdt de mobiele viewBox van 380");
        else if(m.breedte>900)assert.equal(m.vbW,900,label+": breder dan 900px blijft de viewBox 900 en schaalt de grafiek mee op");
        else assert(Math.abs(m.vbW-m.breedte)<=1.5,label+": viewBox ("+m.vbW+") is niet de getekende breedte ("+m.breedte+")");
        /* Vanaf 1100px houdt de gekoppelde desktopgrafiek haar compacte reserve:
           daar bepaalt de grafiekhoogte hoeveel uurregels ernaast passen. */
        const maxLeeg=w>=1100?40:24;
        assert(m.vbH-m.onderkant<=maxLeeg,label+": "+Math.round(m.vbH-m.onderkant)+"px lege ruimte onder de as (viewBox "+m.vbH+", inhoud tot "+Math.round(m.onderkant)+")");
        assert(m.overflow<=1,label+": horizontale overflow "+m.overflow+"px");
        if(!m.M){
          const ver=m.temps.filter(t=>t.afstand===null||t.afstand>34);
          assert.deepEqual(ver,[],label+": temperatuurcijfers staan verder dan 34px van hun punt");
          assert(m.vlak,label+": niet-mobiele grafiek mist het zachte vlak");
          if(m.n<=25&&m.cw<36)assert(m.aantalTemp<=12,label+": uur van "+m.cw.toFixed(1)+"px, maar "+m.aantalTemp+" cijfers in plaats van het drie-uursritme");
        }
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        console.log("GRAFIEK "+label+": viewBox "+Math.round(m.vbW)+"×"+Math.round(m.vbH)+" op "+Math.round(m.breedte)+"px, uur "+m.cw.toFixed(1)+"px, "+m.aantalTemp+" cijfers.");
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Grafiekbreedte OK van 390 tot 1920px.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});
