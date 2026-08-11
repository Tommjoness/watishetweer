"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("./data.js");

/* Dit is bewust geen API-benchmark. Externe netwerklatentie wisselt per regio en
   moment en hoort niet als flaky CI-grens in de repo. De test is een regressie-
   budget voor onze eigen cold-load + volledige synchrone productrender, met de
   forecastresponse lokaal en onmiddellijk beschikbaar. Daarmee vangen we precies
   de meersecondenfreeze die door herhaalde tijdzoneconversies werd veroorzaakt. */
const BUDGET_MS=1000;
const RONDEN=3;

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

  /* Productie vraagt 24 uur historie + 168 uur toekomst. De fixture bootst die
     192 punten exact na, zodat een toekomstige onbedoelde O(n)-regressie in de
     echte datavorm meetelt in het budget. */
  const velden=Object.keys(h).filter(k=>Array.isArray(h[k]));
  while(h.time.length<192){
    const bron=24+(h.time.length%24),laatste=h.time[h.time.length-1];
    for(const veld of velden){
      if(veld==="time")continue;
      const reeks=h[veld];
      reeks.push(reeks[bron%reeks.length]);
    }
    h.time.push(isoPlus(laatste,1));
  }
  h.time=h.time.slice(0,192);
  for(const veld of velden)if(veld!=="time")h[veld]=h[veld].slice(0,192);

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

const mediaan=waarden=>waarden.slice().sort((a,b)=>a-b)[Math.floor(waarden.length/2)];

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const browser=await chromium.launch({headless:true});
  const metingen=[];
  try{
    for(let ronde=0;ronde<RONDEN;ronde++){
      const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:"block"});
      const page=await context.newPage(),fouten=[];
      page.on("pageerror",e=>fouten.push(String(e)));
      page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
      try{
        await page.goto(`http://127.0.0.1:${server.address().port}/?lat=52.35&lon=5.26&plaats=Performance&land=NL`,{waitUntil:"domcontentloaded"});
        await page.waitForSelector("#app",{state:"visible",timeout:5000});
        const resultaat=await page.evaluate(()=>({
          elapsed:performance.now()-window.__perf.start,
          urls:window.__perf.forecastUrls.slice(),
          dagen:document.querySelectorAll("#days .row.day:not(.kop)").length,
          nachten:document.querySelectorAll("#nights .row.night:not(.kop)").length,
          tekst:document.body.innerText
        }));
        assert.equal(resultaat.urls.length,1,`ronde ${ronde+1}: cold load doet exact één gezonde hoofdforecastaanvraag`);
        const forecastUrl=new URL(resultaat.urls[0]);
        assert.equal(forecastUrl.searchParams.get("forecast_hours"),"168",`ronde ${ronde+1}: hoofdforecast is tot 168 toekomstige uren begrensd`);
        assert.equal(forecastUrl.searchParams.get("past_hours"),"24",`ronde ${ronde+1}: 24 uur historie blijft beschikbaar`);
        assert.equal(resultaat.dagen,7,`ronde ${ronde+1}: volledige zevendaagse tabel is al gerenderd binnen het budget`);
        assert(resultaat.nachten>=1,`ronde ${ronde+1}: Nachtzicht is al gerenderd binnen het budget`);
        assert(!/NaN|undefined|\[object Object\]/.test(resultaat.tekst),`ronde ${ronde+1}: geen technische waarden tijdens snelle cold load`);
        assert.deepEqual(fouten,[],`ronde ${ronde+1}: geen runtime-/consolefouten`);
        metingen.push(resultaat.elapsed);
      }finally{await context.close();}
    }
    const m=mediaan(metingen);
    assert(m<BUDGET_MS,`cold-load renderbudget overschreden: mediaan ${m.toFixed(1)} ms, budget < ${BUDGET_MS} ms; runs ${metingen.map(x=>x.toFixed(1)).join(", ")} ms`);
    console.log(`Browser-performancebudget geslaagd: mediaan ${m.toFixed(1)} ms (< ${BUDGET_MS} ms), runs ${metingen.map(x=>x.toFixed(1)).join(", ")} ms; volledige 7-daagse en Nachtzicht aanwezig.`);
  }finally{await browser.close();server.close();}
})().catch(err=>{console.error(err);server.close();process.exit(1);});