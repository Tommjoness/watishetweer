"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const vm=require("vm");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

/* De daghelper blijft nodig voor de toegankelijke bracketbeschrijving over een
   kalendergrens. Op mobiel worden de zichtbare perioden bewust als één compacte
   klokrange weergegeven; weekdagcontext blijft uitsluitend in aria aanwezig. */
const runtimeBron=fs.readFileSync(path.join(__dirname,"scripts","q4-rain-runtime.js"),"utf8");
const helperRegel=(runtimeBron.match(/^const q4DagKort=.*;$/m)||[])[0];
assert.ok(helperRegel,"q4DagKort ontbreekt in de canonieke Q4-runtime");
const context={DAGEN:["zo","ma","di","wo","do","vr","za"],Date,Number};
vm.createContext(context);
vm.runInContext(helperRegel.replace("const q4DagKort=","globalThis.q4DagKort="),context);
const dag=context.q4DagKort;
assert.equal(dag("2026-08-31T23:30"),"ma","maandgrens: 31 augustus blijft alleen weekdag");
assert.equal(dag("2026-09-01T00:30"),"di","maandgrens: 1 september blijft alleen weekdag");
assert.equal(dag("2026-12-31T23:30"),"do","jaargrens: 31 december klopt");
assert.equal(dag("2027-01-01T00:30"),"vr","jaargrens: 1 januari klopt");
assert.equal(dag("2026-03-29T02:30"),"zo","voorjaars-DST-datum blijft kalenderdaggestuurd");
assert.equal(dag("2026-10-25T02:30"),"zo","najaars-DST-datum blijft kalenderdaggestuurd");
assert.equal(dag("2026-08-18T00:30"),"di","halve-uur kloktekst verandert de lokale kalenderdag niet");
assert.ok(!/\d/.test(dag("2026-08-17T05:00")),"korte dagnaam bevat geen losse dag-van-de-maand");

const weer=bouw({
  pp:(u,d)=>((d===0&&(u===16||u===17||u===23))||(d===1&&u<=10))?86:8,
  pr:(u,d)=>{
    if(d===0&&u===16)return 0.2;
    if(d===0&&u===17)return 0.2;
    if(d===0&&u===23)return 0.4;
    if(d===1&&u===0)return 0.5;
    if(d===1&&u===1)return 0.6;
    if(d===1&&u===2)return 0.5;
    if(d===1&&u===4)return 0.5;
    if(d===1&&u===5)return 0.5;
    if(d===1&&u===6)return 2.6;
    if(d===1&&u===7)return 1.0;
    if(d===1&&(u===8||u===9||u===10))return 0.6;
    return 0;
  },
  wc:(u,d)=>((d===0&&(u===16||u===17||u===23))||(d===1&&u<=10))?61:3,
  som:8.8
});
weer.current.interval=900;
weer.current.visibility=16000;
weer.current.cloud_cover=30;
weer.elevation=3;weer.latitude=28.61;weer.longitude=77.21;
weer.timezone="Asia/Kolkata";
weer.utc_offset_seconds=19800;
weer.daily.sunshine_duration=weer.daily.time.map(()=>7*3600);
const lucht={current:{european_aqi:22,us_aqi:45},hourly:{time:[weer.current.time],grass_pollen:[2]}};
const testNow=Date.parse("2026-07-22T08:30:00Z");

