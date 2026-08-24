"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

const PUBLIC=path.join(__dirname,"public");
const indexPad=path.join(PUBLIC,"index.html");
if(!fs.existsSync(indexPad))throw new Error("public/index.html ontbreekt.");
const basisHtml=fs.readFileSync(indexPad,"utf8");
const mime={".js":"application/javascript",".json":"application/json",".woff2":"font/woff2",".png":"image/png"};

function volgendeDatum(datum){
  const d=new Date(datum+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);
}
function fixture(soort){
  const d=bouw({poolzon:soort==="pooldag"});
  d.elevation=20;d.current.visibility=18000;
  d.daily.sunshine_duration=d.daily.time.map(()=>soort==="pooldag"?24*3600:soort==="poolnacht"?0:21.5*3600);
  d.minutely_15=d.minutely_15||{time:[],precipitation:[]};
  for(const sleutel of ["rain","showers","snowfall","weather_code"]){
    if(!Array.isArray(d.minutely_15[sleutel]))d.minutely_15[sleutel]=d.minutely_15.time.map(()=>0);
  }
  if(soort==="pooldag"){
    d.latitude=78.2232;d.longitude=15.6469;d.timezone="Arctic/Longyearbyen";d.utc_offset_seconds=7200;
    d.daily.sunrise=d.daily.time.map(x=>x+"T00:00");
    d.daily.sunset=d.daily.time.map(x=>volgendeDatum(x)+"T00:00");
    d.hourly.is_day=d.hourly.time.map(()=>1);d.current.is_day=1;
  }else if(soort==="poolnacht"){
    d.latitude=-77.8419;d.longitude=166.6863;d.timezone="Antarctica/McMurdo";d.utc_offset_seconds=43200;
    d.daily.sunrise=d.daily.time.map(x=>x+"T00:00");
    d.daily.sunset=d.daily.time.map(x=>x+"T00:00");
    d.hourly.is_day=d.hourly.time.map(()=>0);d.current.is_day=0;
  }else{
    d.latitude=69.6492;d.longitude=18.9553;d.timezone="Europe/Oslo";d.utc_offset_seconds=7200;
    d.daily.sunrise=d.daily.time.map(x=>x+"T01:00");
    d.daily.sunset=d.daily.time.map(x=>x+"T23:00");
    d.hourly.is_day=d.hourly.time.map(t=>{const u=Number(t.slice(11,13));return u>=1&&u<23?1:0;});d.current.is_day=1;
  }
  return d;
}
const fixtures={pooldag:fixture("pooldag"),poolnacht:fixture("poolnacht"),overgang:fixture("overgang")};
const air=d=>({current:{european_aqi:22,us_aqi:45},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}});
const testNow=Date.parse("2026-07-22T12:30:00Z");

function htmlVoor(soort){
  const d=fixtures[soort],a=air(d);
  const stub=`<script>
Date.now=()=>${testNow};
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[]})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(a)}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Pooltest",bron:"test"})}
    :${JSON.stringify(d)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
  return basisHtml.replace("</head>",stub+"</head>");
}

const server=http.createServer((req,res)=>{
  const url=new URL(req.url||"/","http://127.0.0.1");
  const scenario=url.pathname.slice(1);
  if(fixtures[scenario]){res.writeHead(200,{"content-type":"text/html"});res.end(htmlVoor(scenario));return;}
  const f=path.join(PUBLIC,url.pathname.replace(/^\//,""));
  if(f.startsWith(PUBLIC+path.sep)&&fs.existsSync(f)){
    res.writeHead(200,{"content-type":mime[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);return;
  }
  res.writeHead(404);res.end();
});

async function controleer(type,naam){
  const browser=await type.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  try{
    const basis=`http://127.0.0.1:${server.address().port}`;
    await page.goto(basis+"/pooldag?lat=78.2232&lon=15.6469&plaats=Longyearbyen",{waitUntil:"networkidle"});
    await page.waitForSelector("#suntimes .zonregel");
    const dag=await page.locator("#suntimes").innerText();
    const dagPagina=await page.locator("body").innerText();
    const dagNachten=await page.locator("#nights").innerText();
    assert(dag.includes("Zon gaat niet onder"),naam+": pooldag mist feitelijke tekst: "+dag);
    assert(dag.includes("24 uur daglicht"),naam+": pooldag mist daglengte: "+dag);
    assert(!/zon op 00:00|zon onder 00:00/i.test(dag),naam+": pooldag toont provider-sentinel in zoninformatie: "+dag);
    assert(!/zon op 00:00|zon onder 00:00/i.test(dagPagina),naam+": pooldag toont provider-sentinel elders op de pagina/grafiek: "+dagPagina);
    assert(/Geen nachtdata beschikbaar/i.test(dagNachten),naam+": pooldag hoort geen Nachtzicht-nacht te fabriceren: "+dagNachten);
    assert(!/\b([a-z]{2}) op \1\b/i.test(dagNachten),naam+": pooldag mag nooit een nacht binnen dezelfde kalenderdag tonen: "+dagNachten);

    await page.goto(basis+"/poolnacht?lat=-77.8419&lon=166.6863&plaats=McMurdo",{waitUntil:"networkidle"});
    await page.waitForSelector("#suntimes .zonregel");
    const nacht=await page.locator("#suntimes").innerText();
    const nachtPagina=await page.locator("body").innerText();
    const nachtRijen=await page.locator("#nights .row.night:not(.kop)").count();
    assert(nacht.includes("Zon komt niet op"),naam+": poolnacht mist feitelijke tekst: "+nacht);
    assert(nacht.includes("0 uur daglicht"),naam+": poolnacht mist daglengte: "+nacht);
    assert(!/zon op 00:00|zon onder 00:00/i.test(nacht),naam+": poolnacht toont provider-sentinel in zoninformatie: "+nacht);
    assert(!/zon op 00:00|zon onder 00:00/i.test(nachtPagina),naam+": poolnacht toont provider-sentinel elders op de pagina/grafiek: "+nachtPagina);
    assert(nachtRijen>=1,naam+": poolnacht verliest Nachtzicht ondanks volledige is_day=0-reeks");

    await page.goto(basis+"/overgang?lat=69.6492&lon=18.9553&plaats=Tromso",{waitUntil:"networkidle"});
    await page.waitForSelector("#suntimes .zonregel");
    const overgang=await page.locator("#suntimes").innerText();
    const overgangPagina=await page.locator("body").innerText();
    assert(/zon onder 23:00/i.test(overgang),naam+": lange overgangsdag verliest conventionele zonsondergang: "+overgang);
    assert(/zon onder 23:00/i.test(overgangPagina),naam+": gewone zonsondergang moet zichtbaar blijven op de pagina/grafiek: "+overgangPagina);
    assert(/22 uur en 0 minuten daglicht/i.test(overgang),naam+": lange overgangsdag heeft verkeerde daglengte: "+overgang);
    assert(!/Zon gaat niet onder|Zon komt niet op/i.test(overgang),naam+": overgangsdag is ten onrechte als poolstatus gelabeld: "+overgang);
    assert.deepEqual(errors,[],naam+": page errors");
  }finally{await browser.close();}
}

server.listen(0,"127.0.0.1",async()=>{
  try{
    await controleer(chromium,"Chromium");
    await controleer(webkit,"WebKit");
    console.log("Pooldag/poolnacht groen in Chromium en WebKit: zoninformatie én 24-uurgrafiek tonen geen 00:00-sentinels; overgangsdag blijft intact.");
  }catch(e){console.error(e.stack||e);process.exitCode=1;}
  finally{server.close();}
});
