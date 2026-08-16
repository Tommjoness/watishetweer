"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

const weer=bouw({
  pp:(u,dag)=>dag===0&&((u>=16&&u<=18)||(u>=21&&u<=22))?86:8,
  pr:(u,dag)=>dag===0?(u===16?0.2:u===17?0.4:u===18?0.1:u===21?0.3:u===22?0.2:0):0,
  wc:(u,dag)=>dag===0&&((u>=16&&u<=18)||(u>=21&&u<=22))?61:3,
  som:1.2
});
weer.current.interval=900;
weer.current.visibility=16000;
weer.current.cloud_cover=30;
weer.elevation=3;weer.latitude=52.35;weer.longitude=5.26;
weer.daily.sunshine_duration=weer.daily.time.map(()=>7*3600);
const lucht={current:{european_aqi:22,us_aqi:45},hourly:{time:[weer.current.time],grass_pollen:[2]}};
const testNow=Date.parse("2026-07-22T12:30:00Z");

let html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
const stub=`<script>
Date.now=()=>${testNow};
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"MeteoAlarm",dekking:true,lijst:[],land:"NL"})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(lucht)}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Regenperiodetest",land:"NL",bron:"test"})}
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
    const fouten=[];
    page.on("pageerror",e=>fouten.push(String(e)));
    await page.goto(`http://127.0.0.1:${server.address().port}/?lat=52.35&lon=5.26&plaats=Regenperiodetest&land=NL`,{waitUntil:"load"});
    await page.waitForFunction(()=>typeof S!=="undefined"&&S.d&&S.i0>=0,null,{timeout:10000});

    const uur24=await page.evaluate(()=>{
      S.dag=null;S.bereik=24;etmaal(S.i0,24);
      const groep=document.querySelector('#chart g[data-q4-rain-periods="1"]');
      return {
        n:S.geo&&S.geo.n,
        details:groep?[...groep.querySelectorAll('text[data-q4-rain-period-detail]')].map(el=>(el.textContent||"").trim()):[],
        totalen:groep?[...groep.querySelectorAll('text[data-q4-rain-period-amount]')].map(el=>(el.textContent||"").trim()):[]
      };
    });
    assert.ok(uur24.n<=25,`${naam}: test gebruikt daadwerkelijk de 24-uursweergave`);
    assert.equal(uur24.details.length,2,`${naam}: twee regenperioden krijgen twee tekstregels`);
    assert.ok(/\b\d{2}:\d{2}–\d{2}:\d{2}\b.*0,7 mm/.test(uur24.details[0]),`${naam}: eerste periode toont tijdvak en 0,7 mm; kreeg ${uur24.details[0]}`);
    assert.ok(/\b\d{2}:\d{2}–\d{2}:\d{2}\b.*0,5 mm/.test(uur24.details[1]),`${naam}: tweede periode toont tijdvak en 0,5 mm; kreeg ${uur24.details[1]}`);
    assert.deepEqual(uur24.totalen,["0,7 mm","0,5 mm"],`${naam}: bracketbedragen blijven gelijk aan de uitgeschreven perioden`);

    const langer=await page.evaluate(()=>{
      S.dag=null;S.bereik=48;etmaal(S.i0,48);
      const groep=document.querySelector('#chart g[data-q4-rain-periods="1"]');
      return {n:S.geo&&S.geo.n,details:groep?groep.querySelectorAll('text[data-q4-rain-period-detail]').length:0};
    });
    assert.ok(langer.n>25,`${naam}: tweede controle gebruikt een langere grafiek`);
    assert.equal(langer.details,0,`${naam}: langere grafiek wordt niet opgeblazen met alle perioderegels`);
    assert.deepEqual(fouten,[],`${naam}: geen page errors`);
    console.log(`${naam}: 24-uurs regenperioden tonen elk tijdvak + mm; langere grafieken blijven compact.`);
  }finally{await browser.close();}
}

server.listen(0,"127.0.0.1",async()=>{
  try{await controleer(chromium,"Chromium");await controleer(webkit,"WebKit");}
  catch(e){console.error(e&&e.stack||e);process.exitCode=1;}
  finally{server.close();}
});
