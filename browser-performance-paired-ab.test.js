"use strict";

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("./data.js");

const baseDir=process.argv[2],candidateDir=process.argv[3];
if(!baseDir||!candidateDir)throw new Error("Gebruik: node browser-performance-paired-ab.test.js <base-public> <candidate-public>");
const RONDEN=5;

function isoPlus(iso,uren){const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(iso||""));if(!m)throw new Error("Ongeldige fixturetijd: "+iso);return new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])+uren*3600000).toISOString().slice(0,16);}
function maakForecast(){
  const d=bouw({temp:u=>17+3*Math.sin(u/24*Math.PI*2),pp:u=>u%9<4?75:15,pr:u=>u%9<4?0.4:0,som:5.1}),h=d.hourly;
  h.rain=h.precipitation.slice();h.showers=Array(h.time.length).fill(0);h.snowfall=Array(h.time.length).fill(0);
  d.current.rain=d.current.precipitation;d.current.showers=0;d.current.snowfall=0;d.current.visibility=20000;d.daily.sunshine_duration=d.daily.time.map(()=>6*3600);
  const velden=Object.keys(h).filter(k=>Array.isArray(h[k]));
  while(h.time.length<194){const bron=24+(h.time.length%24),laatste=h.time[h.time.length-1];for(const veld of velden){if(veld==="time")continue;const reeks=h[veld];reeks.push(reeks[bron%reeks.length]);}h.time.push(isoPlus(laatste,1));}
  h.time=h.time.slice(0,194);for(const veld of velden)if(veld!=="time")h[veld]=h[veld].slice(0,194);
  d.minutely_15={time:["2026-07-22T13:00","2026-07-22T13:15","2026-07-22T13:30","2026-07-22T13:45","2026-07-22T14:00","2026-07-22T14:15","2026-07-22T14:30","2026-07-22T14:45"],precipitation:[0,0,0,.1,.2,.2,.1,0],rain:[0,0,0,.1,.2,.2,.1,0],showers:[0,0,0,0,0,0,0,0],snowfall:[0,0,0,0,0,0,0,0],weather_code:[3,3,3,51,51,51,51,3]};
  return d;
}
const forecast=maakForecast();
const air={current:{european_aqi:22,us_aqi:37},hourly:{time:[forecast.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[2],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};

function htmlVoor(publicDir){
  let html=fs.readFileSync(path.join(publicDir,"index.html"),"utf8");
  const stub=`<script>(function(){const FORECAST=${JSON.stringify(forecast)},AIR=${JSON.stringify(air)};const clone=x=>JSON.parse(JSON.stringify(x));const goed=x=>({ok:true,status:200,json:async()=>clone(x),text:async()=>JSON.stringify(x)});window.__perf={start:performance.now(),forecastUrls:[]};window.fetch=async function(url){const u=String(url);if(u.includes('api.open-meteo.com/v1/forecast')){window.__perf.forecastUrls.push(u);return goed(FORECAST);}if(u.includes('air-quality-api.open-meteo.com'))return goed(AIR);if(u.includes('/api/waarschuwingen'))return goed({bron:'test',dekking:true,land:'NL',lijst:[]});return goed({});};Date.now=()=>Date.UTC(2026,6,22,12,0,0);})();</script>`;
  return html.replace("</head>",stub+"</head>");
}
function serverVoor(publicDir){
  const html=htmlVoor(publicDir);
  const srv=http.createServer((req,res)=>{const pathname=(req.url||"").split("?")[0];if(pathname==="/"||pathname==="/index.html"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;}const rel=pathname.startsWith("/")?pathname.slice(1):pathname,file=path.join(publicDir,rel);if(file.startsWith(publicDir+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){const ext=path.extname(file).toLowerCase(),types={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};res.writeHead(200,{"content-type":types[ext]||"application/octet-stream"});fs.createReadStream(file).pipe(res);}else{res.writeHead(404);res.end("not found");}});
  return new Promise(resolve=>srv.listen(0,"127.0.0.1",()=>resolve(srv)));
}
const median=a=>{const b=a.slice().sort((x,y)=>x-y);return b[Math.floor(b.length/2)];};
function appSelf(profile,poort,naam){const nodes=new Map(profile.nodes.map(n=>[n.id,n]));let ms=0;const prefix=`http://127.0.0.1:${poort}/`;for(let i=0;i<(profile.samples||[]).length;i++){const n=nodes.get(profile.samples[i]);if(!n)continue;const f=n.callFrame||{};if(f.functionName!==naam||!String(f.url||"").startsWith(prefix))continue;ms+=((profile.timeDeltas&&profile.timeDeltas[i])||0)/1000;}return ms;}

async function runEen(browser,poort,{profile=false,intl=false}={}){
  const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:"block"}),page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
  if(intl)await page.addInitScript(()=>{const o=Intl.DateTimeFormat.prototype.formatToParts,byCaller=new Map(),byKey=new Map();window.__intlAB={calls:0,byCaller,byKey};Intl.DateTimeFormat.prototype.formatToParts=function(v){window.__intlAB.calls++;let epoch="anders";if(v instanceof Date&&Number.isFinite(v.getTime()))epoch=String(v.getTime());let zone="?";try{zone=this.resolvedOptions().timeZone||"?";}catch(_){}const key=zone+"|"+epoch;byKey.set(key,(byKey.get(key)||0)+1);let caller="(unknown)";try{const regels=String(new Error().stack||"").split("\n").slice(2);for(const r of regels){if(r.includes("formatToParts"))continue;const m=r.match(/at\s+([^\s(]+)/);if(m){caller=m[1];break;}}}catch(_){}byCaller.set(caller,(byCaller.get(caller)||0)+1);return o.call(this,v);};});
  let cdp,profiel;
  try{
    if(profile){cdp=await context.newCDPSession(page);await cdp.send("Profiler.enable");await cdp.send("Profiler.setSamplingInterval",{interval:500});await cdp.send("Profiler.start");}
    await page.goto(`http://127.0.0.1:${poort}/?lat=52.35&lon=5.26&plaats=Performance&land=NL`,{waitUntil:"domcontentloaded"});
    await page.waitForSelector("#app",{state:"visible",timeout:5000});
    const resultaat=await page.evaluate(({intl})=>{const r={elapsed:performance.now()-window.__perf.start,urls:window.__perf.forecastUrls.length,dagen:document.querySelectorAll("#days .row.day:not(.kop)").length,nachten:document.querySelectorAll("#nights .row.night:not(.kop)").length};if(intl){r.intlCalls=window.__intlAB.calls;r.intlUniqueKeys=window.__intlAB.byKey.size;r.byCaller=Object.fromEntries([...window.__intlAB.byCaller.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20));r.topKeys=[...window.__intlAB.byKey.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);}return r;},{intl});
    if(profile){({profile:profiel}=await cdp.send("Profiler.stop"));}
    assert.equal(resultaat.urls,1,"exact één hoofdforecastaanvraag");assert.equal(resultaat.dagen,7,"zeven dagen");assert(resultaat.nachten>=1,"Nachtzicht");assert.deepEqual(fouten,[],"geen runtime-/consolefouten");
    if(profile)assert((profiel.samples||[]).length>0,"CPU-profiler samples");
    return {elapsed:resultaat.elapsed,zoneDelen:profile?appSelf(profiel,poort,"zoneDelen"):null,intl:intl?resultaat:null};
  }finally{if(cdp)try{await cdp.send("Profiler.disable");}catch(_){}await context.close();}
}

(async()=>{
  const baseServer=await serverVoor(path.resolve(baseDir)),candServer=await serverVoor(path.resolve(candidateDir));
  const bp=baseServer.address().port,cp=candServer.address().port,browser=await chromium.launch({headless:true,channel:"chrome"});
  try{
    const cold={base:[],candidate:[],pairedImprovement:[]};
    for(let i=0;i<RONDEN;i++){
      const order=i%2===0?[["base",bp],["candidate",cp]]:[["candidate",cp],["base",bp]],paar={};
      for(const [naam,poort] of order)paar[naam]=await runEen(browser,poort);
      cold.base.push(paar.base.elapsed);cold.candidate.push(paar.candidate.elapsed);cold.pairedImprovement.push(paar.base.elapsed-paar.candidate.elapsed);
      console.log(`Cold pair ${i+1}: base ${paar.base.elapsed.toFixed(1)} ms; candidate ${paar.candidate.elapsed.toFixed(1)} ms; winst ${(paar.base.elapsed-paar.candidate.elapsed).toFixed(1)} ms.`);
    }
    const cpu={base:[],candidate:[],pairedImprovement:[]};
    for(let i=0;i<RONDEN;i++){
      const order=i%2===0?[["candidate",cp],["base",bp]]:[["base",bp],["candidate",cp]],paar={};
      for(const [naam,poort] of order)paar[naam]=await runEen(browser,poort,{profile:true});
      cpu.base.push(paar.base.zoneDelen);cpu.candidate.push(paar.candidate.zoneDelen);cpu.pairedImprovement.push(paar.base.zoneDelen-paar.candidate.zoneDelen);
      console.log(`CPU pair ${i+1}: zoneDelen base ${paar.base.zoneDelen.toFixed(1)} ms; candidate ${paar.candidate.zoneDelen.toFixed(1)} ms; winst ${(paar.base.zoneDelen-paar.candidate.zoneDelen).toFixed(1)} ms.`);
    }
    const intlBase=await runEen(browser,bp,{intl:true}),intlCandidate=await runEen(browser,cp,{intl:true});
    const rapport={
      cold:{base:cold.base,candidate:cold.candidate,baseMedian:median(cold.base),candidateMedian:median(cold.candidate),pairedImprovement:cold.pairedImprovement,pairedImprovementMedian:median(cold.pairedImprovement)},
      cpuZoneDelen:{base:cpu.base,candidate:cpu.candidate,baseMedian:median(cpu.base),candidateMedian:median(cpu.candidate),pairedImprovement:cpu.pairedImprovement,pairedImprovementMedian:median(cpu.pairedImprovement)},
      intl:{base:intlBase.intl,candidate:intlCandidate.intl}
    };
    rapport.cold.absoluteImprovement=rapport.cold.baseMedian-rapport.cold.candidateMedian;rapport.cold.percentImprovement=rapport.cold.absoluteImprovement/rapport.cold.baseMedian*100;
    rapport.cpuZoneDelen.absoluteImprovement=rapport.cpuZoneDelen.baseMedian-rapport.cpuZoneDelen.candidateMedian;rapport.cpuZoneDelen.percentImprovement=rapport.cpuZoneDelen.absoluteImprovement/rapport.cpuZoneDelen.baseMedian*100;
    fs.writeFileSync("performance-paired-ab-results.json",JSON.stringify(rapport,null,2));
    console.log(`Paired cold-load: base mediaan ${rapport.cold.baseMedian.toFixed(1)} ms; candidate ${rapport.cold.candidateMedian.toFixed(1)} ms; ${rapport.cold.percentImprovement.toFixed(1)}% verschil; mediane paired winst ${rapport.cold.pairedImprovementMedian.toFixed(1)} ms.`);
    console.log(`Paired zoneDelen CPU: base mediaan ${rapport.cpuZoneDelen.baseMedian.toFixed(1)} ms; candidate ${rapport.cpuZoneDelen.candidateMedian.toFixed(1)} ms; ${rapport.cpuZoneDelen.percentImprovement.toFixed(1)}% verschil; mediane paired winst ${rapport.cpuZoneDelen.pairedImprovementMedian.toFixed(1)} ms.`);
    console.log(`Intl count-only: base ${intlBase.intl.intlCalls} calls/${intlBase.intl.intlUniqueKeys} unieke zone+epoch keys; candidate ${intlCandidate.intl.intlCalls}/${intlCandidate.intl.intlUniqueKeys}.`);
  }finally{await browser.close();baseServer.close();candServer.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
