"use strict";

/* Foutpaden voor de locatiewisselstatus.
   Zonder persistente cache én met een legacy-cache van de vorige locatie blijft
   de al zichtbare forecast en locatie-identiteit volledig intact. Een cache van
   Amsterdam mag bij een mislukte New York-aanvraag nooit als New York-fallback
   worden gebruikt. In beide gevallen verschijnt een compacte foutstatus met
   retry en wordt nooit een current-only preview opgevraagd. */
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
  if(process.env.CI){console.error("FOUT progressive fallback: Chrome/Chromium ontbreekt op CI.");process.exit(1);}
  console.log("SKIP progressive fallback: lokaal geen Chrome/Chromium gevonden.");process.exit(0);
}

const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt voor progressive-fallbacktest.");
const basisHtml=fs.readFileSync(productie,"utf8");
const oud=bouw({tempNu:18,wcNu:3,ccNu:65});
oud.current.interval=900;oud.current.visibility=16000;oud.elevation=3;
oud.latitude=52.3676;oud.longitude=4.9041;
oud.daily.sunshine_duration=oud.daily.time.map(()=>6.5*3600);
const snel={timezone:"America/New_York",current:{temperature_2m:27.4,apparent_temperature:28.2,is_day:1,weather_code:1}};
const air={current:{european_aqi:22,us_aqi:45},hourly:{time:[oud.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const testNow=Date.parse(oud.current.time+"Z")-(Number(oud.utc_offset_seconds)||0)*1000+30*60000;

function antwoord(payload,ok,status){
  return `{ok:${ok!==false},status:${status||200},json:async()=>(${JSON.stringify(payload)}),text:async()=>JSON.stringify(${JSON.stringify(payload)})}`;
}

function fixture(cacheBehouden){
  let html=basisHtml;
  const stub=`<script>
try{localStorage.clear();sessionStorage.clear();}catch(e){}
Date.now=()=>${testNow};
window.__fallbackFetch={preview:0,oldFull:0,newFull:0};
window.__fallbackWarnings=[];
window.fetch=function(url){
  const u=String(url);
  if(u.includes('/api/waarschuwingen')){window.__fallbackWarnings.push(u);return Promise.resolve(${antwoord({bron:"test",dekking:true,lijst:[]})});}
  if(u.includes('air-quality-api.open-meteo.com'))return Promise.resolve(${antwoord(air)});
  if(u.includes('/api/plaatsnaam'))return Promise.resolve(${antwoord({naam:"Amsterdam",bron:"test"})});
  if(u.includes('api.open-meteo.com/v1/forecast')){
    const nieuw=/latitude=40(?:\\.7128)?(?:&|%26)/.test(u)||u.includes('latitude=40.7128');
    const preview=u.includes('current=temperature_2m,apparent_temperature,is_day,weather_code')&&!u.includes('daily=');
    if(nieuw&&preview){window.__fallbackFetch.preview++;return Promise.resolve(${antwoord(snel)});}
    if(nieuw){window.__fallbackFetch.newFull++;return new Promise(resolve=>setTimeout(()=>resolve(${antwoord({reason:"test outage"},false,503)}),260));}
    window.__fallbackFetch.oldFull++;return new Promise(resolve=>setTimeout(()=>resolve(${antwoord(oud)}),35));
  }
  return Promise.resolve(${antwoord({})});
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
  html=html.replace("</head>",stub+"</head>");

  const reporter=`<script>
(function(){
  const zet=(k,v)=>document.body.setAttribute('data-'+k,String(v));
  const plaats=()=>{const p=document.getElementById('place');return p&&p.childNodes&&p.childNodes[0]?String(p.childNodes[0].textContent||'').trim():'';};
  const status=()=>document.getElementById('locatie-laadstatus');
  const statusTekst=()=>((status()||{}).textContent||'').replace(/\\s+/g,' ').trim();
  setTimeout(()=>{
    try{
      const initOk=typeof S!=='undefined'&&S.d&&Math.round(Number(S.d.current&&S.d.current.temperature_2m))===18;
      zet('initial',initOk?'ok':'fout');
      window.__oudeLocatie={lat:S.lat,lon:S.lon,label:S.label,land:S.land,place:plaats()};
      if(${cacheBehouden}){
        const legacy=JSON.parse(localStorage.getItem('weerbriefing.data')||'null');
        if(legacy){delete legacy.land;localStorage.setItem('weerbriefing.data',JSON.stringify(legacy));}
      }else{
        try{localStorage.clear();}catch(e){}
      }
      load(40.7128,-74.0060,'New York',false,true,'US');
    }catch(e){zet('switch-exception',e&&e.message||e);}
  },420);
  setTimeout(()=>{
    try{
      const app=document.getElementById('app'),state=document.getElementById('state'),s=status(),retry=s&&s.querySelector('.locatie-status-retry');
      const zichtbaar=!!(app&&getComputedStyle(app).display!=='none');
      const stateTekst=(state&&state.textContent||'').trim();
      const sTemp=typeof S!=='undefined'&&S.d&&S.d.current?Math.round(Number(S.d.current.temperature_2m)):null;
      const warnings=window.__fallbackWarnings||[],laatsteWarning=warnings.length?warnings[warnings.length-1]:'';
      const foutUi=!!(s&&s.hidden===false&&s.classList.contains('fout')&&/New York niet geladen/.test(statusTekst())&&retry&&!retry.hidden
        &&app&&!app.hasAttribute('aria-busy')&&!(document.getElementById('q')||{}).hasAttribute('aria-busy')
        &&window.__fallbackFetch.preview===0);
      zet('visible',zichtbaar);zet('state',stateTekst);zet('place',plaats());zet('stemp',sTemp);
      zet('label',typeof S!=='undefined'?S.label:'');zet('lat',typeof S!=='undefined'?S.lat:'');zet('lon',typeof S!=='undefined'?S.lon:'');
      zet('land',typeof S!=='undefined'&&S.land!=null?S.land:'null');zet('status',statusTekst());
      zet('warning-last',laatsteWarning);zet('preview-count',window.__fallbackFetch.preview);zet('new-full-count',window.__fallbackFetch.newFull);
      if(${cacheBehouden}){
        let warningBijVorige=false,geenStaleLand=false;
        try{
          const warningUrl=new URL(laatsteWarning,'https://watishetweer.test');
          const lat=Number(warningUrl.searchParams.get('lat')),lon=Number(warningUrl.searchParams.get('lon'));
          warningBijVorige=Math.abs(lat-52.368)<0.0015&&Math.abs(lon-4.904)<0.0015;
          geenStaleLand=warningUrl.searchParams.get('land')!=='US'&&typeof S!=='undefined'&&S.land==null;
        }catch(_){ }
        const o=window.__oudeLocatie||{};
        /* Persistente locatiecoördinaten worden bewust op drie decimalen opgeslagen.
           Een veilige fallback mag daarom maximaal de opslagafronding afwijken van
           de vóór de wissel zichtbare locatie, maar nooit naar de doelcoördinaten springen. */
        const zelfdeCoords=Math.abs(Number(S.lat)-Number(o.lat))<0.001&&Math.abs(Number(S.lon)-Number(o.lon))<0.001;
        const compacteFout=/New York niet geladen/.test(statusTekst())&&/Amsterdam/.test(statusTekst());
        const stateVerborgen=!!(state&&getComputedStyle(state).display==='none');
        const veilig=foutUi&&compacteFout&&zichtbaar&&stateVerborgen&&zelfdeCoords
          &&typeof S!=='undefined'&&S.label==='Amsterdam'&&sTemp===18&&plaats()==='Amsterdam'&&warningBijVorige&&geenStaleLand;
        zet('result',veilig?'ok':'fout');
      }else{
        const o=window.__oudeLocatie||{};
        const zelfdeCoords=Math.abs(Number(S.lat)-Number(o.lat))<1e-9&&Math.abs(Number(S.lon)-Number(o.lon))<1e-9;
        const veilig=foutUi&&zichtbaar&&typeof S!=='undefined'&&S.label===o.label&&sTemp===18&&plaats()===o.place&&zelfdeCoords
          &&state&&getComputedStyle(state).display==='none';
        zet('result',veilig?'ok':'fout');
      }
    }catch(e){zet('result','exception');zet('exception',e&&e.message||e);}
  },1500);
})();
</script>`;
  return html.replace("</body>",reporter+"</body>");
}

function draai(cacheBehouden){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-progressive-fallback-"));
  try{
    const pad=path.join(dir,"index.html");fs.writeFileSync(pad,fixture(cacheBehouden));
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=1200,900","--virtual-time-budget=2400","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:20*1024*1024});
    if(r.status!==0)throw new Error("browser exit "+r.status+" "+(r.stderr||"").slice(-1200));
    return r.stdout||"";
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
function waarde(dom,veld){const m=new RegExp('data-'+veld+'="([^"]*)"').exec(dom);return m&&m[1];}
function eis(dom,label){
  if(waarde(dom,"initial")!=="ok"||waarde(dom,"result")!=="ok"){
    throw new Error(label+" fout: initial="+waarde(dom,"initial")+", result="+waarde(dom,"result")+", visible="+waarde(dom,"visible")+", state="+waarde(dom,"state")+", place="+waarde(dom,"place")+", label="+waarde(dom,"label")+", lat="+waarde(dom,"lat")+", lon="+waarde(dom,"lon")+", sTemp="+waarde(dom,"stemp")+", land="+waarde(dom,"land")+", status="+waarde(dom,"status")+", warning="+waarde(dom,"warning-last")+", preview="+waarde(dom,"preview-count")+", full="+waarde(dom,"new-full-count")+", switchEx="+waarde(dom,"switch-exception")+", ex="+waarde(dom,"exception"));
  }
}

eis(draai(false),"zonder cache");
eis(draai(true),"met legacy-cache zonder land");
console.log("Progressive fallback browser: vorige forecast blijft bij fout intact, mismatched legacy-cache wordt niet als doellocatie gebruikt, compacte retry-status zichtbaar en geen previewrequest.");
