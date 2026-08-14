"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("./data.js");

/* Tijdelijke measurement-only profiler. Deze test verandert geen productcode en
   stelt bewust geen nieuw performancebudget in. Hij draait exact dezelfde lokale
   cold-loadfixture als browser-performance-budget.test.js en gebruikt Chromium's
   DevTools CPU-profiler om te bepalen waar de synchrone rendertijd werkelijk zit. */
const RONDEN=5;
const KANDIDATEN=[
  "tekenAlles","themaToepassen","minibarBij","waarschuwingen","logBij",
  "meters","briefing","etmaal","nowcast","dagen","nachten","lucht","stempel"
];

function isoPlus(iso,uren){
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(iso||""));
  if(!m)throw new Error("Ongeldige fixturetijd: "+iso);
  return new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])+uren*3600000).toISOString().slice(0,16);
}

function maakForecast(){
  const d=bouw({
    temp:u=>17+3*Math.sin(u/24*Math.PI*2),
    pp:u=>u%9<4?75:15,
    pr:u=>u%9<4?0.4:0,
    som:5.1
  });
  const h=d.hourly;
  h.rain=h.precipitation.slice();
  h.showers=Array(h.time.length).fill(0);
  h.snowfall=Array(h.time.length).fill(0);
  d.current.rain=d.current.precipitation;
  d.current.showers=0;
  d.current.snowfall=0;
  d.current.visibility=20000;
  d.daily.sunshine_duration=d.daily.time.map(()=>6*3600);

  const velden=Object.keys(h).filter(k=>Array.isArray(h[k]));
  while(h.time.length<194){
    const bron=24+(h.time.length%24),laatste=h.time[h.time.length-1];
    for(const veld of velden){
      if(veld==="time")continue;
      const reeks=h[veld];
      reeks.push(reeks[bron%reeks.length]);
    }
    h.time.push(isoPlus(laatste,1));
  }
  h.time=h.time.slice(0,194);
  for(const veld of velden)if(veld!=="time")h[veld]=h[veld].slice(0,194);

  d.minutely_15={
    time:["2026-07-22T13:00","2026-07-22T13:15","2026-07-22T13:30","2026-07-22T13:45","2026-07-22T14:00","2026-07-22T14:15","2026-07-22T14:30","2026-07-22T14:45"],
    precipitation:[0,0,0,.1,.2,.2,.1,0],rain:[0,0,0,.1,.2,.2,.1,0],
    showers:[0,0,0,0,0,0,0,0],snowfall:[0,0,0,0,0,0,0,0],
    weather_code:[3,3,3,51,51,51,51,3]
  };
  return d;
}

