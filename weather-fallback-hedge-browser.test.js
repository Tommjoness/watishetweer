"use strict";

const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
const {bouw}=require("./data.js");

function vindBrowser(){
  for(const naam of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    const r=spawnSync("sh",["-lc","command -v "+naam],{encoding:"utf8"});
    if(r.status===0&&r.stdout.trim())return r.stdout.trim();
  }
  return null;
}
const browser=vindBrowser();
if(!browser){
  if(process.env.CI){console.error("FOUT weather fallback hedge: Chrome/Chromium ontbreekt op CI.");process.exit(1);}
  console.log("SKIP weather fallback hedge: lokaal geen Chrome/Chromium gevonden.");process.exit(0);
}

const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt voor weather-fallback-hedge-browsertest.");
const basisHtml=fs.readFileSync(productie,"utf8");

function dataset(temp){
  const d=bouw({tempNu:temp,wcNu:1,ccNu:20});
  d.current.interval=900;d.current.visibility=18000;d.elevation=2;
  d.latitude=52.3702;d.longitude=4.8952;
  d.daily.sunshine_duration=d.daily.time.map(()=>7*3600);
  return d;
}
const volledig=dataset(11),fallback=dataset(22),nieuw=dataset(33);
const preview={timezone:"Europe/Amsterdam",current:{temperature_2m:12,apparent_temperature:12,is_day:1,weather_code:1}};
const air={current:{european_aqi:18,us_aqi:35},hourly:{time:[volledig.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};

function antwoord(payload,ok=true,status=200){
  return `{ok:${ok},status:${status},json:async()=>(${JSON.stringify(payload)}),text:async()=>JSON.stringify(${JSON.stringify(payload)})}`;
}

const gevallen=[
  {naam:"snelle full start geen fallback",fullMode:"ok",fullMs:120,fallbackMode:"ok",fallbackMs:120,reportMs:5700,budget:7000,verwacht:{temp:11,fallback:0}},
  {naam:"directe fullfout start fallback direct",fullMode:"http",fullMs:50,fallbackMode:"ok",fallbackMs:150,reportMs:1400,budget:2600,verwacht:{temp:22,fallback:1,maxFallbackStart:1000}},
  {naam:"trage full krijgt hedge en fallback wint",fullMode:"hang",fullMs:0,fallbackMode:"ok",fallbackMs:180,reportMs:6200,budget:7500,verwacht:{temp:22,fallback:1,minFallbackStart:4800,maxFallbackStart:5300}},
  {naam:"trage full mag na hedge alsnog winnen",fullMode:"ok",fullMs:6000,fallbackMode:"ok",fallbackMs:4000,reportMs:6900,budget:8000,verwacht:{temp:11,fallback:1,minFallbackStart:4800,maxFallbackStart:5300}},
  {naam:"dubbele hang eindigt voor oude twintigsecondenketen",fullMode:"hang",fullMs:0,fallbackMode:"hang",fallbackMs:0,reportMs:15800,budget:17000,verwacht:{error:"Het ophalen duurt te lang. Controleer je verbinding en probeer het opnieuw.",fallback:1,minFallbackStart:4800,maxFallbackStart:5300}},
  {naam:"stale load start geen oude fallback",stale:true,fullMode:"hang",fullMs:0,fallbackMode:"ok",fallbackMs:150,reportMs:6500,budget:7800,verwacht:{temp:33,fallback:0,label:"New York"}}
];

function fixture(geval){
  let html=basisHtml;
  const stub=`<script>
try{localStorage.clear();sessionStorage.clear();}catch(e){}
window.__hedge={full:0,fallback:0,fallbackStart:-1,oldFallback:0,newFallback:0,start:0};
window.__hedge.start=performance.now();
const __full=${JSON.stringify(volledig)},__fallback=${JSON.stringify(fallback)},__nieuw=${JSON.stringify(nieuw)},__preview=${JSON.stringify(preview)},__air=${JSON.stringify(air)};
function __antwoord(payload,ok=true,status=200){return {ok,status,json:async()=>payload,text:async()=>JSON.stringify(payload)};}
function __later(ms,payload,signal,mode){
  return new Promise((resolve,reject)=>{
    let timer=null,klaar=false;
    const stop=()=>{if(timer!==null){clearTimeout(timer);timer=null;}};
    const abort=()=>{if(klaar)return;klaar=true;stop();reject(new DOMException('Fetch is aborted','AbortError'));};
    if(signal){if(signal.aborted)return abort();signal.addEventListener('abort',abort,{once:true});}
    if(mode==='hang')return;
    timer=setTimeout(()=>{
      if(klaar)return;klaar=true;
      if(signal)signal.removeEventListener('abort',abort);
      if(mode==='http')resolve(__antwoord({reason:'test outage'},false,503));
      else resolve(__antwoord(payload,true,200));
    },ms);
  });
}
window.fetch=function(url,opt){
  const u=String(url),signal=opt&&opt.signal;
  if(u.includes('/api/waarschuwingen'))return Promise.resolve(__antwoord({bron:'test',dekking:true,lijst:[]}));
  if(u.includes('/api/plaatsnaam'))return Promise.resolve(__antwoord({naam:u.includes('40.7128')?'New York':'Amsterdam',land:u.includes('40.7128')?'US':'NL',bron:'test'}));
  if(u.includes('geocoding-api.open-meteo.com'))return Promise.resolve(__antwoord({results:[]}));
  if(u.includes('air-quality-api.open-meteo.com'))return __later(25,__air,signal,'ok');
  if(u.includes('api.open-meteo.com/v1/forecast')){
    const isNew=u.includes('latitude=40.7128');
    const isPreview=u.includes('current=temperature_2m,apparent_temperature,is_day,weather_code')&&!u.includes('daily=');
    const isFull=u.includes('minutely_15=');
    const isFallback=!isPreview&&!isFull&&u.includes('daily=');
    if(isPreview)return __later(20,__preview,signal,'ok');
    if(isNew&&isFull){window.__hedge.full++;return __later(120,__nieuw,signal,'ok');}
    if(isNew&&isFallback){window.__hedge.newFallback++;return __later(120,__nieuw,signal,'ok');}
    if(isFull){window.__hedge.full++;return __later(${Number(geval.fullMs)||0},__full,signal,${JSON.stringify(geval.fullMode||"ok")});}
    if(isFallback){window.__hedge.fallback++;window.__hedge.oldFallback++;if(window.__hedge.fallbackStart<0)window.__hedge.fallbackStart=performance.now()-window.__hedge.start;return __later(${Number(geval.fallbackMs)||0},__fallback,signal,${JSON.stringify(geval.fallbackMode||"ok")});}
  }
  return Promise.resolve(__antwoord({}));
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
  html=html.replace("</head>",stub+"</head>");
  const reporter=`<script>
(function(){
  const zet=(k,v)=>document.body.setAttribute('data-'+k,String(v));
  ${geval.stale?`setTimeout(()=>{try{load(40.7128,-74.0060,'New York',false,true,'US');}catch(e){zet('switch-error',e&&e.message||e);}},1000);`:``}
  setTimeout(()=>{
    try{
      const state=document.getElementById('state'),tekst=(state&&state.textContent||'').trim();
      const temp=typeof S!=='undefined'&&S.d&&S.d.current?Math.round(Number(S.d.current.temperature_2m)):null;
      zet('temp',temp);
      zet('label',typeof S!=='undefined'?S.label:'');
      zet('state',tekst);
      zet('full',window.__hedge.full);
      zet('fallback',window.__hedge.fallback);
      zet('old-fallback',window.__hedge.oldFallback);
      zet('new-fallback',window.__hedge.newFallback);
      zet('fallback-start',Math.round(window.__hedge.fallbackStart));
    }catch(e){zet('report-error',e&&e.message||e);}
  },${geval.reportMs});
})();
</script>`;
  return html.replace("</body>",reporter+"</body>");
}

function draai(geval){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-hedge-"));
  try{
    const pad=path.join(dir,"index.html");fs.writeFileSync(pad,fixture(geval));
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=390,844","--virtual-time-budget="+geval.budget,"--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:30*1024*1024});
    if(r.status!==0)throw new Error(geval.naam+": browser exit "+r.status+" "+(r.stderr||"").slice(-1500));
    return r.stdout||"";
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
function waarde(dom,veld){const m=new RegExp('data-'+veld+'="([^"]*)"').exec(dom);return m?m[1].replace(/&amp;/g,'&'):null;}

for(const geval of gevallen){
  const dom=draai(geval),v=geval.verwacht;
  const info=()=>`temp=${waarde(dom,'temp')} label=${waarde(dom,'label')} state=${waarde(dom,'state')} full=${waarde(dom,'full')} fallback=${waarde(dom,'fallback')} oldFallback=${waarde(dom,'old-fallback')} newFallback=${waarde(dom,'new-fallback')} fallbackStart=${waarde(dom,'fallback-start')} reportError=${waarde(dom,'report-error')} switchError=${waarde(dom,'switch-error')}`;
  if(waarde(dom,'report-error'))throw new Error(geval.naam+": reporter faalde: "+info());
  if(v.temp!=null&&Number(waarde(dom,'temp'))!==v.temp)throw new Error(geval.naam+": verkeerde forecast won: "+info());
  if(v.label&&waarde(dom,'label')!==v.label)throw new Error(geval.naam+": verkeerde locatie-identiteit: "+info());
  if(v.error&&waarde(dom,'state')!==v.error)throw new Error(geval.naam+": verwachte fouttoestand ontbreekt: "+info());
  if(Number(waarde(dom,'fallback'))!==v.fallback)throw new Error(geval.naam+": onverwacht fallbackaantal: "+info());
  const start=Number(waarde(dom,'fallback-start'));
  if(v.minFallbackStart!=null&&!(start>=v.minFallbackStart))throw new Error(geval.naam+": fallback te vroeg gestart: "+info());
  if(v.maxFallbackStart!=null&&!(start<=v.maxFallbackStart))throw new Error(geval.naam+": fallback te laat gestart: "+info());
  if(geval.stale&&Number(waarde(dom,'old-fallback'))!==0)throw new Error(geval.naam+": geannuleerde oude load startte alsnog fallback: "+info());
  if(v.maxFallbackStart!=null&&v.maxFallbackStart<1000&&!(start>=0))throw new Error(geval.naam+": directe fallback werd niet gestart: "+info());
  console.log(geval.naam+": OK — "+info());
}

console.log("Weather fallback hedge browser: snelle loads blijven enkelvoudig, trage full krijgt na 5 s een fallback, eerste succes wint, dubbele hang eindigt vóór 20 s en stale loads starten geen oude fallback.");
