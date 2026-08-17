"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const vm=require("vm");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

/* Test de echte canonieke helperbron ook los op kalendergrenzen. Zo bewaken we
   dat een korte dagnaam nooit ongemerkt weer een dagnummer krijgt. */
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
      const groep=document.querySelector('#chart g[data-q4-rain-periods="1"]');
      return {
        details:groep?[...groep.querySelectorAll('text[data-q4-rain-period-detail]')].map(x=>(x.textContent||"").trim()):[],
        piek:(groep&&groep.querySelector('text[data-q4-rain-summary="peak"]')||{}).textContent||""
      };
    });
    assert.deepEqual(meerdere.details,[
      "15:00–17:00 · 0,4 mm",
      "wo 22:00–do 02:00 · 2,0 mm",
      "do 03:00–10:00 · 6,4 mm"
    ],`${naam}: vandaag, kalendergrens en volgende lokale dag gebruiken één datumconventie`);
    assert.equal(meerdere.piek.trim(),"Meeste regen do 05:00–06:00 · 2,6 mm",`${naam}: natste uur gebruikt dezelfde korte dagconventie`);

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
      const groep=document.querySelector('#chart g[data-q4-rain-periods="1"]');
      return {
        totaal:(groep&&groep.querySelector('text[data-q4-rain-summary="total"]')||{}).textContent||"",
        piek:(groep&&groep.querySelector('text[data-q4-rain-summary="peak"]')||{}).textContent||""
      };
    });
    assert.equal(enkelVolgendeDag.totaal.trim(),"do 03:00–10:00 · totaal 6,4 mm",`${naam}: enkele regenperiode op volgende lokale dag noemt de dag`);
    assert.equal(enkelVolgendeDag.piek.trim(),"Meeste regen do 05:00–06:00 · 2,6 mm",`${naam}: piek blijft gelijk aan periodeconventie`);
    assert.deepEqual(fouten,[],`${naam}: geen page errors`);
    console.log(`${naam}: regendatumlabels zijn consistent over lokale daggrens en halve-uur tijdzone.`);
  }finally{await browser.close();}
}

server.listen(0,"127.0.0.1",async()=>{
  try{await controleer(chromium,"Chromium");await controleer(webkit,"WebKit");}
  catch(e){console.error(e&&e.stack||e);process.exitCode=1;}
  finally{server.close();}
});
