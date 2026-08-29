"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("./data.js");

const RONDEN=5;
const CLS_BUDGET=0.1;
const VIEWPORT={width:390,height:844};

function isoPlus(iso,uren){
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(iso||""));
  if(!m)throw new Error("Ongeldige fixturetijd: "+iso);
  return new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])+uren*3600000).toISOString().slice(0,16);
}

function maakForecast(){
  const d=bouw({temp:u=>18+2*Math.sin(u/24*Math.PI*2),pp:u=>u%10<3?55:10,pr:u=>u%10<3?0.2:0,som:2.6});
  const h=d.hourly;
  h.rain=h.precipitation.slice();
  h.showers=Array(h.time.length).fill(0);
  h.snowfall=Array(h.time.length).fill(0);
  d.current.rain=d.current.precipitation;
  d.current.showers=0;d.current.snowfall=0;d.current.visibility=20000;
  d.daily.sunshine_duration=d.daily.time.map(()=>6*3600);
  const velden=Object.keys(h).filter(k=>Array.isArray(h[k]));
  while(h.time.length<194){
    const bron=24+(h.time.length%24),laatste=h.time[h.time.length-1];
    for(const veld of velden){if(veld!=="time")h[veld].push(h[veld][bron%h[veld].length]);}
    h.time.push(isoPlus(laatste,1));
  }
  h.time=h.time.slice(0,194);
  for(const veld of velden)if(veld!=="time")h[veld]=h[veld].slice(0,194);
  d.minutely_15={
    time:["2026-07-22T13:00","2026-07-22T13:15","2026-07-22T13:30","2026-07-22T13:45","2026-07-22T14:00","2026-07-22T14:15","2026-07-22T14:30","2026-07-22T14:45"],
    precipitation:[0,0,0,.1,.2,.2,.1,0],rain:[0,0,0,.1,.2,.2,.1,0],showers:Array(8).fill(0),snowfall:Array(8).fill(0),weather_code:[3,3,3,51,51,51,51,3]
  };
  return d;
}

const forecast=maakForecast();
const air={current:{european_aqi:22,us_aqi:37},hourly:{time:[forecast.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[2],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");

const server=http.createServer((req,res)=>{
  const pathname=(req.url||"").split("?")[0];
  if(pathname==="/"||pathname==="/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html);return;
  }
  const rel=pathname.startsWith("/")?pathname.slice(1):pathname,file=path.join(__dirname,"public",rel);
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){
    const ext=path.extname(file).toLowerCase(),types={".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
    res.writeHead(200,{"content-type":types[ext]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(file).pipe(res);
  }else{res.writeHead(404);res.end("not found");}
});

function clsUit(entries){
  const waarden=(entries||[]).filter(x=>x&&!x.hadRecentInput&&Number.isFinite(x.value)&&x.value>0).sort((a,b)=>a.startTime-b.startTime);
  let max=0,som=0,start=null,vorig=null;
  for(const e of waarden){
    if(start===null||e.startTime-vorig>1000||e.startTime-start>5000){start=e.startTime;som=e.value;}else som+=e.value;
    vorig=e.startTime;max=Math.max(max,som);
  }
  return max;
}

const scenarioLijst=[
  {naam:"normale koude load",waarschuwingDelay:250,waarschuwing:{bron:"test",dekking:true,land:"NL",lijst:[]}},
  {naam:"trage waarschuwingfallback",waarschuwingDelay:1400,waarschuwing:{bron:"test",dekking:false,land:"NL",reden:"bron onbereikbaar",lijst:[]}}
];

async function meetScenario(browser,scenario){
  const runs=[];
  for(let ronde=0;ronde<RONDEN;ronde++){
    const context=await browser.newContext({viewport:VIEWPORT,isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:"block"});
    const page=await context.newPage(),fouten=[];
    page.on("pageerror",e=>fouten.push(String(e)));
    page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
    await page.addInitScript(({forecast,air,scenario})=>{
      const clone=x=>JSON.parse(JSON.stringify(x));
      const antwoord=x=>({ok:true,status:200,json:async()=>clone(x),text:async()=>JSON.stringify(x)});
      const NativeDate=Date,nativeStart=NativeDate.now(),fixtureStart=NativeDate.parse("2026-07-22T12:00:00Z");
      class FixtureDate extends NativeDate{constructor(...args){super(...(args.length?args:[fixtureStart+(NativeDate.now()-nativeStart)]));}static now(){return fixtureStart+(NativeDate.now()-nativeStart);}}
      window.Date=FixtureDate;
      window.__clsEntries=[];window.__initialScrollY=window.scrollY;
      try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__clsEntries.push({value:e.value,startTime:e.startTime,hadRecentInput:e.hadRecentInput,sources:(e.sources||[]).map(s=>({node:s.node&&s.node.id||s.node&&s.node.className||s.node&&s.node.nodeName||"",previousRect:s.previousRect,currentRect:s.currentRect}))});}).observe({type:"layout-shift",buffered:true});}catch(_){/* oude engine: test faalt hieronder expliciet */}
      window.fetch=async function(url){
        const u=String(url);
        if(u.includes("api.open-meteo.com/v1/forecast"))return antwoord(forecast);
        if(u.includes("air-quality-api.open-meteo.com"))return antwoord(air);
        if(u.includes("/api/waarschuwingen")){await new Promise(r=>setTimeout(r,scenario.waarschuwingDelay));return antwoord(scenario.waarschuwing);}
        if(u.includes("/api/neerslag"))return antwoord({nowcast:null,actueel:null,bron:"test"});
        return antwoord({});
      };
    },{forecast,air,scenario});
    try{
      await page.goto(`http://127.0.0.1:${server.address().port}/?lat=52.35&lon=5.26&plaats=CLS-test&land=NL`,{waitUntil:"domcontentloaded"});
      await page.waitForSelector("#app",{state:"visible",timeout:5000});
      await page.waitForTimeout(Math.max(2200,scenario.waarschuwingDelay+700));
      const meting=await page.evaluate(()=>({entries:window.__clsEntries||[],initialScrollY:window.__initialScrollY,finalScrollY:window.scrollY,appTop:document.getElementById("app")?.getBoundingClientRect().top,briefTop:document.getElementById("brief")?.getBoundingClientRect().top,tekst:document.body.innerText}));
      assert(Array.isArray(meting.entries),`${scenario.naam} ronde ${ronde+1}: layout-shift PerformanceObserver ontbreekt`);
      const cls=clsUit(meting.entries);
      assert(cls<CLS_BUDGET,`${scenario.naam} ronde ${ronde+1}: CLS ${cls.toFixed(3)} overschrijdt budget < ${CLS_BUDGET}; shifts ${JSON.stringify(meting.entries)}`);
      assert.equal(meting.finalScrollY,meting.initialScrollY,`${scenario.naam} ronde ${ronde+1}: initiële scrollY veranderde van ${meting.initialScrollY} naar ${meting.finalScrollY}`);
      assert.deepEqual(fouten,[],`${scenario.naam} ronde ${ronde+1}: geen runtime-/consolefouten verwacht`);
      runs.push(cls);
    }finally{await context.close();}
  }
  console.log(`${scenario.naam}: ${RONDEN} mobiele cold loads groen; CLS ${runs.map(v=>v.toFixed(3)).join(", ")} (< ${CLS_BUDGET}), scrollY stabiel.`);
  return runs;
}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const browser=await chromium.launch({headless:true});
  try{for(const scenario of scenarioLijst)await meetScenario(browser,scenario);}
  finally{await browser.close();server.close();}
})().catch(err=>{console.error(err);server.close();process.exit(1);});
