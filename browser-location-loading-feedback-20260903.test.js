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
  if(process.env.CI){console.error("FOUT location-loading feedback: Chrome/Chromium ontbreekt op CI.");process.exit(1);}
  console.log("SKIP location-loading feedback: lokaal geen Chrome/Chromium gevonden.");process.exit(0);
}

const p=path.join(__dirname,"public","index.html");
if(!fs.existsSync(p))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(p,"utf8");

function volledig(temp,lat,lon,tz){
  const d=bouw({tempNu:temp,wcNu:2,ccNu:55});
  d.current.interval=900;d.current.visibility=18000;d.latitude=lat;d.longitude=lon;d.timezone=tz;
  d.daily.sunshine_duration=d.daily.time.map(()=>7*3600);
  return d;
}
const amsterdam=volledig(18,52.3676,4.9041,"Europe/Amsterdam");
const newyork=volledig(23,40.7128,-74.0060,"America/New_York");
const londen=volledig(16,51.5074,-0.1278,"Europe/London");
const tokio=volledig(29,35.6762,139.6503,"Asia/Tokyo");
const air={current:{european_aqi:20,us_aqi:35},hourly:{time:[amsterdam.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[2],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const testNow=Date.parse(amsterdam.current.time+"Z")-(Number(amsterdam.utc_offset_seconds)||0)*1000+30*60000;
const antwoord=x=>`{ok:true,status:200,json:async()=>(${JSON.stringify(x)}),text:async()=>JSON.stringify(${JSON.stringify(x)})}`;

const stub=`<script>
try{localStorage.clear();sessionStorage.clear();}catch(e){}
Date.now=()=>${testNow};
window.fetch=function(url,opts){
  const u=String(url);
  if(u.includes('geocoding-api.open-meteo.com'))return new Promise(resolve=>setTimeout(()=>resolve(${antwoord({results:[{name:"New York",latitude:40.7128,longitude:-74.006,country_code:"US",admin1:"New York"}]})}),500));
  if(u.includes('/api/waarschuwingen'))return Promise.resolve(${antwoord({bron:"test",dekking:true,lijst:[]})});
  if(u.includes('air-quality-api.open-meteo.com'))return Promise.resolve(${antwoord(air)});
  if(u.includes('/api/plaatsnaam'))return Promise.resolve(${antwoord({naam:"Testplaats",bron:"test"})});
  if(u.includes('api.open-meteo.com/v1/forecast')){
    const lat=Number(new URL(u).searchParams.get('latitude'));
    const preview=u.includes('&current=temperature_2m,apparent_temperature,is_day,weather_code&timezone=auto');
    let payload=${JSON.stringify(amsterdam)},vertraging=40;
    if(Math.abs(lat-40.7128)<.02){payload=${JSON.stringify(newyork)};vertraging=preview?35:900;}
    else if(Math.abs(lat-51.5074)<.02){payload=${JSON.stringify(londen)};vertraging=preview?35:700;}
    else if(Math.abs(lat-35.6762)<.02){payload=${JSON.stringify(tokio)};vertraging=preview?35:1000;}
    return new Promise((resolve,reject)=>{
      const t=setTimeout(()=>resolve({ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)}),vertraging);
      if(opts&&opts.signal)opts.signal.addEventListener('abort',()=>{clearTimeout(t);const e=new Error('aborted');e.name='AbortError';reject(e);},{once:true});
    });
  }
  return Promise.resolve(${antwoord({})});
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const reporter=`<script>
(function(){
  const zet=(k,v)=>document.body.setAttribute('data-'+k,String(v));
  const status=()=>document.getElementById('stamp');
  const q=()=>document.getElementById('q');
  const laadZichtbaar=s=>{
    if(!s||!s.classList.contains('laden'))return false;
    const voor=getComputedStyle(s,'::before'),na=getComputedStyle(s,'::after');
    return /Weer ophalen/.test(na.content||'')
      &&voor.content!==''&&voor.content!=='none'
      &&s.getAttribute('aria-label')==='Weer ophalen…';
  };
  setTimeout(()=>{
    try{
      const veld=q();veld.value='New';veld.dispatchEvent(new Event('input',{bubbles:true}));
    }catch(e){zet('start','exception:'+e.message);}
  },180);
  setTimeout(()=>{
    try{
      const m=document.getElementById('zoekmelding');
      zet('geocoder',m&&m.classList.contains('on')&&/Plaatsen zoeken/.test(m.textContent)?'ok':'fout');
    }catch(e){zet('geocoder','exception:'+e.message);}
  },650);
  setTimeout(()=>{
    try{
      const optie=document.querySelector('#res div[data-lat]');
      if(!optie)throw new Error('zoekoptie ontbreekt');
      optie.click();
    }catch(e){zet('keuze','exception:'+e.message);}
  },1050);
  setTimeout(()=>{
    try{
      const s=status(),veld=q();
      const ok=laadZichtbaar(s)&&veld.getAttribute('aria-busy')==='true';
      zet('forecast',ok?'ok':'fout');
    }catch(e){zet('forecast','exception:'+e.message);}
  },1250);
  setTimeout(()=>{
    try{
      const s=status(),veld=q(),plaats=document.getElementById('place');
      const ok=s&&!s.classList.contains('laden')
        &&s.getAttribute('aria-label')!=='Weer ophalen…'
        &&veld.getAttribute('aria-busy')==='false'
        &&/New York/.test((plaats||{}).textContent||'');
      zet('klaar',ok?'ok':'fout');
      load(51.5074,-0.1278,'Londen',false,true,'GB');
      setTimeout(()=>load(35.6762,139.6503,'Tokio',false,true,'JP'),80);
    }catch(e){zet('klaar','exception:'+e.message);}
  },2150);
  setTimeout(()=>{
    try{
      const s=status(),veld=q();
      const ok=laadZichtbaar(s)&&veld.getAttribute('aria-busy')==='true';
      zet('race-pending',ok?'ok':'fout');
    }catch(e){zet('race-pending','exception:'+e.message);}
  },2500);
  setTimeout(()=>{
    try{
      const s=status(),veld=q(),plaats=document.getElementById('place');
      const ok=s&&!s.classList.contains('laden')
        &&s.getAttribute('aria-label')!=='Weer ophalen…'
        &&veld.getAttribute('aria-busy')==='false'&&/Tokio/.test((plaats||{}).textContent||'');
      zet('race-klaar',ok?'ok':'fout');
    }catch(e){zet('race-klaar','exception:'+e.message);}
  },3450);
})();
</script>`;
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-location-loading-"));
try{
  const bestand=path.join(dir,"index.html");fs.writeFileSync(bestand,html);
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=390,844","--virtual-time-budget=4200","--dump-dom","file://"+bestand],{encoding:"utf8",maxBuffer:28*1024*1024});
  if(r.status!==0)throw new Error("browser exit "+r.status+" "+(r.stderr||"").slice(-1200));
  const dom=r.stdout||"";
  const waarde=k=>{const m=new RegExp('data-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
  for(const k of ["geocoder","forecast","klaar","race-pending","race-klaar"]){
    if(waarde(k)!=="ok")throw new Error(`Location-loading browsercheck ${k}: ${waarde(k)||"ontbreekt"}`);
  }
  console.log("Location-loading browser: Plaatsen zoeken, preview-veilige forecastspinner, aria-busy, cleanup en latest-wins race zijn groen op 390px.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
