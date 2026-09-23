"use strict";

const fs=require("fs");
const os=require("os");
const path=require("path");
const {spawnSync}=require("child_process");

function vindBrowser(){return require("./scripts/vind-browser.js").vindBrowser();}
const browser=vindBrowser();
if(!browser){
  if(process.env.CI){console.error("FOUT uurpaneelcleanup browsertest: Chrome/Chromium ontbreekt.");process.exit(1);}
  console.log("SKIP uurpaneelcleanup browsertest: lokaal geen Chrome/Chromium.");process.exit(0);
}

const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(productie,"utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"");
const stub=`<script>try{localStorage.clear();sessionStorage.clear();}catch(e){}window.fetch=()=>new Promise(()=>{});window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),16);window.cancelAnimationFrame=clearTimeout;try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
html=html.replace("</head>",stub+"</head>");
const reporter=`<script>
document.addEventListener('DOMContentLoaded',async()=>{const zet=(k,v)=>document.body.setAttribute('data-hour-clean-'+k,String(v));try{
 document.documentElement.classList.remove('wn-progressief');const app=document.getElementById('app');if(app){app.classList.remove('wn-progressief');app.removeAttribute('aria-busy');app.style.display='block';app.style.visibility='visible';}const state=document.getElementById('state');if(state)state.style.display='none';
 const TI=Array.from({length:24},(_,i)=>i<11?'2026-09-02T'+String(i+13).padStart(2,'0')+':00':'2026-09-03T'+String(i-11).padStart(2,'0')+':00');
 S.d={timezone:'Europe/Amsterdam',utc_offset_seconds:7200,current:{time:'2026-09-02T13:27'},hourly:{time:TI,temperature_2m:TI.map((_,i)=>18.2-i*.1),apparent_temperature:TI.map((_,i)=>16.6-i*.1),precipitation_probability:TI.map((_,i)=>i%4?35:0),precipitation:TI.map(()=>0),weather_code:TI.map((_,i)=>i%3?3:61),is_day:TI.map((_,i)=>i<8?1:0),wind_speed_10m:TI.map((_,i)=>12+i),wind_direction_10m:TI.map(()=>225)}};
 S.klokInstantOverride=new Date('2026-09-02T11:27:00Z');S.geo={TI,T:S.d.hourly.temperature_2m,A:S.d.hourly.apparent_temperature,P:S.d.hourly.precipitation_probability,MM:S.d.hourly.precipitation};S.dag=null;S.bereik=24;
 WeatherNowFinalDesktopUI20260902.render();await new Promise(resolve=>setTimeout(resolve,180));WeatherNowFinalDesktopUI20260902.render();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const panel=document.getElementById('wiw-hour-panel'),title=panel?.querySelector('h3'),table=document.getElementById('wiw-hour-table'),rows=[...table?.querySelectorAll('tbody tr')||[]],tempHead=table?.querySelector('thead th:nth-child(3)'),firstTemp=rows[0]?.querySelector('.wiw-hour-temp'),tempPrimary=firstTemp?.querySelector('.wiw-hour-primary'),tempSecondary=firstTemp?.querySelector('.wiw-hour-secondary'),rainSecondary=rows[0]?.querySelector('.wiw-hour-rain .wiw-hour-secondary'),windSecondary=rows[0]?.querySelector('.wiw-hour-wind .wiw-hour-secondary'),heroTemp=document.getElementById('t'),heroDeg=document.querySelector('.final-top-grid .deg');
 const tr=table?.getBoundingClientRect(),thr=tempHead?.getBoundingClientRect(),titleRange=document.createRange();if(title)titleRange.selectNodeContents(title);const tx=title?titleRange.getBoundingClientRect():null;
 const tekstMidden=el=>{if(!el)return null;const range=document.createRange();range.selectNodeContents(el);const r=range.getBoundingClientRect();return r.left+r.width/2;};
 const tempHeadMidden=tekstMidden(tempHead),tempWaardeMidden=tekstMidden(tempPrimary);
 const tempStart=tr&&thr&&tr.width?(thr.left-tr.left)/tr.width:9;
 const titleOffset=tr&&tx?Math.abs((tx.left+tx.width/2)-(tr.left+tr.width/2)):999;
 const tempAsOffset=Number.isFinite(tempHeadMidden)&&Number.isFinite(tempWaardeMidden)?Math.abs(tempHeadMidden-tempWaardeMidden):999;
 zet('rows',rows.length);zet('title',title?.textContent.trim()||'');zet('title-align',title?getComputedStyle(title).textAlign:'');zet('title-offset',titleOffset.toFixed(2));zet('temp-start',tempStart.toFixed(4));zet('temp-head-align',tempHead?getComputedStyle(tempHead).textAlign:'');zet('temp-cell-align',firstTemp?getComputedStyle(firstTemp).textAlign:'');zet('temp-axis-offset',tempAsOffset.toFixed(2));zet('feels-display',tempSecondary?getComputedStyle(tempSecondary).display:'missing');zet('feels-visible',firstTemp?.innerText.toLowerCase().includes('voelt')?'yes':'no');zet('temp-primary',tempPrimary?.textContent.trim()||'');zet('rain-secondary',rainSecondary?getComputedStyle(rainSecondary).display:'missing');zet('wind-secondary',windSecondary?getComputedStyle(windSecondary).display:'missing');zet('hero-size',heroTemp?parseFloat(getComputedStyle(heroTemp).fontSize):0);zet('hero-deg-size',heroDeg?parseFloat(getComputedStyle(heroDeg).fontSize):0);zet('overflow',Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);zet('done','ok');
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},{once:true});
</script>`;
const einde=/<\/body>\s*<\/html>\s*$/i;if(!einde.test(html))throw new Error("public/index.html heeft geen afgesloten body.");html=html.replace(einde,reporter+"</body>\n</html>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-hour-clean-"));
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html);
  for(const breedte of [1366,1440,1920]){
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",`--window-size=${breedte},900`,"--virtual-time-budget=4500","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:36*1024*1024});
    if(r.status!==0)throw new Error(`browser ${breedte}px exit ${r.status}: `+String(r.stderr||"").slice(-800));
    const dom=r.stdout||"",v=k=>{const m=new RegExp('data-hour-clean-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
    if(v('done')!=='ok')throw new Error(`${breedte}px reporter: ${v('exception')}`);
    if(v('title')!=='Komende uren'||v('title-align')!=='center')throw new Error(`${breedte}px: Komende uren is niet gecentreerd (${v('title')}/${v('title-align')})`);
    if(Number(v('title-offset'))>3)throw new Error(`${breedte}px: titel staat geometrisch niet centraal boven de tabel (offset ${v('title-offset')}px)`);
    const start=Number(v('temp-start'));if(!(start>=.195&&start<=.225))throw new Error(`${breedte}px: temperatuurkolom begint niet op de beoogde positie (${start})`);
    if(v('temp-head-align')!=='center'||v('temp-cell-align')!=='center')throw new Error(`${breedte}px: temperatuurheader/cel zijn niet beide gecentreerd (${v('temp-head-align')}/${v('temp-cell-align')})`);
    if(Number(v('temp-axis-offset'))>1.5)throw new Error(`${breedte}px: temperatuurheader en waarde liggen niet op dezelfde verticale as (offset ${v('temp-axis-offset')}px)`);
    if(v('feels-display')!=='none'||v('feels-visible')!=='no')throw new Error(`${breedte}px: gevoelstemperatuur is nog zichtbaar (${v('feels-display')}/${v('feels-visible')})`);
    if(!v('temp-primary')||v('rain-secondary')==='none'||v('wind-secondary')==='none')throw new Error(`${breedte}px: primaire temperatuur, neerslagkans of winddetail is onbedoeld geraakt`);
    const verwachteHero=60;
    if(Math.abs(Number(v('hero-size'))-verwachteHero)>.75)throw new Error(`${breedte}px: hero-temperatuur heeft onverwachte maat ${v('hero-size')}px; verwacht circa ${verwachteHero.toFixed(2)}px`);
    if(Math.abs(Number(v('hero-deg-size'))-18)>.25)throw new Error(`${breedte}px: hero-eenheid heeft onverwachte maat ${v('hero-deg-size')}px`);
    if(Number(v('overflow'))>1)throw new Error(`${breedte}px: horizontale overflow ${v('overflow')}px`);
  }
  console.log("Uurpaneelcleanup browsergroen op 1366, 1440 en 1920px: hero vast op 60px, Temperatuur exact gecentreerd boven de waarden, kolombreedtes stabiel, geen overflow en overige detaildata intact.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
