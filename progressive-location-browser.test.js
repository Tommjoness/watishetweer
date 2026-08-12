"use strict";

/* Echte Chromium-controle van het cold-switch-pad. De snelle response en de
   volledige forecast krijgen bewust verschillende temperaturen en vertragingen,
   zodat we kunnen bewijzen dat de current-only preview eerst zichtbaar wordt,
   S.d onaangeraakt blijft en de canonieke forecast daarna volledig overneemt.
   Een tweede scenario bewijst dat bij een snelle volledige forecast helemaal
   geen extra previewrequest wordt verstuurd. */
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
const volledig=bouw({tempNu:18,wcNu:3,ccNu:65});
volledig.current.interval=900;
volledig.current.visibility=16000;
volledig.elevation=3;volledig.latitude=52.3676;volledig.longitude=4.9041;
volledig.daily.sunshine_duration=volledig.daily.time.map(()=>6.5*3600);
const snel={timezone:"Europe/Amsterdam",current:{temperature_2m:27.4,apparent_temperature:28.2,is_day:1,weather_code:1}};
const air={current:{european_aqi:22,us_aqi:45},hourly:{time:[volledig.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[4],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const testNow=Date.parse(volledig.current.time+"Z")-(Number(volledig.utc_offset_seconds)||0)*1000+30*60000;

function antwoord(payload,ok,status){
  return `{ok:${ok!==false},status:${status||200},json:async()=>(${JSON.stringify(payload)}),text:async()=>JSON.stringify(${JSON.stringify(payload)})}`;
}

function fixture(mode,volledigMs){
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
  if(u.includes('/api/plaatsnaam'))return Promise.resolve(${antwoord({naam:"Amsterdam",bron:"test"})});
  if(u.includes('api.open-meteo.com/v1/forecast')){
    const preview=u.includes('&current=temperature_2m,apparent_temperature,is_day,weather_code&timezone=auto');
    if(preview){
      window.__progressiveFetch.preview++;
      return new Promise(resolve=>setTimeout(()=>resolve(${antwoord(snel)}),40));
    }
    window.__progressiveFetch.full++;
    return new Promise(resolve=>setTimeout(()=>resolve(${antwoord(volledig)}),${volledigMs}));
  }
  return Promise.resolve(${antwoord({})});
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
  html=html.replace("</head>",stub+"</head>");

  const reporter=`<script>
(function(){
  const zet=(k,v)=>document.body.dataset[k]=String(v);
  if(window.__progressiveMode==='slow'){
    setTimeout(()=>{
      try{
        const app=document.getElementById('app'),state=document.getElementById('state'),details=document.querySelector('.dashrow-chart');
        const previewOk=document.documentElement.classList.contains('wn-progressief')
          &&app&&app.classList.contains('wn-progressief')&&app.getAttribute('aria-busy')==='true'
          &&((document.getElementById('t')||{}).textContent||'').trim()==='27'
          &&/Verwachting wordt aangevuld/.test((state||{}).textContent||'')
          &&(!window.S||!S.d)
          &&window.__progressiveFetch.preview===1&&window.__progressiveFetch.full===1
          &&(!details||getComputedStyle(details).display==='none');
        zet('progressive-preview',previewOk?'ok':'fout');
        zet('progressive-preview-temp',((document.getElementById('t')||{}).textContent||'').trim());
        zet('progressive-preview-class',document.documentElement.classList.contains('wn-progressief'));
        zet('progressive-preview-count',window.__progressiveFetch.preview);
        zet('progressive-preview-full-count',window.__progressiveFetch.full);
        zet('progressive-preview-state',(state||{}).textContent||'');
        zet('progressive-preview-sd',!!(window.S&&S.d));
      }catch(e){zet('progressive-preview','exception');zet('progressive-preview-exception',e&&e.message||e);}
    },360);
    setTimeout(()=>{
      try{
        const app=document.getElementById('app'),state=document.getElementById('state');
        const dagen=document.querySelectorAll('#days .row.day:not(.kop)').length;
        const fullOk=!document.documentElement.classList.contains('wn-progressief')
          &&app&&!app.classList.contains('wn-progressief')&&!app.hasAttribute('aria-busy')
          &&((document.getElementById('t')||{}).textContent||'').trim()==='18'
          &&window.S&&S.d&&Math.round(Number(S.d.current&&S.d.current.temperature_2m))===18
          &&window.__progressiveFetch.preview===1&&window.__progressiveFetch.full===1
          &&dagen>=7&&state&&getComputedStyle(state).display==='none';
        zet('progressive-full',fullOk?'ok':'fout');
        zet('progressive-full-temp',((document.getElementById('t')||{}).textContent||'').trim());
        zet('progressive-full-class',document.documentElement.classList.contains('wn-progressief'));
        zet('progressive-full-count',window.__progressiveFetch.full);
        zet('progressive-full-preview-count',window.__progressiveFetch.preview);
        zet('progressive-full-days',dagen);
      }catch(e){zet('progressive-full','exception');zet('progressive-full-exception',e&&e.message||e);}
    },1350);
    return;
  }
  setTimeout(()=>{
    try{
      const app=document.getElementById('app');
      const fastOk=!document.documentElement.classList.contains('wn-progressief')
        &&app&&!app.classList.contains('wn-progressief')&&!app.hasAttribute('aria-busy')
        &&((document.getElementById('t')||{}).textContent||'').trim()==='18'
        &&window.__progressiveFetch.preview===0&&window.__progressiveFetch.full===1
        &&window.S&&S.d&&Math.round(Number(S.d.current&&S.d.current.temperature_2m))===18;
      zet('progressive-fast',fastOk?'ok':'fout');
      zet('progressive-fast-temp',((document.getElementById('t')||{}).textContent||'').trim());
      zet('progressive-fast-preview-count',window.__progressiveFetch.preview);
      zet('progressive-fast-full-count',window.__progressiveFetch.full);
    }catch(e){zet('progressive-fast','exception');zet('progressive-fast-exception',e&&e.message||e);}
  },420);
})();
</script>`;
  return html.replace("</body>",reporter+"</body>");
}

function draai(mode,volledigMs,budget){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-progressive-"));
  try{
    const pad=path.join(dir,"index.html");fs.writeFileSync(pad,fixture(mode,volledigMs));
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=1440,1000","--virtual-time-budget="+budget,"--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:20*1024*1024});
    if(r.status!==0)throw new Error("browser exit "+r.status+" "+(r.stderr||"").slice(-1200));
    return r.stdout||"";
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
function waarde(dom,veld){const m=new RegExp('data-'+veld+'="([^"]*)"').exec(dom);return m&&m[1];}

const slow=draai("slow",900,2200);
if(waarde(slow,"progressive-preview")!=="ok"||waarde(slow,"progressive-full")!=="ok"){
  throw new Error("slow pad fout: preview="+waarde(slow,"progressive-preview")+", pTemp="+waarde(slow,"progressive-preview-temp")+", pClass="+waarde(slow,"progressive-preview-class")+", pCount="+waarde(slow,"progressive-preview-count")+", pFull="+waarde(slow,"progressive-preview-full-count")+", pSd="+waarde(slow,"progressive-preview-sd")+", state="+waarde(slow,"progressive-preview-state")+", full="+waarde(slow,"progressive-full")+", fTemp="+waarde(slow,"progressive-full-temp")+", fClass="+waarde(slow,"progressive-full-class")+", fCount="+waarde(slow,"progressive-full-count")+", fPreview="+waarde(slow,"progressive-full-preview-count")+", dagen="+waarde(slow,"progressive-full-days")+", pEx="+waarde(slow,"progressive-preview-exception")+", fEx="+waarde(slow,"progressive-full-exception"));
}

const fast=draai("fast",40,1000);
if(waarde(fast,"progressive-fast")!=="ok"){
  throw new Error("fast pad fout: resultaat="+waarde(fast,"progressive-fast")+", temp="+waarde(fast,"progressive-fast-temp")+", preview="+waarde(fast,"progressive-fast-preview-count")+", full="+waarde(fast,"progressive-fast-full-count")+", exception="+waarde(fast,"progressive-fast-exception"));
}

console.log("Progressieve locatielading browser: trage cold switch toont current-only preview en volledige forecast neemt over; snelle forecast verstuurt geen previewrequest.");
