"use strict";

/* Hoogste en laagste punt in de grafiek, op het finale artifact met de echte
   runtime, op 390 (mobiel) en 1366px (desktop).
   De testreeks heeft om 19-20 uur een plateau van 16,4° en pas om 22 uur het
   echte dal van 15,6°: allebei "16°". De volle stip hoort bij het echte dal,
   niet bij het eerdere plateau, en ligt dus nooit hoger (of bij de max nooit
   lager) dan een ander punt met een cijfer.
   Elk temperatuurpunt heeft dezelfde volle stip (2,2 op de telefoon, 3 vanaf
   tablet); piek en dal vallen op door hun cijfer, niet door een grotere stip.
   Iedere stip staat boven een tijd op de as (eigenaar, 29 september): valt
   piek of dal tussen twee astijden, dan staat het vette cijfer er zonder stip.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* Mobiel toont 24 uur vanaf 14:00, desktop de rest van vandaag: beide vensters
   bevatten het plateau en het dal. */
const VANDAAG={14:20.2,15:20.9,16:21.4,17:21.6,18:20.3,19:16.4,20:16.4,21:16.8,22:15.6,23:15.8};
const MORGEN={0:16.3,1:16.9,2:17.2,3:17.4,4:17.5,5:17.6,6:17.8,7:18.1,8:18.6,9:19.2,10:19.8,11:20.3,12:20.6,13:20.8};
function fixture(){
  const d=bouw({temp:(u,dag)=>dag===0&&u in VANDAAG?VANDAAG[u]:dag===1&&u in MORGEN?MORGEN[u]:18,som:0});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map(()=>21600);
  d.current.temperature_2m=18.4;
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
  /* 14:39 in Amsterdam, het uur van de actuele meting in de fixture */
  await page.addInitScript(()=>{const N=Date,s=N.now(),e=N.parse("2026-07-22T12:39:00Z");class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;});
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:fixture()});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:["2026-07-22T10:00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+"/weer/utrecht/",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:15000});
  await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelector("#chart text[data-mobile-temp-marker],#chart text[data-desktop-temp-marker]"),null,{timeout:15000});
  await sleep(1200);
  return {context,page,fouten};
}

