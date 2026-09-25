"use strict";

/* Typografie en kleine punten op het finale artifact, met de echte runtime.
   - Geen monospace meer in zichtbare tekst, ook niet in grafieklabels.
   - Ophaaltijd op mobiel op één regel; hints gewoon en links; sectiekoppen
     minstens 11px; Temp.bereik op de lijn van de andere kolomkoppen.
   - Zon onder en zon op op één regel (mobiel en tablet).
   - Tablet: tegels in vier kolommen.

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

function meetOud(){
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

function meet(){
  const zichtbaar=e=>e.getClientRects().length>0&&getComputedStyle(e).visibility!=="hidden";
  const mono=[];
  for(const e of document.querySelectorAll("body *")){
    if(!zichtbaar(e))continue;
    const eigenTekst=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
    if(!eigenTekst)continue;
    const f=getComputedStyle(e).fontFamily;
    if(/mono/i.test(f))mono.push((e.tagName+" "+(e.textContent||"").trim().slice(0,20)+" ["+f.slice(0,40)+"]"));
  }
  const stamp=document.getElementById("stamp"),sl=parseFloat(getComputedStyle(stamp).lineHeight)||16;
  const hints=[...document.querySelectorAll("#app p.hint")].filter(zichtbaar).map(e=>({id:e.id,stijl:getComputedStyle(e).fontStyle,uitlijning:getComputedStyle(e).textAlign}));
  const koppen=[...document.querySelectorAll("#app h2")].filter(zichtbaar).map(e=>({t:(e.textContent||"").trim().slice(0,30),fs:parseFloat(getComputedStyle(e).fontSize)}));
  const kop=[...document.querySelectorAll("#days .row.kop>*")].filter(e=>zichtbaar(e)&&(e.textContent||"").trim()).map(e=>{const rg=document.createRange();rg.selectNodeContents(e);const r=rg.getBoundingClientRect();return {t:(e.textContent||"").trim(),top:r.top,h:r.height};});
  const zon=[...document.querySelectorAll("#suntimes .zonregel")].filter(zichtbaar).map(e=>e.getBoundingClientRect().top);
  const tegels=[...document.querySelectorAll("#app .final-top-grid .stats>.stat, #app .stats:not(#aq)>.stat")].filter(zichtbaar);
  const kolommen=new Set(tegels.map(t=>Math.round(t.getBoundingClientRect().left))).size;
  return {mono,stampRegels:Math.round(stamp.getBoundingClientRect().height/sl),hints,koppen,kop,zon,kolommen,luchtKop:[...document.querySelectorAll("#app h2")].some(h=>/Lucht, pollen en zon/.test(h.textContent||"")),overflow:document.documentElement.scrollWidth-innerWidth};
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [w,h] of [[390,844],[768,1024],[1440,900]]){
      const label=w+"px";
      const {context,page,fouten}=await open(browser,root,w,h);
      try{
        const m=await page.evaluate(meet);
        assert(m.overflow<=1,label+": horizontale overflow "+m.overflow+"px");
        assert.deepEqual(m.mono,[],label+": zichtbare tekst gebruikt nog monospace: "+JSON.stringify(m.mono.slice(0,6)));
        assert(m.hints.length>=3&&m.hints.every(x=>x.stijl==="normal"&&/^(left|start)$/.test(x.uitlijning)),label+": hints zijn niet gewoon en links: "+JSON.stringify(m.hints));
        for(const k of m.koppen)assert(k.fs>=11,label+": sectiekop '"+k.t+"' is "+k.fs+"px");
        assert(m.luchtKop,label+": sectiekop Lucht, pollen en zon ontbreekt");
        if(w<=430)assert.equal(m.stampRegels,1,label+": ophaaltijd beslaat "+m.stampRegels+" regels");
        if(w<=900){
          assert(m.zon.length===2&&Math.abs(m.zon[0]-m.zon[1])<=2,label+": zon onder en zon op staan niet op één regel: "+JSON.stringify(m.zon));
        }
        if(w>=600&&w<=900)assert.equal(m.kolommen,4,label+": tegels staan niet in vier kolommen ("+m.kolommen+")");
        if(w>900){
          const tops=m.kop.map(k=>k.top);
          assert(Math.max(...tops)-Math.min(...tops)<=2,label+": kolomkoppen van Zeven dagen staan niet op één lijn: "+JSON.stringify(m.kop));
        }
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        console.log("TYPOGRAFIE "+label+": geen monospace, "+m.hints.length+" rustige hints, koppen ≥11px"+(w<=900?", zon op één regel":"")+(w>=600&&w<=900?", tegels in 4 kolommen":"")+".");
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Typografie OK op 390, 768 en 1440px.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});
