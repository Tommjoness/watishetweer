"use strict";

/* Uurtijden op het finale artifact, met de echte runtime. Een uur leest
   overal als het uur dat op dat tijdstip begint: rij 18:00 toont de neerslag
   van 18:00 tot 19:00 (bij Open-Meteo de waarde op 19:00). Tabel, samenvatting
   onder de grafiek en tooltip moeten daardoor hetzelfde zeggen.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function fixture(){
  /* Regen in de bronuren 19 t/m 23: de uren 18:00-23:00. */
  const d=bouw({som:4.6,pp:(u,dag)=>dag===0&&u>=19&&u<=23?[40,70,80,65,30][u-19]:8,pr:(u,dag)=>dag===0&&u>=19&&u<=23?[0.2,1.4,2.1,0.8,0.1][u-19]:0});
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
  await page.waitForSelector("#app",{state:"visible",timeout:10000});
  await sleep(1200);
  return {context,page,fouten};
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [w,h] of [[320,700],[390,844],[1440,900]]){
      const {context,page,fouten}=await open(browser,root,w,h);
      try{
        const m=await page.evaluate(()=>{
          const hourly=S.d.hourly,rijen=[...document.querySelectorAll("#wiw-hour-table tbody tr")];
          const mmVan=v=>{const t=String(v||"").replace(",",".");const n=parseFloat(t);return /<0\.1/.test(t)?0.05:Number.isFinite(n)?n:null;};
          const uit=rijen.map(tr=>{
            const tijd=(tr.querySelector("time")?.textContent||tr.cells[0]?.textContent||"").trim().slice(0,5);
            const cellen=[...tr.cells].map(c=>c.textContent.trim());
            const mmCel=cellen.find(c=>/mm/.test(c))||"";
            return {tijd,mm:mmVan(mmCel.match(/[<0-9][0-9,.]*\s*mm/)?.[0])};
          });
          const vandaag=hourly.time.findIndex(t=>t.startsWith("2026-07-22T00:00"));
          const verwacht=uit.map(r=>{const i=hourly.time.indexOf("2026-07-22T"+r.tijd,vandaag);return i<0?null:hourly.precipitation[i+1];});
          const samenvatting=(document.getElementById("final-rain-summary")?.textContent||"").trim();
          const geo=S.geo,plotBodem=Number(geo.pt)+Number(geo.ih);
          const staven=[...document.querySelectorAll("#chart g[data-regenstaven] path.regenstaaf")].map(p=>{const b=p.getBBox(),cs=getComputedStyle(p);return {uur:String(p.getAttribute("data-uur")).slice(11,16),mm:Number(p.getAttribute("data-mm")),top:b.y,bodem:b.y+b.height,hoogte:b.height,breed:b.width,vulling:cs.fill,dekking:cs.fillOpacity};});
          const groep=document.querySelector("#chart g[data-regenstaven]"),lijnen=[...document.querySelectorAll("#chart polyline,#chart path[data-desktop-temp-area],#chart path[data-mobile-temp-area]")];
          const stavenEerst=!!groep&&lijnen.length>0&&lijnen.every(l=>groep.compareDocumentPosition(l)&Node.DOCUMENT_POSITION_FOLLOWING);
          const verwachtMm=staven.map(st=>{const i=hourly.time.indexOf("2026-07-22T"+st.uur,vandaag);return i<0?null:hourly.precipitation[i+1];});
          const bb=e=>{const b=e.getBBox();return {x:b.x,y:b.y,w:b.width,h:b.height};};
          const mmGetallen=[...document.querySelectorAll("#chart text")].filter(t=>!t.closest("#scrub")&&/^\d+,\d$/.test((t.textContent||"").trim())).map(t=>t.textContent.trim());
          return {uit,verwacht,samenvatting,staven,stavenEerst,verwachtMm,plotBodem,plotHoogte:Number(geo.ih),mmGetallen,smal:Number(geo.W)<500};
        });
        assert(m.uit.length>=5,w+"px: te weinig uurregels: "+JSON.stringify(m.uit));
        m.uit.forEach((r,k)=>{if(r.mm===null||m.verwacht[k]==null)return;assert(Math.abs(r.mm-Number(m.verwacht[k]))<0.051,w+"px: rij "+r.tijd+" toont "+r.mm+" mm, maar het uur "+r.tijd+"-"+(Number(r.tijd.slice(0,2))+1)+":00 heeft "+m.verwacht[k]+" mm");});
        const start=/(\d{2}:\d{2})\s*[–-]/.exec(m.samenvatting);
        assert(start,w+"px: samenvatting noemt geen regenperiode: "+m.samenvatting);
        const eersteNat=m.uit.find(r=>r.mm!==null&&r.mm>=0.1);
        assert(eersteNat&&eersteNat.tijd===start[1],w+"px: eerste natte uurregel ("+(eersteNat&&eersteNat.tijd)+") valt niet samen met het begin van de samenvatting ("+start[1]+")");
        /* Neerslagstaafjes: één per nat uur binnen de regenperiode uit de
           samenvatting, met de mm van dat uur, op de bodem van de grafiek,
           hoogte naar hoeveelheid en achter de temperatuurlijn. */
        const periode=/(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/.exec(m.samenvatting);
        const uren=m.staven.map(st=>st.uur),laatste=uren[uren.length-1];
        assert(periode&&uren[0]===periode[1]&&laatste&&String(Number(laatste.slice(0,2))+1).padStart(2,"0")+":00"===periode[2],w+"px: staafjes ("+uren.join(",")+") vallen niet samen met de regenperiode "+(periode&&periode[0]));
        assert.equal(m.staven.length,5,w+"px: verwacht vijf natte uren als staafje: "+JSON.stringify(uren));
        m.staven.forEach((st,k)=>{
          assert(Math.abs(st.mm-Number(m.verwachtMm[k]))<1e-9,w+"px: staafje "+st.uur+" toont "+st.mm+" mm, het uur "+st.uur+" heeft "+m.verwachtMm[k]+" mm");
          assert(Math.abs(st.bodem-m.plotBodem)<=0.6,w+"px: staafje "+st.uur+" staat niet op de bodem van de grafiek: "+JSON.stringify(st));
          assert(st.hoogte>=2&&st.hoogte<=m.plotHoogte*0.33+0.5,w+"px: staafje "+st.uur+" valt buiten het onderste derde deel: "+JSON.stringify(st));
          assert(st.breed>=3&&st.breed<=16.01,w+"px: staafje "+st.uur+" heeft een onlogische breedte: "+JSON.stringify(st));
          assert(st.vulling!=="none"&&Number(st.dekking)>=0.3&&Number(st.dekking)<=0.7,w+"px: staafje "+st.uur+" is niet zichtbaar of te fel: "+JSON.stringify(st));
        });
        const volgorde=[...m.staven].sort((a,b)=>a.mm-b.mm);
        for(let k=1;k<volgorde.length;k++)assert(volgorde[k].hoogte>=volgorde[k-1].hoogte,w+"px: hoger staafje hoort bij meer neerslag: "+JSON.stringify(volgorde));
        assert(m.stavenEerst,w+"px: neerslagstaafjes liggen niet achter de temperatuurlijn");
        /* Alleen staafjes: de hoeveelheid per uur staat in de uurtabel (op
           desktop ernaast), het totaal in de regel onder de grafiek en het uur
           bij aantikken. Getallen in de grafiek botsten met de temperatuurlijn
           en haar cijfers. */
        assert.deepEqual(m.mmGetallen,[],w+"px: neerslaggetallen in de grafiek: "+JSON.stringify(m.mmGetallen));
        assert.deepEqual(fouten,[],w+"px: runtimefouten "+fouten.join(" | "));
        console.log("UURTIJDEN "+w+"px: "+m.uit.length+" rijen tonen het uur dat op hun tijd begint; eerste natte rij "+eersteNat.tijd+" = begin samenvatting; "+m.staven.length+" neerslagstaafjes op de juiste uren, zonder getallen in de grafiek.");
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Uurtijden OK op 320, 390 en 1440px.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});