function meet(){
  const svg=document.getElementById("chart"),g=S.geo;
  const T=g.T.map(Number);
  const zichtbaar=g.M?T.slice(0,24):T;
  const stippen=[...svg.querySelectorAll("[data-mobile-temp-marker-dot],[data-desktop-temp-marker-dot]")].map(el=>{
    const type=el.getAttribute("data-mobile-temp-marker-dot")||el.getAttribute("data-desktop-temp-marker-dot");
    const cx=Number(el.getAttribute("cx")),cy=Number(el.getAttribute("cy"));
    /* Het datapunt onder de stip: het uur waarvan x samenvalt met de stip. */
    let i=null,d=Infinity;zichtbaar.forEach((_,k)=>{const dx=Math.abs(Number(g.x(k))-cx);if(dx<d){d=dx;i=k;}});
    return {type,cx,cy,i,dx:d,waarde:T[i],yPunt:Number(g.y(T[i]))};
  });
  /* Het vette piek/dal-cijfer en het uur waar het bij hoort. */
  const cijfers=[...svg.querySelectorAll("text[data-mobile-temp-marker],text[data-desktop-temp-marker]")].map(el=>{
    const type=el.getAttribute("data-mobile-temp-marker")||el.getAttribute("data-desktop-temp-marker");
    const v=el.getAttribute("data-mobile-temp-marker-index")??el.getAttribute("data-desktop-temp-marker-index");
    const i=v!==null&&v!==""?Number(v):null;
    return {type,i,tekst:el.textContent.trim(),waarde:i===null?null:T[i]};
  });
  /* Uren met een tijd op de as. */
  const asUren=[...svg.querySelectorAll("text")].filter(el=>!el.closest("#scrub")&&!el.closest("g[data-q4-rain-periods]")&&el.getAttribute("display")!=="none"&&/^\d{2}:00$/.test(el.textContent.trim())).map(el=>{
    if(el.hasAttribute("data-mobile-hour-index"))return Number(el.getAttribute("data-mobile-hour-index"));
    const t=el.textContent.trim(),lx=Number(el.getAttribute("x"));let best=null;
    zichtbaar.forEach((_,k)=>{if(String(g.TI[k]).slice(11,16)===t&&(best===null||Math.abs(g.x(k)-lx)<Math.abs(g.x(best)-lx)))best=k;});
    return best;
  }).filter(k=>k!==null);
  /* Punten die een cijfer dragen: op mobiel de drie-uursankers, op desktop alle uren met een label. */
  const gelabeld=g.M
    ?[...svg.querySelectorAll("[data-mobile-temp-index]")].map(el=>Number(el.getAttribute("data-mobile-temp-index")))
    :[...svg.querySelectorAll("circle[data-temp-index]")].map(el=>Number(el.getAttribute("data-temp-index")));
  return {M:!!g.M,zichtbaar,stippen,cijfers,asUren,gelabeld:[...new Set(gelabeld)].filter(i=>Number.isInteger(i)&&i<zichtbaar.length).sort((a,b)=>a-b),
    tijden:g.TI.slice(0,zichtbaar.length)};
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [w,h] of [[390,844],[1366,900]]){
      const label=w+"px";
      const {context,page,fouten}=await open(browser,root,w,h);
      try{
        const m=await page.evaluate(meet);
        const laagste=Math.min(...m.zichtbaar),hoogste=Math.max(...m.zichtbaar);
        assert.equal(laagste,15.6,label+": de testreeks moet het dal van 15,6° in beeld hebben");
        const min=m.cijfers.find(s=>s.type==="min"),max=m.cijfers.find(s=>s.type==="max");
        assert(min&&Number.isInteger(min.i),label+": geen cijfer voor het laagste punt");
        assert(max&&Number.isInteger(max.i),label+": geen cijfer voor het hoogste punt");
        for(const s of [min,max]){
          const tijd=m.tijden[s.i].slice(11,16),stip=m.stippen.find(x=>x.type===s.type);
          assert.equal(s.tekst,Math.round(s.waarde)+"°",label+": het "+s.type+"-cijfer om "+tijd+" noemt niet de waarde van zijn punt");
          /* Een stip precies dan als er een tijd onder het punt staat. */
          if(m.asUren.includes(s.i)){
            assert(stip&&stip.i===s.i&&stip.dx<=1,label+": de "+s.type+" om "+tijd+" staat boven een astijd maar heeft geen stip op het punt");
            assert(Math.abs(stip.cy-stip.yPunt)<=1,label+": de "+s.type+"-stip ligt niet op de lijn");
          }else assert(!stip,label+": de "+s.type+" om "+tijd+" staat tussen twee astijden maar heeft toch een stip");
          /* Het cijfer bij de stip klopt met het echte extreem. */
          assert.equal(Math.round(s.waarde),Math.round(s.type==="min"?laagste:hoogste),label+": de "+s.type+"-stip om "+tijd+" ("+s.waarde+"°) toont niet het echte "+(s.type==="min"?"laagste":"hoogste")+" punt");
          /* Geen ander punt met een cijfer ligt voorbij de stip. */
          const voorbij=m.gelabeld.filter(i=>s.type==="min"?m.zichtbaar[i]<s.waarde:m.zichtbaar[i]>s.waarde).map(i=>m.tijden[i].slice(11,16)+" "+m.zichtbaar[i]+"°");
          assert.deepEqual(voorbij,[],label+": de "+s.type+"-stip om "+tijd+" ("+s.waarde+"°) ligt "+(s.type==="min"?"hoger":"lager")+" dan deze punten met een cijfer");
        }
        /* Desktop draagt ieder uur een cijfer: daar is de stip het echte extreem zelf. */
        if(!m.M){
          assert.equal(min.waarde,laagste,label+": de min-stip staat niet op het echte laagste punt");
          assert.equal(max.waarde,hoogste,label+": de max-stip staat niet op het echte hoogste punt");
        }
        /* Het eerdere plateau van 16,4° om 19-20 uur is niet het dal. */
        assert(!["19:00","20:00"].includes(m.tijden[min.i].slice(11,16)),label+": de min-stip staat op het plateau van 16,4° in plaats van bij het dal van 15,6°");
        /* Elk temperatuurpunt heeft dezelfde volle stip; piek en dal vallen op door hun cijfer, niet door een grotere stip. */
        const stippen=await page.evaluate(()=>[...document.querySelectorAll("#chart circle")].filter(c=>!c.closest("#scrub")&&c.getClientRects().length&&c.getAttribute("fill")!=="var(--carmine)"
          &&(c.hasAttribute("data-temp-index")||c.hasAttribute("data-mobile-temp-marker-dot")||c.hasAttribute("data-desktop-temp-marker-dot")))
          .map(c=>({r:Number(c.getAttribute("r")),dekking:Number(getComputedStyle(c).opacity),kleur:getComputedStyle(c).fill,cx:Number(c.getAttribute("cx"))})));
        /* Iedere stip staat boven een tijd op de as. */
        const zonderTijd=await page.evaluate(()=>{const g=S.geo,svg=document.getElementById("chart");
          const tijden=[...svg.querySelectorAll("text")].filter(el=>!el.closest("#scrub")&&!el.closest("g[data-q4-rain-periods]")&&el.getAttribute("display")!=="none"&&/^\d{2}:00$/.test(el.textContent.trim()));
          const n=g.M?Math.min(24,g.T.length):g.T.length,dichtst=px=>{let b=0;for(let k=1;k<n;k++)if(Math.abs(g.x(k)-px)<Math.abs(g.x(b)-px))b=k;return b;};
          const uren=new Set(tijden.map(el=>el.hasAttribute("data-mobile-hour-index")?Number(el.getAttribute("data-mobile-hour-index")):(()=>{const t=el.textContent.trim(),lx=Number(el.getAttribute("x"));let b=null;for(let k=0;k<n;k++)if(String(g.TI[k]).slice(11,16)===t&&(b===null||Math.abs(g.x(k)-lx)<Math.abs(g.x(b)-lx)))b=k;return b;})()));
          return [...svg.querySelectorAll("circle")].filter(c=>!c.closest("#scrub")&&c.getClientRects().length&&c.getAttribute("fill")!=="var(--carmine)"&&(c.hasAttribute("data-temp-index")||c.hasAttribute("data-mobile-temp-marker-dot")||c.hasAttribute("data-desktop-temp-marker-dot")))
            .map(c=>dichtst(Number(c.getAttribute("cx")))).filter(k=>!uren.has(k)).map(k=>String(g.TI[k]).slice(11,16));});
        assert.deepEqual(zonderTijd,[],label+": stippen zonder tijd op de as eronder");
        assert(stippen.length>=5,label+": te weinig temperatuurstippen ("+stippen.length+")");
        assert.deepEqual([...new Set(stippen.map(s=>s.r))],[w<760?2.2:3],label+": temperatuurstippen hebben niet overal dezelfde grootte: "+JSON.stringify(stippen.map(s=>s.r)));
        assert(stippen.every(s=>s.dekking===1),label+": sommige temperatuurstippen zijn doorzichtig: "+JSON.stringify(stippen.map(s=>s.dekking)));
        assert.equal(new Set(stippen.map(s=>s.kleur)).size,1,label+": temperatuurstippen hebben niet dezelfde kleur");
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        const metStip=s=>m.asUren.includes(s.i)?"stip":"zonder stip";
        console.log("STIPPEN "+label+": "+stippen.length+" gelijke stippen (r "+stippen[0].r+"), alle boven een tijd; min "+m.tijden[min.i].slice(11,16)+" ("+min.waarde+"°, "+metStip(min)+"), max "+m.tijden[max.i].slice(11,16)+" ("+max.waarde+"°, "+metStip(max)+").");
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Grafiekstippen OK: hoogste en laagste punt op 390 en 1366px.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});