const forecast=maakForecast();
const air={
  current:{european_aqi:22,us_aqi:37},
  hourly:{time:[forecast.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[2],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}
};

let html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
const stub=`<script>(function(){
  const FORECAST=${JSON.stringify(forecast)},AIR=${JSON.stringify(air)};
  const clone=x=>JSON.parse(JSON.stringify(x));
  const goed=x=>({ok:true,status:200,json:async()=>clone(x),text:async()=>JSON.stringify(x)});
  window.__perf={start:performance.now(),forecastUrls:[]};
  window.fetch=async function(url){
    const u=String(url);
    if(u.includes('api.open-meteo.com/v1/forecast')){window.__perf.forecastUrls.push(u);return goed(FORECAST);}
    if(u.includes('air-quality-api.open-meteo.com'))return goed(AIR);
    if(u.includes('/api/waarschuwingen'))return goed({bron:'test',dekking:true,land:'NL',lijst:[]});
    return goed({});
  };
  Date.now=()=>Date.UTC(2026,6,22,12,0,0);
})();</script>`;
html=html.replace("</head>",stub+"</head>");

const server=http.createServer((req,res)=>{
  const pathname=(req.url||"").split("?")[0];
  if(pathname==="/"||pathname==="/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;
  }
  const rel=pathname.startsWith("/")?pathname.slice(1):pathname,file=path.join(__dirname,"public",rel);
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){
    const ext=path.extname(file).toLowerCase(),types={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
    res.writeHead(200,{"content-type":types[ext]||"application/octet-stream"});fs.createReadStream(file).pipe(res);
  }else{res.writeHead(404);res.end("not found");}
});

const mediaan=waarden=>waarden.length?waarden.slice().sort((a,b)=>a-b)[Math.floor(waarden.length/2)]:0;

function vatProfielSamen(profile,poort){
  const nodes=new Map(profile.nodes.map(node=>[node.id,node]));
  const totaal=new Map();
  const appPrefix=`http://127.0.0.1:${poort}/`;
  for(let i=0;i<(profile.samples||[]).length;i++){
    const node=nodes.get(profile.samples[i]);
    if(!node)continue;
    const frame=node.callFrame||{};
    if(!String(frame.url||"").startsWith(appPrefix))continue;
    const naam=frame.functionName||"(anonymous)";
    const deltaUs=(profile.timeDeltas&&profile.timeDeltas[i])||0;
    totaal.set(naam,(totaal.get(naam)||0)+deltaUs/1000);
  }
  return totaal;
}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const poort=server.address().port;
  const browser=await chromium.launch({headless:true});
  const perFunctie=new Map(KANDIDATEN.map(naam=>[naam,[]]));
  const coldLoads=[];
  try{
    for(let ronde=0;ronde<RONDEN;ronde++){
      const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:"block"});
      const page=await context.newPage(),fouten=[];
      page.on("pageerror",e=>fouten.push(String(e)));
      page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
      const cdp=await context.newCDPSession(page);
      try{
        await cdp.send("Profiler.enable");
        await cdp.send("Profiler.setSamplingInterval",{interval:500});
        await cdp.send("Profiler.start");
        await page.goto(`http://127.0.0.1:${poort}/?lat=52.35&lon=5.26&plaats=Performance&land=NL`,{waitUntil:"domcontentloaded"});
        await page.waitForSelector("#app",{state:"visible",timeout:5000});
        const resultaat=await page.evaluate(()=>({
          elapsed:performance.now()-window.__perf.start,
          urls:window.__perf.forecastUrls.slice(),
          dagen:document.querySelectorAll("#days .row.day:not(.kop)").length,
          nachten:document.querySelectorAll("#nights .row.night:not(.kop)").length
        }));
        const {profile}=await cdp.send("Profiler.stop");
        const samenvatting=vatProfielSamen(profile,poort);

        assert.equal(resultaat.urls.length,1,`ronde ${ronde+1}: exact één hoofdforecastaanvraag`);
        assert.equal(resultaat.dagen,7,`ronde ${ronde+1}: zeven dagen gerenderd`);
        assert(resultaat.nachten>=1,`ronde ${ronde+1}: Nachtzicht gerenderd`);
        assert.deepEqual(fouten,[],`ronde ${ronde+1}: geen runtime-/consolefouten`);
        assert((profile.samples||[]).length>0,`ronde ${ronde+1}: CPU-profiler leverde samples`);

        coldLoads.push(resultaat.elapsed);
        for(const naam of KANDIDATEN)perFunctie.get(naam).push(samenvatting.get(naam)||0);
        const top=[...samenvatting.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12);
        console.log(`Profiler ronde ${ronde+1}: cold-load ${resultaat.elapsed.toFixed(1)} ms; top appfuncties: ${top.map(([naam,ms])=>`${naam} ${ms.toFixed(1)} ms`).join("; ")}`);
      }finally{
        try{await cdp.send("Profiler.disable");}catch(_){/* context kan al sluiten */}
        await context.close();
      }
    }

    console.log(`Profiler cold-load mediaan: ${mediaan(coldLoads).toFixed(1)} ms; runs ${coldLoads.map(x=>x.toFixed(1)).join(", ")} ms.`);
    const regels=KANDIDATEN.map(naam=>({naam,mediaan:mediaan(perFunctie.get(naam)),runs:perFunctie.get(naam)})).sort((a,b)=>b.mediaan-a.mediaan);
    for(const regel of regels){
      console.log(`Profiler ${regel.naam}: mediaan sampled self-time ${regel.mediaan.toFixed(1)} ms; runs ${regel.runs.map(x=>x.toFixed(1)).join(", ")} ms.`);
    }
    console.log("Measurement-only performanceprofiel voltooid; er is geen productbudget of productcode gewijzigd.");
  }finally{
    await browser.close();
    server.close();
  }
})().catch(err=>{console.error(err);server.close();process.exit(1);});
