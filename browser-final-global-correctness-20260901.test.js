"use strict";

const fs=require("fs"),os=require("os"),path=require("path"),crypto=require("crypto"),{spawnSync}=require("child_process");
function vindBrowser(){for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){const r=spawnSync("sh",["-lc","command -v "+n],{encoding:"utf8"});if(r.status===0&&r.stdout.trim())return r.stdout.trim();}return null;}
const browser=vindBrowser();
if(!browser){if(process.env.CI){console.error("FOUT finale wereldwijde browseraudit: Chrome/Chromium ontbreekt.");process.exit(1);}console.log("SKIP finale wereldwijde browseraudit: lokaal geen Chrome/Chromium.");process.exit(0);}
const productie=path.join(__dirname,"public","index.html");if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(productie,"utf8");
const stub=`<script>
try{localStorage.clear();sessionStorage.clear();}catch(e){}
window.fetch=function(url){
  const u=String(url),response=data=>Promise.resolve({ok:true,status:200,json:async()=>data,text:async()=>JSON.stringify(data)});
  if(u.includes('geocoding-api.open-meteo.com/v1/search?'))return response({results:[
    {id:101,name:'Singapore',admin1:'Singapore',country_code:'SG',latitude:1.28967,longitude:103.85007},
    {id:202,name:'Singapore',admin1:'Singapore',country_code:'SG',latitude:1.28967,longitude:103.85007},
    {id:303,name:'Singapore',admin1:'North East',country_code:'SG',latitude:1.35000,longitude:103.90000}
  ]});
  return new Promise(()=>{});
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");
const reporter=`<script>
setTimeout(()=>{
 const zet=(k,v)=>document.body.setAttribute('data-'+k,String(v));
 try{
  document.documentElement.classList.remove('wn-progressief');
  const app=document.getElementById('app'),state=document.getElementById('state');if(app){app.classList.remove('wn-progressief');app.removeAttribute('aria-busy');app.style.display='block';}if(state)state.style.display='none';
  const G=window.WeatherNowFinalGlobalCorrectness;
  zet('policy',G&&G.nachtVensterTijdsvorm('Beste periode: 20:00–23:00.',{horizonDagen:0,nuDatumTijd:'2026-09-01T05:49',nachtDatum:'2026-09-01',tijdzone:'Asia/Singapore'})==='Beste periode: 20:00–23:00.'?'ok':'fout');
  const p=[...document.querySelectorAll('.eyebrow')].find(x=>/Luchtdruk/.test(x.textContent||''));zet('pressure',p&&p.textContent.trim()==='Luchtdruk op zeeniveau'?'ok':'fout');
  const risk=document.getElementById('modelrisico');if(risk){risk.hidden=false;risk.innerHTML='<div class="modelrisico-kop"><span class="modelrisico-label">Modelsignaal</span><span class="modelrisico-note">Modelgegevens, geen officiële waarschuwing.</span></div><div class="modelrisico-items"><span>Extreme hitte in de modelverwachting (43 °C).</span><span>Luchtkwaliteit volgens het model is ongezond (AQI VS 151).</span></div>';}
  const days=document.getElementById('days');if(days){days.innerHTML='<div class="row day"><div>Vandaag</div><div>22° / 14°</div><div class="drain" aria-label="Neerslagkans 61 procent; hoeveelheid onzeker">61%<small class="wiw-dag-onzeker">hoeveelheid onzeker</small></div><div>4 Bft</div></div>';}
  requestAnimationFrame(()=>{requestAnimationFrame(()=>{
    const overflow=document.documentElement.scrollWidth<=window.innerWidth+1&&document.body.scrollWidth<=window.innerWidth+1;
    const pr=p&&p.getBoundingClientRect(),sheet=document.querySelector('.sheet'),sr=sheet&&sheet.getBoundingClientRect();
    const drukPast=!!(pr&&sr&&pr.left>=sr.left-1&&pr.right<=sr.right+1);
    const rr=risk&&risk.getBoundingClientRect(),risicoPast=!rr||rr.right<=window.innerWidth+1;
    zet('layout',overflow&&drukPast&&risicoPast?'ok':'fout');
  });});
  const q=document.getElementById('q');if(q){q.value='Singapore';q.dispatchEvent(new Event('input',{bubbles:true}));}
  setTimeout(()=>{
    try{
      const opties=[...document.querySelectorAll('#res [role="option"]')],status=(document.getElementById('zoekstatus')||{}).textContent||'';
      if(q)q.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
      const actief=q&&q.getAttribute('aria-activedescendant'),eerste=opties[0];
      const nav=opties.length===2&&/2 plaatsen gevonden/.test(status)&&eerste&&actief===eerste.id&&eerste.getAttribute('aria-selected')==='true';
      zet('search',nav?'ok':'fout');
      if(q)q.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      zet('enter',q&&q.value==='Singapore'&&q.getAttribute('aria-expanded')==='false'?'ok':'fout');
      zet('done','ok');
    }catch(e){zet('exception',e&&e.message||e);zet('done','fout');}
  },700);
 }catch(e){zet('exception',e&&e.message||e);zet('done','fout');}
},120);
</script>`;
html=html.replace("</body>",reporter+"</body>");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-final-global-"));
const viewports=[[320,1100],[360,1100],[390,1100],[430,1100],[820,1100],[1366,1000],[1440,1000],[1920,1080]];
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html);
  for(const [w,h] of viewports){
    const png=path.join(dir,`audit-${w}.png`),url="file://"+pad;
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",`--window-size=${w},${h}`,"--virtual-time-budget=1300","--hide-scrollbars","--dump-dom",`--screenshot=${png}`,url],{encoding:"utf8",maxBuffer:25*1024*1024});
    if(r.status!==0)throw new Error(`viewport ${w}: browser exit ${r.status}: `+(r.stderr||"").slice(-1000));
    const dom=r.stdout||"",waarde=k=>{const m=new RegExp('data-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
    for(const k of ["policy","pressure","layout","search","enter","done"])if(waarde(k)!=="ok")throw new Error(`viewport ${w}: ${k}=${waarde(k)} exception=${waarde("exception")||""}`);
    if(!fs.existsSync(png)||fs.statSync(png).size<5000)throw new Error(`viewport ${w}: screenshot ontbreekt of is verdacht klein`);
    const sha=crypto.createHash("sha256").update(fs.readFileSync(png)).digest("hex").slice(0,12);
    console.log(`Viewport ${w}px: geen overflow; druklabel, modelsignaal, onzeker-neerslagveld en zoektoetsenbord correct; screenshot sha256 ${sha}.`);
  }
  console.log("Finale wereldwijde browseraudit: 8 viewports geslaagd (320, 360, 390, 430, 820, 1366, 1440, 1920 px).");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
