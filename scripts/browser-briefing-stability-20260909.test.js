"use strict";

const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
const {bouw}=require("../data.js");

function vindBrowser(){
  for(const naam of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    const r=spawnSync("sh",["-lc","command -v "+naam],{encoding:"utf8"});
    if(r.status===0&&r.stdout.trim())return r.stdout.trim();
  }
  return null;
}
const browser=vindBrowser();
if(!browser){
  console.log("SKIP briefing-stability browser: lokaal geen Chrome/Chromium gevonden.");
  process.exit(0);
}

const p=path.join(__dirname,"..","public","index.html");
if(!fs.existsSync(p))throw new Error("public/index.html ontbreekt voor briefing-stability browsertest.");
let html=fs.readFileSync(p,"utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"");

const cached=bouw({temp:()=>12,tempNu:12,wc:()=>3,wcNu:3,cc:()=>100,ccNu:100,pp:()=>0,pr:()=>0,som:0});
const vers=bouw({temp:()=>31,tempNu:31,wc:()=>0,wcNu:0,cc:()=>0,ccNu:0,pp:()=>0,pr:()=>0,som:0});
for(const d of [cached,vers]){
  d.latitude=51.92;d.longitude=4.48;d.elevation=3;
  d.current.visibility=16000;
  d.daily.sunshine_duration=d.daily.time.map(()=>7*3600);
}
vers.daily.temperature_2m_min=vers.daily.temperature_2m_min.map(()=>29);
vers.daily.temperature_2m_max=vers.daily.temperature_2m_max.map(()=>34);
vers.daily.weather_code=vers.daily.weather_code.map(()=>0);
const air={current:{european_aqi:25,us_aqi:35},hourly:{time:[cached.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};

const headStub=`<script>
try{localStorage.clear();sessionStorage.clear();}catch(e){}
window.__briefNu=Date.UTC(2026,6,22,12,17,0);
Date.now=()=>window.__briefNu;
window.__briefVersie=1;window.__briefDelay=0;
const __briefCached=${JSON.stringify(cached)};
const __briefVers=${JSON.stringify(vers)};
const __briefAir=${JSON.stringify(air)};
const __briefAntwoord=payload=>({ok:true,status:200,headers:{get:()=>null},json:async()=>payload,text:async()=>JSON.stringify(payload)});
window.fetch=async function(url,opt){
  const u=String(url||'');
  if((u.includes('api.open-meteo.com/v1/forecast')||u.includes('/api/forecast'))&&window.__briefDelay){
    await new Promise(r=>setTimeout(r,window.__briefDelay));
  }
  if(u.includes('api.open-meteo.com/v1/forecast')||u.includes('/api/forecast'))return __briefAntwoord(window.__briefVersie===2?__briefVers:__briefCached);
  if(u.includes('air-quality-api.open-meteo.com'))return __briefAntwoord(__briefAir);
  if(u.includes('/api/waarschuwingen'))return __briefAntwoord({bron:'test',dekking:true,lijst:[],land:'NL'});
  if(u.includes('/api/plaatsnaam'))return __briefAntwoord({naam:'Browsertest',land:'NL',bron:'test'});
  if(u.includes('geocoding-api.open-meteo.com'))return __briefAntwoord({results:[]});
  return __briefAntwoord({});
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",headStub+"</head>");

const reporter=`<script>
document.addEventListener('DOMContentLoaded',()=>{
  const zet=(k,v)=>document.body.setAttribute('data-brief-stable-'+k,String(v));
  setTimeout(async()=>{
    try{
      await load(51.92,4.48,'Browsertest',false,true,'NL');
      const brief=document.getElementById('brief'),temp=document.getElementById('t');
      const eersteTekst=(brief&&brief.textContent||'').replace(/\\s+/g,' ').trim();
      const eersteTemp=(temp&&temp.textContent||'').trim();
      const hitsVoor=window.WeatherNowQ1Performance?WeatherNowQ1Performance.cacheHits:0;
      window.__briefVersie=2;window.__briefDelay=700;
      const verversing=load(51.92,4.48,'Browsertest',false,true,'NL');
      await new Promise(r=>setTimeout(r,100));
      const pendingOwner=brief&&brief.getAttribute('data-q1-briefing-pending');
      zet('first-temp',eersteTemp);
      zet('first-len',eersteTekst.length);
      zet('pending-visibility',brief?getComputedStyle(brief).visibility:'missing');
      zet('pending-hidden',brief&&brief.getAttribute('aria-hidden'));
      zet('pending-busy',brief&&brief.getAttribute('aria-busy'));
      zet('pending-owner',pendingOwner||'');
      zet('pending-cachehit',window.WeatherNowQ1Performance&&WeatherNowQ1Performance.cacheHits>hitsVoor?'ok':'fout');
      await verversing;
      const finaleTekst=(brief&&brief.textContent||'').replace(/\\s+/g,' ').trim();
      zet('final-temp',(temp&&temp.textContent||'').trim());
      zet('final-len',finaleTekst.length);
      zet('copy-changed',finaleTekst!==eersteTekst?'ja':'nee');
      zet('final-visibility',brief?getComputedStyle(brief).visibility:'missing');
      zet('final-hidden',brief&&brief.getAttribute('aria-hidden'));
      zet('final-busy',brief&&brief.getAttribute('aria-busy'));
      zet('final-owner',brief&&brief.getAttribute('data-q1-briefing-pending'));
      zet('done','ok');
    }catch(e){zet('error',e&&e.message||e);zet('done','fout');}
  },120);
},{once:true});
</script>`;
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-brief-stable-"));
try{
  const bestand=path.join(dir,"index.html");fs.writeFileSync(bestand,html);
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=1366,900","--virtual-time-budget=3000","--dump-dom","file://"+bestand],{encoding:"utf8",maxBuffer:30*1024*1024});
  if(r.status!==0)throw new Error("browser exit "+r.status+" "+String(r.stderr||"").slice(-1200));
  const dom=r.stdout||"";
  const waarde=k=>{const m=new RegExp('data-brief-stable-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
  const fout=`done=${waarde('done')} error=${waarde('error')} firstTemp=${waarde('first-temp')} firstLen=${waarde('first-len')} cache=${waarde('pending-cachehit')} pendingVis=${waarde('pending-visibility')} pendingHidden=${waarde('pending-hidden')} pendingBusy=${waarde('pending-busy')} pendingOwner=${waarde('pending-owner')} finalTemp=${waarde('final-temp')} finalLen=${waarde('final-len')} changed=${waarde('copy-changed')} finalVis=${waarde('final-visibility')} finalHidden=${waarde('final-hidden')} finalBusy=${waarde('final-busy')} finalOwner=${waarde('final-owner')}`;
  if(waarde('done')!=="ok")throw new Error("Briefing-stability browser niet afgerond: "+fout);
  if(waarde('pending-cachehit')!=="ok")throw new Error("Briefing-stability raakte de plaatscache niet: "+fout);
  if(waarde('pending-visibility')!=="hidden"||waarde('pending-hidden')!=="true"||waarde('pending-busy')!=="true"||!waarde('pending-owner'))throw new Error("Cached briefing was tijdens refresh nog zichtbaar/aankondigbaar: "+fout);
  if(waarde('final-temp')!=="31")throw new Error("Verse forecast heeft de zichtbare hero niet vervangen: "+fout);
  if(!Number(waarde('final-len')))throw new Error("Definitieve briefing ontbreekt na verse refresh: "+fout);
  if(waarde('final-visibility')==="hidden"||waarde('final-hidden')==="true"||waarde('final-busy')==="true"||waarde('final-owner'))throw new Error("Definitieve briefing bleef in voorlopige toestand hangen: "+fout);
  console.log("Briefing-stability browser 1366px: cached hero verschijnt direct, cached briefing blijft verborgen/a11y-stil en alleen de definitieve refreshbriefing wordt zichtbaar.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
