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
  pp:(u,dag)=>dag===0&&u===15?19:dag===0&&((u>=16&&u<=18)||(u>=21&&u<=22))?86:8,
  pr:(u,dag)=>dag===0?(u===16?0.2:u===17?0.4:u===18?0.1:u===21?0.3:u===22?0.2:0):0,
  wc:(u,dag)=>dag===0&&((u>=16&&u<=18)||(u>=21&&u<=22))?61:3,
  som:1.2
});
weer.current.interval=900;
weer.current.visibility=16000;
weer.current.cloud_cover=1;
weer.hourly.cloud_cover=weer.hourly.cloud_cover.map(()=>1);
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
    await page.waitForFunction(()=>{
      const el=document.querySelector("#aq .stat:first-child .sval");
      return el&&(el.textContent||"").trim()==="22";
    },null,{timeout:5000});

    const r=await page.evaluate(()=>{
      const svg=document.getElementById("chart"),g=S.geo,regen=svg.querySelector('g[data-q4-rain-periods]');
      const teksten=[...regen.querySelectorAll("text")].map(el=>(el.textContent||"").trim());
      const samenvattingen=[...regen.querySelectorAll('text[data-q4-rain-summary]')].map(el=>(el.textContent||"").trim());
      const periodeBedragen=[...regen.querySelectorAll('text[data-q4-rain-period-amount]')].map(el=>(el.textContent||"").trim());
      const kansLabels=[...svg.querySelectorAll("text")].filter(el=>/^\d+%$/.test((el.textContent||"").trim())).map(el=>(el.textContent||"").trim());
      const pop=document.getElementById("pop"),popStat=pop&&pop.parentElement,popKop=popStat&&popStat.querySelector(".eyebrow");
      return {
        oudeStaven:[...svg.querySelectorAll("rect")].filter(el=>el.getAttribute("fill")===TEAL&&el.getAttribute("fill-opacity")===".16").length,
        oudeMm:[...svg.querySelectorAll("text")].filter(el=>/ millimeter neerslag$/.test(el.getAttribute("aria-label")||"")).length,
        brackets:regen.querySelectorAll("line").length,
        teksten,samenvattingen,periodeBedragen,kansLabels,
        mmUitgelijnd:g.MM.every((mm,i)=>{if(i===0||mm==null)return true;const bron=S.chartStart+i;return Number.isInteger(bron)&&S.d.hourly.time[bron]===g.TI[i]&&Math.abs(Number(S.d.hourly.precipitation[bron])-Number(mm))<1e-9;}),
        mmZelfdeArray:g.MM===g.Q1MM,
        regenPointerEvents:regen.getAttribute("pointer-events"),
        hint:(document.getElementById("charthint")||{}).textContent||"",
        daghint:(document.getElementById("dagenhint")||{}).textContent||"",
        windkop:[...document.querySelectorAll(".stat .eyebrow")].map(x=>x.textContent.trim()).find(x=>/^Max\. windstoot/.test(x))||"",
        neerslagKop:(popKop&&popKop.textContent||"").trim(),
        bewolking:(document.getElementById("cloud")||{}).textContent||"",
        nachtBewolking:[...document.querySelectorAll("#nights .perc")].map(el=>(el.textContent||"").trim()),
        aqiSub:(document.querySelector("#aq .stat:first-child .ssub")||{}).textContent||"",
        dagteksten:[...document.querySelectorAll("#days .dcond")].map(x=>x.textContent.trim()),
        h:Number(svg.getAttribute("viewBox").trim().split(/\s+/)[3])
      };
    });

    assert.equal(r.oudeStaven,0,naam+" "+breedte+": losse hoeveelheidstaven zijn weg");
    assert.equal(r.oudeMm,0,naam+" "+breedte+": oude losse mm-labels zijn weg");
    assert.equal(r.brackets,6,naam+" "+breedte+": twee regenperioden geven twee brackets met eindkapjes; kreeg "+r.brackets+" lijnen; "+r.teksten.join(" | "));
    assert.deepEqual(r.periodeBedragen,["0,7 mm","0,5 mm"],naam+" "+breedte+": iedere bracket toont zijn eigen periodetotaal; kreeg "+JSON.stringify(r.periodeBedragen));
    assert.equal(r.samenvattingen.length,0,naam+" "+breedte+": totaalregel en pieksamenvatting zijn bewust verwijderd");
    assert.equal(r.kansLabels.length,0,naam+" "+breedte+": statische neerslagpercentages zijn bewust uit de tijdlijn verwijderd; kreeg "+JSON.stringify(r.kansLabels));
    assert.equal(r.mmUitgelijnd,true,naam+" "+breedte+": strip gebruikt exact dezelfde uurwaarden als de grafiekbron");
    assert.equal(r.mmZelfdeArray,true,naam+" "+breedte+": tooltip en regenstrip delen letterlijk dezelfde mm-array");
    assert.equal(r.regenPointerEvents,"none",naam+" "+breedte+": regenlaag kan muis/touch niet onderscheppen");
    assert.equal(r.hint,"Selecteer een punt in de grafiek voor details.",naam+" "+breedte+": actieve grafiekhint is input-neutraal; kreeg "+JSON.stringify(r.hint));
    assert.equal(r.daghint,"Kies een dag om die verwachting in de grafiek te bekijken.",naam+" "+breedte+": daghint is input-neutraal");
    assert.equal(r.windkop,"Max. windstoot dit uur",naam+" "+breedte+": windstootkop gebruikt dezelfde uurforecast-scope als waarde en subtekst");
    assert.equal(r.neerslagKop,"Neerslagverwachting komend uur",naam+" "+breedte+": kans en hoeveelheid worden expliciet als uurverwachting gelabeld");
    assert.equal(r.bewolking,"<5%",naam+" "+breedte+": 1% modelbewolking wordt zonder schijnprecisie als <5% gepresenteerd");
    assert(r.nachtBewolking.length>0&&r.nachtBewolking.every(t=>t==="<5%"),naam+" "+breedte+": Nachtzicht gebruikt dezelfde <5%-notatie; kreeg "+JSON.stringify(r.nachtBewolking));
    assert.equal(r.aqiSub,"Redelijk",naam+" "+breedte+": AQI-subregel herhaalt de schaalnaam niet; kreeg "+JSON.stringify(r.aqiSub));
    assert(!r.dagteksten.some(t=>/rond \d{1,2}:\d{2}/.test(t)),naam+" "+breedte+": dagregels suggereren geen minuutprecisie");
    assert(r.h>296,naam+" "+breedte+": natte grafiek reserveert ruimte voor brackets, tijdlabels en bedragen");

    await page.locator("#chart").scrollIntoViewIfNeeded();
    const puntCoords=uur=>page.evaluate(uur=>{
      const svg=document.getElementById("chart"),hit=document.getElementById("hit"),g=S.geo;
      const i=g.TI.findIndex(t=>String(t).endsWith("T"+uur));
      if(i<0)return {fout:"GEEN_INDEX",uur,ti:g.TI};
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
    },uur);

    const coords=await puntCoords("17:00");
    assert(!coords.fout,naam+" "+breedte+": 17:00-interactiepunt bestaat; diagnose="+JSON.stringify(coords));

    const leesScrub=()=>page.evaluate(()=>{
      const scrub=document.getElementById("scrub");
      const teksten=[...scrub.querySelectorAll("text")].map(el=>(el.textContent||"").trim()).filter(Boolean);
      return {
        display:scrub.style.display,
        groepTekst:teksten.join(" "),
        teksten,
        aria:scrub.getAttribute("aria-label")||""
      };
    });

    const grafiekAria=await page.locator("#chart").getAttribute("aria-label")||"";
    assert(!grafiekAria.includes(".;")&&!/;\s*een deels verstreken modeluur/i.test(grafiekAria),naam+" "+breedte+": grafieklabel bevat achtergebleven interpunctie of een halve verwijderde zin: "+grafiekAria);

    const interacteer=async coords=>{
      if(breedte<760){
        await page.evaluate(({clientX,clientY})=>{
          const hit=document.getElementById("hit");
          hit.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,clientX,clientY,pointerType:"touch"}));
        },coords);
      }else{
        /* Gebruik hier de echte Playwright-muisroute. Een handmatig geconstrueerde
           PointerEvent is geen betrouwbare simulatie van browser-hit-testing en
           pointer/mouse-eventcompatibiliteit. */
        await page.mouse.move(coords.clientX,coords.clientY);
        await page.waitForTimeout(30);
      }
      return leesScrub();
    };

    const interactie=await interacteer(coords);
    assert(interactie.teksten.some(t=>/0,4\s*mm/.test(t)),naam+" "+breedte+": interactie op 17:00 toont dezelfde 0,4 mm; diagnose="+JSON.stringify({coords,interactie})+"; pageerrors="+JSON.stringify(fouten));
    assert(/neerslagkans\s+86%/i.test(interactie.groepTekst),naam+" "+breedte+": volledige kansinformatie blijft via tooltip beschikbaar");
    assert.equal(interactie.display,"block",naam+" "+breedte+": interactie maakt tooltip zichtbaar");
    assert.equal(coords.zelfdeArray,true,naam+" "+breedte+": interactie leest dezelfde mm-array als regenstrip");

    /* Het New-York-randgeval: 19% kans maar 0 mm hoort niet als statisch label
       onder een droog stuk te staan. De kans verdwijnt echter niet uit de data:
       via mouse/touch op dat uur blijft hij volledig beschikbaar. */
    const drogeKansCoords=await puntCoords("15:00");
    assert(!drogeKansCoords.fout,naam+" "+breedte+": droog 19%-interactiepunt bestaat; diagnose="+JSON.stringify(drogeKansCoords));
    assert.equal(Number(drogeKansCoords.raw),0,naam+" "+breedte+": 15:00-fixture heeft aantoonbaar 0 mm");
    const drogeKansInteractie=await interacteer(drogeKansCoords);
    assert(/neerslagkans\s+19%/i.test(drogeKansInteractie.groepTekst),naam+" "+breedte+": verborgen droge 19%-kans blijft via tooltip beschikbaar; diagnose="+JSON.stringify(drogeKansInteractie));

    /* Luoyang-randgeval: een positieve, maar onder de centrale 0,1-mm-grens
       liggende kwartierwaarde mag niet eerst een staaf tekenen en vervolgens als
       0,0 worden afgerond. Eén echt meetbaar interval van exact 0,1 blijft wel
       zichtbaar. We muteren alleen de testfixture en herstellen hem direct. */
    const kwartier=await page.evaluate(()=>{
      const m=S.d.minutely_15,api=globalThis.WeatherNowInterpretatie;
      if(!m||!api||typeof api.analyseerNeerslagData!=="function")return {fout:"GEEN_KWARTIERDATA"};
      const origineel={
        time:Array.isArray(m.time)?m.time.slice():null,
        precipitation:m.precipitation.slice(),
        rain:Array.isArray(m.rain)?m.rain.slice():null,
        showers:Array.isArray(m.showers)?m.showers.slice():null,
        snowfall:Array.isArray(m.snowfall)?m.snowfall.slice():null
      };
      /* De centrale engine kiest kwartierdata pas bij minimaal 90% dekking van
         het gevraagde venster. Maak daarom uitsluitend voor deze browserproef
         een volledig toekomstig twee-uursvenster van acht kwartieren. */
      m.time=["2026-07-22T14:45","2026-07-22T15:00","2026-07-22T15:15","2026-07-22T15:30","2026-07-22T15:45","2026-07-22T16:00","2026-07-22T16:15","2026-07-22T16:30"];
      m.precipitation=m.time.map(()=>0);
      if(Array.isArray(m.rain))m.rain=m.time.map(()=>0);
      if(Array.isArray(m.showers))m.showers=m.time.map(()=>0);
      if(Array.isArray(m.snowfall))m.snowfall=m.time.map(()=>0);
      const basis=api.analyseerNeerslagData(S.d,120,weatherNowActueleLokaleTijd());
      const items=basis&&Array.isArray(basis.minutelyItems)?basis.minutelyItems:[];
      if(!basis||basis.bronHoeveelheid!=="kwartierdata"){
        m.time=origineel.time;
        m.precipitation=origineel.precipitation;
        if(origineel.rain)m.rain=origineel.rain;
        if(origineel.showers)m.showers=origineel.showers;
        if(origineel.snowfall)m.snowfall=origineel.snowfall;
        return {fout:"GEEN_KWARTIERBRON",bron:basis&&basis.bronHoeveelheid,dekking:basis&&basis.hoeveelheidDekking,items:items.length};
      }
      const a=items.find(x=>Number(x.fractie)>0),b=items.find(x=>Number(x.fractie)>=0.999&&x!==a)||items[1];
      if(!a||!b){
        m.time=origineel.time;
        m.precipitation=origineel.precipitation;
        if(origineel.rain)m.rain=origineel.rain;
        if(origineel.showers)m.showers=origineel.showers;
        if(origineel.snowfall)m.snowfall=origineel.snowfall;
        return {fout:"TE_WEINIG_ITEMS",items:items.length};
      }
      const fa=Number(a.fractie)||1,fb=Number(b.fractie)||1;
      m.precipitation[a.i]=0.04/fa;
      m.precipitation[b.i]=0.1/fb;
      if(Array.isArray(m.rain)){m.rain[a.i]=m.precipitation[a.i];m.rain[b.i]=m.precipitation[b.i];}
      nowcast();
      const svg=document.getElementById("nc");
      const bedragen=[...svg.querySelectorAll("text")]
        .filter(el=>el.getAttribute("fill")===TEAL&&/^\d+(?:[.,]\d+)?$/.test((el.textContent||"").trim()))
        .map(el=>(el.textContent||"").trim());
      const staven=[...svg.querySelectorAll("rect")].filter(el=>el.getAttribute("fill")===TEAL&&el.getAttribute("fill-opacity")===".2").length;
      m.time=origineel.time;
      m.precipitation=origineel.precipitation;
      if(origineel.rain)m.rain=origineel.rain;
      if(origineel.showers)m.showers=origineel.showers;
      if(origineel.snowfall)m.snowfall=origineel.snowfall;
      return {bedragen,staven};
    });
    assert(!kwartier.fout,naam+" "+breedte+": kwartierfixture kon worden opgebouwd; diagnose="+JSON.stringify(kwartier));
    assert(!kwartier.bedragen.includes("0,0"),naam+" "+breedte+": spoorhoeveelheid wordt nooit als 0,0 getoond; kreeg "+JSON.stringify(kwartier));
    assert.deepEqual(kwartier.bedragen,["0,1"],naam+" "+breedte+": alleen het meetbare 0,1-mm-interval houdt een hoeveelheidlabel; kreeg "+JSON.stringify(kwartier));
    assert.equal(kwartier.staven,1,naam+" "+breedte+": spoorhoeveelheid krijgt geen statische staaf; exact 0,1 mm wel");

    const droog=await page.evaluate(()=>{
      S.d.hourly.precipitation=S.d.hourly.precipitation.map(()=>0);
      S.d.hourly.precipitation_probability=S.d.hourly.precipitation_probability.map(()=>8);
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
    assert.equal(droog.kansen,0,naam+" "+breedte+": droge grafiek houdt geen statische kanspercentages");
    assert.equal(droog.zelfdeArray,true,naam+" "+breedte+": ook droog houdt één gedeelde mm-array");
    assert.deepEqual(fouten,[],naam+" "+breedte+": geen pageerrors");
    console.log("Q4-browser OK: "+naam+" "+breedte+"px; perioden "+r.periodeBedragen.join(" | ")+"; kansen alleen interactief");
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