let html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
const stub=`<script>
Date.now=()=>${testNow};
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({dekking:false,land:"IN",reden:"geen ondersteunde bron"})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(lucht)}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Delhi",land:"IN",bron:"test"})}
    :${JSON.stringify(weer)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const PUBLIC=path.join(__dirname,"public");
const server=http.createServer((req,res)=>{
  const pathname=(req.url||"/").split("?")[0];
  if(pathname==="/"||pathname==="/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html);return;
  }
  const file=path.join(PUBLIC,pathname.replace(/^\//,""));
  if(file.startsWith(PUBLIC+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
    res.writeHead(200,{"cache-control":"no-store"});fs.createReadStream(file).pipe(res);return;
  }
  res.writeHead(404);res.end("not found");
});

async function controleer(type,naam){
  const browser=await type.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const fouten=[];page.on("pageerror",e=>fouten.push(String(e)));
    await page.goto(`http://127.0.0.1:${server.address().port}/?lat=28.61&lon=77.21&plaats=Delhi&land=IN`,{waitUntil:"load"});
    await page.waitForFunction(()=>typeof S!=="undefined"&&S.d&&S.i0>=0,null,{timeout:10000});

    const meerdere=await page.evaluate(()=>{
      S.dag=null;S.bereik=24;etmaal(S.i0,24);
      const svg=document.getElementById("chart"),groep=svg.querySelector('g[data-q4-rain-periods="1"]');
      return {
        starts:groep?[...groep.querySelectorAll('text[data-q4-rain-period-start]')].map(x=>(x.textContent||"").trim()):[],
        ends:groep?[...groep.querySelectorAll('text[data-q4-rain-period-end]')].map(x=>(x.textContent||"").trim()):[],
        ranges:groep?[...groep.querySelectorAll('text[data-q4-rain-period-range]')].map(x=>(x.textContent||"").trim()):[],
        bedragen:groep?[...groep.querySelectorAll('text[data-q4-rain-period-amount]')].map(x=>(x.textContent||"").trim()):[],
        lineAria:groep?[...groep.querySelectorAll('line[aria-label]')].map(x=>x.getAttribute("aria-label")||""):[],
        groepAriaHidden:groep?groep.getAttribute("aria-hidden"):null,
        svgAria:svg.getAttribute("aria-label")||"",
        details:groep?groep.querySelectorAll('text[data-q4-rain-period-detail]').length:0,
        samenvattingen:groep?groep.querySelectorAll('text[data-q4-rain-summary]').length:0,
        kansen:[...svg.querySelectorAll("text")].filter(el=>/^\d+%$/.test((el.textContent||"").trim())).length
      };
    });
    assert.deepEqual(meerdere.ranges,["15:00–17:00","22:00–02:00","03:00–10:00"],`${naam}: mobiel gebruikt voor iedere regenperiode één compacte klokrange, ook over middernacht`);
    assert.deepEqual(meerdere.starts,[],`${naam}: mobiel toont geen losse beginlabels naast compacte ranges`);
    assert.deepEqual(meerdere.ends,[],`${naam}: mobiel toont geen losse eindlabels naast compacte ranges`);
    assert.deepEqual(meerdere.bedragen,["0,4 mm","2,0 mm","6,4 mm"],`${naam}: iedere bracket houdt zijn eigen hoeveelheid`);
    assert.deepEqual(meerdere.lineAria,[],`${naam}: decoratieve SVG-lijnen dragen geen ongeldig aria-label`);
    assert.equal(meerdere.groepAriaHidden,"true",`${naam}: de visuele regenbrackets zijn decoratief voor de accessibility tree`);
    assert.ok(meerdere.svgAria.includes("wo 22:00–do 02:00")&&meerdere.svgAria.includes("2,0 mm"),`${naam}: toegankelijke SVG-samenvatting houdt beide kalenderdagen en hoeveelheid; kreeg ${JSON.stringify(meerdere.svgAria)}`);
    assert.equal(meerdere.details,0,`${naam}: tijdvakken worden niet nogmaals als losse regels herhaald`);
    assert.equal(meerdere.samenvattingen,0,`${naam}: geen totaalregel of Meeste regen-regel onder de brackets`);
    assert.equal(meerdere.kansen,0,`${naam}: zichtbare neerslagstrook toont geen statische kanspercentages`);
    assert.ok(meerdere.ranges.every(x=>/^\d{2}:\d{2}–\d{2}:\d{2}$/.test(x)),`${naam}: compacte labels bevatten uitsluitend een klokrange`);

    const enkelVolgendeDag=await page.evaluate(()=>{
      S.d.hourly.precipitation=S.d.hourly.precipitation.map((_,i)=>{
        const t=S.d.hourly.time[i]||"";
        if(t.startsWith("2026-07-23T04:"))return 0.5;
        if(t.startsWith("2026-07-23T05:"))return 0.5;
        if(t.startsWith("2026-07-23T06:"))return 2.6;
        if(t.startsWith("2026-07-23T07:"))return 1.0;
        if(/2026-07-23T(?:08|09|10):/.test(t))return 0.6;
        return 0;
      });
      S.dag=null;S.bereik=24;etmaal(S.i0,24);
      const svg=document.getElementById("chart"),groep=svg.querySelector('g[data-q4-rain-periods="1"]');
      return {
        starts:groep?[...groep.querySelectorAll('text[data-q4-rain-period-start]')].map(x=>(x.textContent||"").trim()):[],
        ends:groep?[...groep.querySelectorAll('text[data-q4-rain-period-end]')].map(x=>(x.textContent||"").trim()):[],
        ranges:groep?[...groep.querySelectorAll('text[data-q4-rain-period-range]')].map(x=>(x.textContent||"").trim()):[],
        bedragen:groep?[...groep.querySelectorAll('text[data-q4-rain-period-amount]')].map(x=>(x.textContent||"").trim()):[],
        samenvattingen:groep?groep.querySelectorAll('text[data-q4-rain-summary]').length:0,
        kansen:[...svg.querySelectorAll("text")].filter(el=>/^\d+%$/.test((el.textContent||"").trim())).length
      };
    });
    assert.deepEqual(enkelVolgendeDag.starts,[],`${naam}: brede periode op mobiel krijgt geen los beginlabel`);
    assert.deepEqual(enkelVolgendeDag.ends,[],`${naam}: brede periode op mobiel krijgt geen los eindlabel`);
    assert.deepEqual(enkelVolgendeDag.ranges,["03:00–10:00"],`${naam}: ook één brede periode blijft op mobiel één rustige klokrange`);
    assert.deepEqual(enkelVolgendeDag.bedragen,["6,4 mm"],`${naam}: enkele periode houdt alleen haar eigen mm-waarde`);
    assert.equal(enkelVolgendeDag.samenvattingen,0,`${naam}: ook één periode krijgt geen totaal- of pieksamenvatting`);
    assert.equal(enkelVolgendeDag.kansen,0,`${naam}: ook één periode toont geen statisch kanspercentage`);
    assert.deepEqual(fouten,[],`${naam}: geen page errors`);
    console.log(`${naam}: mobiele 24-uurs regenbrackets tonen compacte klokranges; dagcontext staat geldig in het SVG-label.`);
  }finally{await browser.close();}
}

server.listen(0,"127.0.0.1",async()=>{
  try{await controleer(chromium,"Chromium");await controleer(webkit,"WebKit");}
  catch(e){console.error(e&&e.stack||e);process.exitCode=1;}
  finally{server.close();}
});