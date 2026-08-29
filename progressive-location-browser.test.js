"use strict";

/* Echte Chromium-controle van drie afzonderlijke laadpaden:
   1. een trage eerste cold load houdt main#app geometrisch gereserveerd en start
      geen current-only preview;
   2. een latere bewuste locatiewissel vanaf bestaande volledige data behoudt de
      snelle current-only preview en laat daarna de canonieke forecast overnemen;
   3. een snelle eerste forecast verstuurt geen overbodige previewrequest. */
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
  if(process.env.CI){console.error("FOUT progressieve locatielading: Chrome/Chromium ontbreekt op CI.");process.exit(1);}
  console.log("SKIP progressieve locatielading: lokaal geen Chrome/Chromium gevonden.");process.exit(0);
}

const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt voor progressieve browsertest.");
const basisHtml=fs.readFileSync(productie,"utf8");
function maakVolledig(temp,lat,lon){
  const d=bouw({tempNu:temp,wcNu:3,ccNu:65});
  d.current.interval=900;
  d.current.visibility=16000;
  d.elevation=3;d.latitude=lat;d.longitude=lon;
  d.daily.sunshine_duration=d.daily.time.map(()=>6.5*3600);
  return d;
}
const volledig=maakVolledig(18,52.3676,4.9041);
const doelVolledig=maakVolledig(12,40.7128,-74.0060);
const snel={timezone:"America/New_York",current:{temperature_2m:27.4,apparent_temperature:28.2,is_day:1,weather_code:1}};
const air={current:{european_aqi:22,us_aqi:45},hourly:{time:[volledig.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[4],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const testNow=Date.parse(volledig.current.time+"Z")-(Number(volledig.utc_offset_seconds)||0)*1000+30*60000;

function antwoord(payload,ok,status){
  return `{ok:${ok!==false},status:${status||200},json:async()=>(${JSON.stringify(payload)}),text:async()=>JSON.stringify(${JSON.stringify(payload)})}`;
}

function fixture(mode){
  let html=basisHtml;
  const stub=`<script>
try{localStorage.clear();sessionStorage.clear();}catch(e){}
Date.now=()=>${testNow};
window.__progressiveMode=${JSON.stringify(mode)};
window.__progressiveFetch={preview:0,full:0};
window.fetch=function(url){
  const u=String(url);
  if(u.includes('/api/waarschuwingen'))return Promise.resolve(${antwoord({bron:"test",dekking:true,lijst:[]})});
  if(u.includes('air-quality-api.open-meteo.com'))return Promise.resolve(${antwoord(air)});
  if(u.includes('/api/plaatsnaam'))return Promise.resolve(${antwoord({naam:"Testplaats",bron:"test"})});
  if(u.includes('api.open-meteo.com/v1/forecast')){
    const preview=u.includes('&current=temperature_2m,apparent_temperature,is_day,weather_code&timezone=auto');
    if(preview){
      window.__progressiveFetch.preview++;
      return new Promise(resolve=>setTimeout(()=>resolve(${antwoord(snel)}),40));
    }
    window.__progressiveFetch.full++;
    const nummer=window.__progressiveFetch.full;
    const isSwitch=window.__progressiveMode==='switch'&&nummer>=2;
    const payload=isSwitch?${JSON.stringify(doelVolledig)}:${JSON.stringify(volledig)};
    const vertraging=window.__progressiveMode==='cold-slow'?900:(isSwitch?900:40);
    return new Promise(resolve=>setTimeout(()=>resolve({ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)}),vertraging));
  }
  return Promise.resolve(${antwoord({})});
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
  html=html.replace("</head>",stub+"</head>");

  const reporter=`<script>
(function(){
  const zet=(k,v)=>document.body.setAttribute('data-'+k,String(v));
  const temp=()=>((document.getElementById('t')||{}).textContent||'').trim();
  const dagen=()=>document.querySelectorAll('#days .row.day:not(.kop)').length;

  if(window.__progressiveMode==='cold-slow'){
    setTimeout(()=>{
      try{
        const app=document.getElementById('app');
        const stijl=app&&getComputedStyle(app);
        const ok=!!(app&&stijl)
          &&!document.documentElement.classList.contains('wn-progressief')
          &&!app.classList.contains('wn-progressief')&&!app.hasAttribute('aria-busy')
          &&stijl.display!=='none'&&stijl.visibility==='hidden'
          &&window.__progressiveFetch.preview===0&&window.__progressiveFetch.full===1
          &&(typeof S==='undefined'||!S.d);
        zet('cold-pending',ok?'ok':'fout');
        zet('cold-display',stijl&&stijl.display);
        zet('cold-visibility',stijl&&stijl.visibility);
        zet('cold-preview-count',window.__progressiveFetch.preview);
        zet('cold-full-count',window.__progressiveFetch.full);
      }catch(e){zet('cold-pending','exception');zet('cold-exception',e&&e.message||e);}
    },360);
    setTimeout(()=>{
      try{
        const app=document.getElementById('app'),state=document.getElementById('state'),stijl=app&&getComputedStyle(app);
        const ok=!!(app&&stijl)&&stijl.display!=='none'&&stijl.visibility==='visible'
          &&!document.documentElement.classList.contains('wn-progressief')&&!app.classList.contains('wn-progressief')&&!app.hasAttribute('aria-busy')
          &&temp()==='18'&&typeof S!=='undefined'&&S.d&&Math.round(Number(S.d.current&&S.d.current.temperature_2m))===18
          &&window.__progressiveFetch.preview===0&&window.__progressiveFetch.full===1
          &&dagen()>=7&&state&&getComputedStyle(state).display==='none';
        zet('cold-full',ok?'ok':'fout');
        zet('cold-full-temp',temp());zet('cold-full-days',dagen());zet('cold-full-visibility',stijl&&stijl.visibility);
      }catch(e){zet('cold-full','exception');zet('cold-full-exception',e&&e.message||e);}
    },1350);
    return;
  }

  if(window.__progressiveMode==='switch'){
    setTimeout(()=>{
      try{
        const initOk=temp()==='18'&&typeof S!=='undefined'&&S.d&&window.__progressiveFetch.full===1&&window.__progressiveFetch.preview===0;
        zet('switch-initial',initOk?'ok':'fout');
        if(typeof load!=='function')throw new Error('load ontbreekt');
        load(40.7128,-74.0060,'New York',false,false,'US');
      }catch(e){zet('switch-initial','exception');zet('switch-initial-exception',e&&e.message||e);}
    },220);
    setTimeout(()=>{
      try{
        const app=document.getElementById('app'),state=document.getElementById('state'),details=document.querySelector('.dashrow-chart');
        const ok=document.documentElement.classList.contains('wn-progressief')
          &&app&&app.classList.contains('wn-progressief')&&app.getAttribute('aria-busy')==='true'
          &&temp()==='27'&&/Verwachting wordt aangevuld/.test((state||{}).textContent||'')
          &&typeof S!=='undefined'&&S.d&&Math.round(Number(S.d.current&&S.d.current.temperature_2m))===18
          &&window.__progressiveFetch.preview===1&&window.__progressiveFetch.full===2
          &&(!details||getComputedStyle(details).display==='none');
        zet('switch-preview',ok?'ok':'fout');
        zet('switch-preview-temp',temp());zet('switch-preview-count',window.__progressiveFetch.preview);zet('switch-full-count',window.__progressiveFetch.full);
      }catch(e){zet('switch-preview','exception');zet('switch-preview-exception',e&&e.message||e);}
    },560);
    setTimeout(()=>{
      try{
        const app=document.getElementById('app'),state=document.getElementById('state'),stijl=app&&getComputedStyle(app);
        const ok=!!(app&&stijl)&&!document.documentElement.classList.contains('wn-progressief')&&!app.classList.contains('wn-progressief')&&!app.hasAttribute('aria-busy')
          &&stijl.display!=='none'&&stijl.visibility==='visible'
          &&temp()==='12'&&typeof S!=='undefined'&&S.d&&Math.round(Number(S.d.current&&S.d.current.temperature_2m))===12
          &&window.__progressiveFetch.preview===1&&window.__progressiveFetch.full===2
          &&dagen()>=7&&state&&getComputedStyle(state).display==='none';
        zet('switch-full',ok?'ok':'fout');
        zet('switch-full-temp',temp());zet('switch-full-days',dagen());
      }catch(e){zet('switch-full','exception');zet('switch-full-exception',e&&e.message||e);}
    },1450);
    return;
  }

  setTimeout(()=>{
    try{
      const app=document.getElementById('app'),stijl=app&&getComputedStyle(app);
      const ok=!!(app&&stijl)&&!document.documentElement.classList.contains('wn-progressief')&&!app.classList.contains('wn-progressief')&&!app.hasAttribute('aria-busy')
        &&stijl.display!=='none'&&stijl.visibility==='visible'&&temp()==='18'
        &&window.__progressiveFetch.preview===0&&window.__progressiveFetch.full===1
        &&typeof S!=='undefined'&&S.d&&Math.round(Number(S.d.current&&S.d.current.temperature_2m))===18;
      zet('fast',ok?'ok':'fout');
      zet('fast-temp',temp());zet('fast-preview-count',window.__progressiveFetch.preview);zet('fast-full-count',window.__progressiveFetch.full);
    }catch(e){zet('fast','exception');zet('fast-exception',e&&e.message||e);}
  },420);
})();
</script>`;
  return html.replace("</body>",reporter+"</body>");
}

function draai(mode,budget){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-progressive-"));
  try{
    const pad=path.join(dir,"index.html");fs.writeFileSync(pad,fixture(mode));
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=1440,1000","--virtual-time-budget="+budget,"--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:24*1024*1024});
    if(r.status!==0)throw new Error("browser exit "+r.status+" "+(r.stderr||"").slice(-1200));
    return r.stdout||"";
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
function waarde(dom,veld){const m=new RegExp('data-'+veld+'="([^"]*)"').exec(dom);return m&&m[1];}

const cold=draai("cold-slow",2200);
if(waarde(cold,"cold-pending")!=="ok"||waarde(cold,"cold-full")!=="ok"){
  throw new Error("cold-load fout: pending="+waarde(cold,"cold-pending")+", display="+waarde(cold,"cold-display")+", visibility="+waarde(cold,"cold-visibility")+", preview="+waarde(cold,"cold-preview-count")+", fullCount="+waarde(cold,"cold-full-count")+", full="+waarde(cold,"cold-full")+", temp="+waarde(cold,"cold-full-temp")+", dagen="+waarde(cold,"cold-full-days")+", fullVisibility="+waarde(cold,"cold-full-visibility")+", ex="+waarde(cold,"cold-exception")+", fullEx="+waarde(cold,"cold-full-exception"));
}

const wissel=draai("switch",2400);
if(waarde(wissel,"switch-initial")!=="ok"||waarde(wissel,"switch-preview")!=="ok"||waarde(wissel,"switch-full")!=="ok"){
  throw new Error("locatiewissel fout: initial="+waarde(wissel,"switch-initial")+", preview="+waarde(wissel,"switch-preview")+", pTemp="+waarde(wissel,"switch-preview-temp")+", pCount="+waarde(wissel,"switch-preview-count")+", fullCount="+waarde(wissel,"switch-full-count")+", full="+waarde(wissel,"switch-full")+", fTemp="+waarde(wissel,"switch-full-temp")+", dagen="+waarde(wissel,"switch-full-days")+", iEx="+waarde(wissel,"switch-initial-exception")+", pEx="+waarde(wissel,"switch-preview-exception")+", fEx="+waarde(wissel,"switch-full-exception"));
}

const fast=draai("fast",1000);
if(waarde(fast,"fast")!=="ok"){
  throw new Error("fast pad fout: resultaat="+waarde(fast,"fast")+", temp="+waarde(fast,"fast-temp")+", preview="+waarde(fast,"fast-preview-count")+", full="+waarde(fast,"fast-full-count")+", exception="+waarde(fast,"fast-exception"));
}

console.log("Progressieve locatielading browser: cold load blijft geometrisch gereserveerd zonder preview; latere locatiewissel behoudt preview; snelle forecast verstuurt geen extra previewrequest.");
