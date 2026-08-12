"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

const ROOT=__dirname;
const PUBLIC=path.join(ROOT,"public");
const indexPad=path.join(PUBLIC,"index.html");
if(!fs.existsSync(indexPad))throw new Error("Definitieve public/index.html ontbreekt voor Q4-browsercontrole.");

const weer=bouw({
  pp:(u,dag)=>dag===0&&((u>=16&&u<=18)||(u>=21&&u<=22))?86:8,
  pr:(u,dag)=>dag===0?(u===16?0.2:u===17?0.4:u===18?0.1:u===21?0.3:u===22?0.2:0):0,
  wc:(u,dag)=>dag===0&&((u>=16&&u<=18)||(u>=21&&u<=22))?61:3,
  som:1.2
});
weer.current.interval=900;
weer.current.visibility=16000;
weer.current.cloud_cover=1;
weer.elevation=3;
weer.latitude=52.35;
weer.longitude=5.26;
weer.daily.sunshine_duration=weer.daily.time.map(()=>7*3600);
const lucht={current:{european_aqi:22,us_aqi:45},hourly:{time:[weer.current.time],grass_pollen:[2]}};
const testNow=Date.parse("2026-07-22T12:30:00Z");

let html=fs.readFileSync(indexPad,"utf8");
const stub=`<script>
Date.now=()=>${testNow};
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[]})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(lucht)}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Q4 test",bron:"test"})}
    :${JSON.stringify(weer)};
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
  const rel=pathname.replace(/^\//,"");
  const p=path.join(PUBLIC,rel);
  if(p.startsWith(PUBLIC+path.sep)&&fs.existsSync(p)&&fs.statSync(p).isFile()){
    res.writeHead(200,{"content-type":mime[path.extname(p)]||"application/octet-stream","cache-control":"no-store"});
    fs.createReadStream(p).pipe(res);return;
  }
  res.writeHead(404);res.end("not found");
});

async function controleer(type,naam,breedte){
  const browser=await type.launch({headless:true});
  const context=await browser.newContext({viewport:{width:breedte,height:900},serviceWorkers:"block"});
  const page=await context.newPage();
  const fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  try{
    const base=`http://127.0.0.1:${server.address().port}/`;
    const url=base+"?lat=52.350&lon=5.260&plaats=Q4%20test&land=NL";
    await page.goto(url,{waitUntil:"load"});
    await page.waitForFunction(()=>typeof S!=="undefined"&&S.d&&S.d.current&&S.d.current.time==="2026-07-22T14:00",null,{timeout:10000});

    await page.evaluate(()=>{
      S.dag=null;S.bereik=24;
      etmaal(S.i0,24);
      if(typeof chartHint!=="function")throw new Error("Actieve chartHint()-owner ontbreekt.");
      chartHint();
      meters();
    });
    await page.waitForFunction(()=>document.querySelector('#chart g[data-q4-rain-periods]')&&S.geo&&Array.isArray(S.geo.MM),null,{timeout:5000});

    const r=await page.evaluate(()=>{
      const svg=document.getElementById("chart"),g=S.geo,regen=svg.querySelector('g[data-q4-rain-periods]');
      const teksten=[...regen.querySelectorAll("text")].map(el=>(el.textContent||"").trim());
      const kansLabels=[...svg.querySelectorAll("text")].filter(el=>/^\d+%$/.test((el.textContent||"").trim()));
      return {
        oudeStaven:[...svg.querySelectorAll("rect")].filter(el=>el.getAttribute("fill")===TEAL&&el.getAttribute("fill-opacity")===".16").length,
        oudeMm:[...svg.querySelectorAll("text")].filter(el=>/ millimeter neerslag$/.test(el.getAttribute("aria-label")||"")).length,
        brackets:regen.querySelectorAll("line").length,
        teksten,
        kansOnderTien:kansLabels.filter(el=>Number((el.textContent||"").replace("%",""))<10).length,
        kansGecentreerd:kansLabels.every(el=>{const v=Number((el.textContent||"").replace("%","")),x=Number(el.getAttribute("x"));return g.P.some((p,i)=>Number(p)===v&&Math.abs(g.x(i)-x)<0.15);}),
        mmUitgelijnd:g.MM.every((mm,i)=>{if(i===0||mm==null)return true;const bron=S.chartStart+i;return Number.isInteger(bron)&&S.d.hourly.time[bron]===g.TI[i]&&Math.abs(Number(S.d.hourly.precipitation[bron])-Number(mm))<1e-9;}),
        mmZelfdeArray:g.MM===g.Q1MM,
        regenPointerEvents:regen.getAttribute("pointer-events"),
        hint:(document.getElementById("charthint")||{}).textContent||"",
        daghint:(document.getElementById("dagenhint")||{}).textContent||"",
        windkop:[...document.querySelectorAll(".stat .eyebrow")].map(x=>x.textContent.trim()).find(x=>/^Windstoten/.test(x))||"",
        bewolking:(document.getElementById("cloud")||{}).textContent||"",
        dagteksten:[...document.querySelectorAll("#days .dcond")].map(x=>x.textContent.trim()),
        h:Number(svg.getAttribute("viewBox").trim().split(/\s+/)[3])
      };
    });

    assert.equal(r.oudeStaven,0,naam+" "+breedte+": losse hoeveelheidstaven zijn weg");
    assert.equal(r.oudeMm,0,naam+" "+breedte+": losse mm-labels zijn weg");
    assert.equal(r.brackets,6,naam+" "+breedte+": twee regenperioden geven twee brackets met eindkapjes; kreeg "+r.brackets+" lijnen; "+r.teksten.join(" | "));
    assert.equal(r.teksten.length,2,naam+" "+breedte+": wisselvallig weer blijft bij twee samenvattingsregels");
    assert(r.teksten[0].includes("2 regenperiodes")&&r.teksten[0].includes("totaal 1,2 mm"),naam+" "+breedte+": totaalregel klopt: "+r.teksten.join(" | "));
    assert(r.teksten[1].includes("Meeste regen 16:00–17:00")&&r.teksten[1].includes("0,4 mm"),naam+" "+breedte+": piekuur klopt: "+r.teksten.join(" | "));
    assert.equal(r.kansOnderTien,0,naam+" "+breedte+": triviale kanslabels onder 10% blijven uit de statische grafiek");
    assert.equal(r.kansGecentreerd,true,naam+" "+breedte+": zichtbare procentlabels horen bij hun eigen tijdstip");
    assert.equal(r.mmUitgelijnd,true,naam+" "+breedte+": strip gebruikt exact dezelfde uurwaarden als de grafiekbron");
    assert.equal(r.mmZelfdeArray,true,naam+" "+breedte+": tooltip en regenstrip delen letterlijk dezelfde mm-array");
    assert.equal(r.regenPointerEvents,"none",naam+" "+breedte+": regenlaag kan muis/touch niet onderscheppen");
    assert.equal(r.hint,"Selecteer een punt in de grafiek voor details.",naam+" "+breedte+": actieve grafiekhint is input-neutraal; kreeg "+JSON.stringify(r.hint));
    assert.equal(r.daghint,"Kies een dag om die verwachting in de grafiek te bekijken.",naam+" "+breedte+": daghint is input-neutraal");
    assert.equal(r.windkop,"Windstoten nu",naam+" "+breedte+": windstootkop is ondubbelzinnig");
    assert.equal(r.bewolking,"<5%",naam+" "+breedte+": 1% modelbewolking wordt zonder schijnprecisie als <5% gepresenteerd");
    assert(!r.dagteksten.some(t=>/rond \d{1,2}:\d{2}/.test(t)),naam+" "+breedte+": dagregels suggereren geen minuutprecisie");
    assert(r.h>296,naam+" "+breedte+": natte grafiek reserveert ruimte voor brackets en samenvatting");

    const coords=await page.evaluate(()=>{
      const svg=document.getElementById("chart"),hit=document.getElementById("hit"),g=S.geo;
      const i=g.TI.findIndex(t=>String(t).endsWith("T17:00"));
      if(i<0)return {fout:"GEEN_INDEX",ti:g.TI};
      const box=svg.getBoundingClientRect(),hitBox=hit.getBoundingClientRect();
      const bron=Number.isInteger(S.chartStart)?S.chartStart+i:null;
      return {
        i,ti:g.TI[i],bron,
        bronTijd:bron===null?null:S.d.hourly.time[bron],
        raw:bron===null?null:S.d.hourly.precipitation[bron],
        q1mm:Array.isArray(g.Q1MM)?g.Q1MM[i]:"GEEN_Q1MM",
        mm:Array.isArray(g.MM)?g.MM[i]:"GEEN_MM",
        zelfdeArray:g.Q1MM===g.MM,
        clientX:box.left+(g.x(i)/g.W)*box.width,
        clientY:hitBox.top+hitBox.height*.35,
        svgWidth:box.width,hitWidth:hitBox.width
      };
    });
    assert(!coords.fout,naam+" "+breedte+": 17:00-interactiepunt bestaat; diagnose="+JSON.stringify(coords));

    const leesScrub=()=>page.evaluate(()=>{
      const scrub=document.getElementById("scrub");
      return {
        display:scrub.style.display,
        groepTekst:(scrub.textContent||"").replace(/\s+/g," ").trim(),
        teksten:[...scrub.querySelectorAll("text")].map(el=>(el.textContent||"").trim()).filter(Boolean),
        aria:scrub.getAttribute("aria-label")||""
      };
    });

    let interactie;
    if(breedte<760){
      await page.evaluate(({clientX,clientY})=>{
        const hit=document.getElementById("hit");
        hit.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,clientX,clientY,pointerType:"touch"}));
      },coords);
      interactie=await leesScrub();
      assert(interactie.teksten.some(t=>/0,4\s*mm/.test(t)),naam+" "+breedte+": touch op 17:00 toont dezelfde 0,4 mm; diagnose="+JSON.stringify({coords,interactie})+"; pageerrors="+JSON.stringify(fouten));
      assert(/neerslagkans\s+86%/i.test(interactie.groepTekst),naam+" "+breedte+": volledige kansinformatie blijft via touch beschikbaar");
      assert.equal(interactie.display,"block",naam+" "+breedte+": touch maakt tooltip zichtbaar");
    }else{
      /* Gebruik hier de echte Playwright-muisroute. Een handmatig geconstrueerde
         PointerEvent is geen betrouwbare simulatie van browser-hit-testing en
         pointer/mouse-eventcompatibiliteit; deze test moet juist bewijzen wat een
         gebruiker met een echte muis krijgt. */
      await page.mouse.move(coords.clientX,coords.clientY);
      await page.waitForTimeout(30);
      interactie=await leesScrub();
      assert(interactie.teksten.some(t=>/0,4\s*mm/.test(t)),naam+" "+breedte+": echte muishover op 17:00 toont dezelfde 0,4 mm; diagnose="+JSON.stringify({coords,interactie})+"; pageerrors="+JSON.stringify(fouten));
      assert(/neerslagkans\s+86%/i.test(interactie.groepTekst),naam+" "+breedte+": volledige kansinformatie blijft via echte muishover beschikbaar");
      assert.equal(interactie.display,"block",naam+" "+breedte+": echte muishover maakt tooltip zichtbaar");
    }
    assert.equal(coords.zelfdeArray,true,naam+" "+breedte+": interactie leest dezelfde mm-array als regenstrip");

    const droog=await page.evaluate(()=>{
      S.d.hourly.precipitation=S.d.hourly.precipitation.map(()=>0);
      etmaal(S.i0,24);
      const svg=document.getElementById("chart");
      return {
        groep:!!svg.querySelector('g[data-q4-rain-periods]'),
        staven:[...svg.querySelectorAll("rect")].filter(el=>el.getAttribute("fill")===TEAL&&el.getAttribute("fill-opacity")===".16").length,
        kansen:[...svg.querySelectorAll("text")].filter(el=>/^\d+%$/.test((el.textContent||"").trim())).length,
        zelfdeArray:S.geo&&S.geo.MM===S.geo.Q1MM
      };
    });
    assert.equal(droog.groep,false,naam+" "+breedte+": 0 mm verzint geen regenperiode");
    assert.equal(droog.staven,0,naam+" "+breedte+": oude staven komen niet terug");
    assert.equal(droog.kansen,0,naam+" "+breedte+": uitsluitend 8%-kansen geven geen losse grafiekruis");
    assert.equal(droog.zelfdeArray,true,naam+" "+breedte+": ook droog houdt één gedeelde mm-array");
    assert.deepEqual(fouten,[],naam+" "+breedte+": geen pageerrors");
    console.log("Q4-browser OK: "+naam+" "+breedte+"px; "+r.teksten.join(" | "));
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
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{console.error(err&&err.stack||err);try{server.close(()=>{});}catch(_){}process.exit(1);});