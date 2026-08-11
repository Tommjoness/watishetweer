"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

const ROOT=__dirname,PUBLIC=path.join(ROOT,"public"),indexPad=path.join(PUBLIC,"index.html");
if(!fs.existsSync(indexPad))throw new Error("Definitieve public/index.html ontbreekt voor Q4-browsercontrole.");

const d=bouw({
  pp:(u,dag)=>dag===0&&((u>=16&&u<=18)||(u>=21&&u<=22))?86:8,
  pr:(u,dag)=>dag===0?(u===16?0.2:u===17?0.4:u===18?0.1:u===21?0.3:u===22?0.2:0):0,
  wc:(u,dag)=>dag===0&&((u>=16&&u<=18)||(u>=21&&u<=22))?61:3,
  som:1.2
});
d.current.interval=900;d.current.visibility=16000;d.elevation=3;d.latitude=52.35;d.longitude=5.26;
d.daily.sunshine_duration=d.daily.time.map(()=>7*3600);
const air={current:{european_aqi:22,us_aqi:45},hourly:{time:[d.current.time],grass_pollen:[2]}};
const testNow=Date.parse("2026-07-22T12:30:00Z");

let html=fs.readFileSync(indexPad,"utf8");
const stub=`<script>
Date.now=()=>${testNow};
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[]})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Q4 test",bron:"test"})}
    :${JSON.stringify(d)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
const server=http.createServer((req,res)=>{
  const pathname=(req.url||"/").split("?")[0];
  if(pathname==="/"||pathname==="/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html);return;
  }
  const rel=pathname.replace(/^\//,"");const p=path.join(PUBLIC,rel);
  if(p.startsWith(PUBLIC+path.sep)&&fs.existsSync(p)&&fs.statSync(p).isFile()){
    res.writeHead(200,{"content-type":mime[path.extname(p)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(p).pipe(res);return;
  }
  res.writeHead(404);res.end("not found");
});

async function controleer(type,naam,breedte){
  const browser=await type.launch({headless:true});
  const context=await browser.newContext({viewport:{width:breedte,height:900},serviceWorkers:"block"});
  const page=await context.newPage();
  const fouten=[];page.on("pageerror",e=>fouten.push(String(e)));
  try{
    const url=`http://127.0.0.1:${server.address().port}/`;
    await page.goto(url,{waitUntil:"load"});
    await page.waitForFunction(()=>document.querySelector('#chart g[data-q4-rain-periods]')&&window.S&&S.geo&&Array.isArray(S.geo.MM),null,{timeout:10000});

    const resultaat=await page.evaluate(()=>{
      const svg=document.getElementById("chart"),g=S.geo;
      const oudeStaven=[...svg.querySelectorAll("rect")].filter(el=>el.getAttribute("fill")===TEAL&&el.getAttribute("fill-opacity")===".16").length;
      const oudeMm=[...svg.querySelectorAll("text")].filter(el=>/ millimeter neerslag$/.test(el.getAttribute("aria-label")||"")).length;
      const regen=svg.querySelector('g[data-q4-rain-periods]');
      const teksten=regen?[...regen.querySelectorAll("text")].map(el=>(el.textContent||"").trim()):[];
      const kansLabels=[...svg.querySelectorAll("text")].filter(el=>/^\d+%$/.test((el.textContent||"").trim()));
      const kansGecentreerd=kansLabels.every(el=>{
        const waarde=Number((el.textContent||"").replace("%","")),x=Number(el.getAttribute("x"));
        return g.P.some((p,i)=>Number(p)===waarde&&Math.abs(g.x(i)-x)<0.15);
      });
      const mmUitgelijnd=g.MM.every((mm,i)=>{
        if(i===0||mm==null)return true;
        const bron=S.chartStart+i;
        return Number.isInteger(bron)&&S.d.hourly.time[bron]===g.TI[i]&&Math.abs(Number(S.d.hourly.precipitation[bron])-Number(mm))<1e-9;
      });
      return {
        oudeStaven,oudeMm,teksten,kansGecentreerd,mmUitgelijnd,
        hint:(document.getElementById("charthint")||{}).textContent||"",
        daghint:(document.getElementById("dagenhint")||{}).textContent||"",
        windkop:[...document.querySelectorAll(".stat .eyebrow")].map(x=>x.textContent.trim()).find(x=>/^Windstoten/.test(x))||"",
        dagteksten:[...document.querySelectorAll("#days .dcond")].map(x=>x.textContent.trim()),
        h:Number(svg.getAttribute("viewBox").trim().split(/\s+/)[3])
      };
    });
    assert.equal(resultaat.oudeStaven,0,naam+" "+breedte+": losse hoeveelheidstaven moeten weg zijn");
    assert.equal(resultaat.oudeMm,0,naam+" "+breedte+": losse mm-labels moeten weg zijn");
    assert.equal(resultaat.teksten.length,2,naam+" "+breedte+": twee gescheiden regenperioden moeten twee samenvattingen geven");
    assert(resultaat.teksten.some(t=>t.includes("15:00–18:00")&&t.includes("0,7 mm")&&t.includes("16:00–17:00: 0,4 mm")),naam+" "+breedte+": eerste periode moet start/einde, totaal en piekuur tonen: "+resultaat.teksten.join(" | "));
    assert(resultaat.teksten.some(t=>t.includes("20:00–22:00")&&t.includes("0,5 mm")),naam+" "+breedte+": tweede periode moet afzonderlijk blijven");
    assert.equal(resultaat.kansGecentreerd,true,naam+" "+breedte+": procentlabels moeten bij hun eigen tijdstip staan");
    assert.equal(resultaat.mmUitgelijnd,true,naam+" "+breedte+": regenstrook moet exact dezelfde uurlijkse bronwaarden gebruiken");
    assert.equal(resultaat.hint,"Selecteer een punt in de grafiek voor details.",naam+" "+breedte+": grafiekhint moet invoermethode-neutraal zijn");
    assert.equal(resultaat.daghint,"Kies een dag om die verwachting in de grafiek te bekijken.",naam+" "+breedte+": daghint moet invoermethode-neutraal zijn");
    assert.equal(resultaat.windkop,"Windstoten nu",naam+" "+breedte+": actuele windstootkop moet ondubbelzinnig zijn");
    assert(!resultaat.dagteksten.some(t=>/rond \d{1,2}:\d{2}/.test(t)),naam+" "+breedte+": dagregels mogen geen minuutprecisie suggereren");
    assert(resultaat.h>296,naam+" "+breedte+": natte grafiek moet ruimte voor de regenperioden reserveren");

    /* Hover exact op het interval dat om 17:00 eindigt. De tooltip moet dezelfde
       0,4 mm tonen als de periodepiek; anders zouden strip en interactie opnieuw
       twee verschillende waarheden hebben. */
    const hover=await page.evaluate(()=>{
      const svg=document.getElementById("chart"),hit=document.getElementById("hit"),scrub=document.getElementById("scrub"),g=S.geo;
      const i=g.TI.findIndex(t=>String(t).endsWith("T17:00"));if(i<0)return "GEEN_INDEX";
      const r=svg.getBoundingClientRect(),hr=hit.getBoundingClientRect();
      const clientX=r.left+(g.x(i)/g.W)*r.width;
      hit.dispatchEvent(new PointerEvent("pointermove",{bubbles:true,clientX,clientY:hr.top+hr.height*.35,pointerType:"mouse"}));
      return scrub.textContent.replace(/\s+/g," ").trim();
    });
    assert(/0,4\s*mm/.test(hover),naam+" "+breedte+": hover op 17:00 moet dezelfde 0,4 mm tonen als de periodepiek; kreeg: "+hover);

    /* Hoge kans zonder meetbare hoeveelheid: geen kunstmatige regenstrook. */
    const droog=await page.evaluate(()=>{
      S.d.hourly.precipitation=S.d.hourly.precipitation.map(()=>0);
      etmaal(S.i0,24);
      const svg=document.getElementById("chart");
      return {
        groep:!!svg.querySelector('g[data-q4-rain-periods]'),
        staven:[...svg.querySelectorAll("rect")].filter(el=>el.getAttribute("fill")===TEAL&&el.getAttribute("fill-opacity")===".16").length,
        kansen:[...svg.querySelectorAll("text")].filter(el=>/^\d+%$/.test((el.textContent||"").trim())).length
      };
    });
    assert.equal(droog.groep,false,naam+" "+breedte+": 0 mm mag geen regenperiode verzinnen");
    assert.equal(droog.staven,0,naam+" "+breedte+": oude staven mogen ook zonder hoeveelheid niet terugkomen");
    assert(droog.kansen>0,naam+" "+breedte+": neerslagkans blijft zichtbaar wanneer hoeveelheid nul is");
    assert.deepEqual(fouten,[],naam+" "+breedte+": browserruntime mag geen pageerror geven");
    console.log("Q4-browser OK: "+naam+" "+breedte+"px; "+resultaat.teksten.join(" | "));
  }finally{
    await context.close();await browser.close();
  }
}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try{
    for(const [type,naam] of [[chromium,"Chromium"],[webkit,"WebKit"]]){
      await controleer(type,naam,390);
      await controleer(type,naam,1280);
    }
    console.log("Q4-browsercontrole geslaagd in Chromium en WebKit, mobiel en desktop.");
  }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(err=>{console.error(err&&err.stack||err);try{server.close(()=>{});}catch(_){}process.exit(1);});
