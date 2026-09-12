"use strict";

const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
function vindBrowser(){for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){const r=spawnSync(n,["--version"],{encoding:"utf8"});if(r.status===0)return n;}return null;}
const browser=vindBrowser();
if(!browser){if(process.env.CI){console.error("FOUT live-chart-layout browsertest: Chrome/Chromium ontbreekt.");process.exit(1);}console.log("SKIP live-chart-layout browsertest: lokaal geen Chrome/Chromium.");process.exit(0);}
const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(productie,"utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"");
if(!html.includes("LIVE CHART LABEL FIX 20260912")||!html.includes("LIVE Q4 CHART COMPACTION 20260912"))throw new Error("pre-cleanup chart/layout-fix ontbreekt in het te testen artifact");
const stub=`<script>try{localStorage.clear();sessionStorage.clear();}catch(e){}window.fetch=()=>new Promise(()=>{});window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),16);try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
html=html.replace("</head>",stub+"</head>");
const reporter=`<script>
window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{const zet=(k,v)=>document.body.setAttribute('data-live-chart-'+k,String(v));try{
  document.documentElement.classList.remove('wn-progressief');const app=document.getElementById('app');if(app){app.style.display='block';app.style.visibility='visible';app.classList.remove('wn-progressief');}const state=document.getElementById('state');if(state)state.style.display='none';
  if(typeof S==='undefined'||typeof etmaal!=='function')throw new Error('pre-cleanup runtimeglobals ontbreken');
  const uren=['17','18','19','20','21','22','23','00','01','02','03'];
  const tijden=uren.map((u,i)=>(i<7?'2026-09-12T':'2026-09-13T')+u+':00');
  const temp=[20,19.2,18.7,18.5,18.4,17.5,17.3,17.4,17.4,17.6,17.7];
  const wind=tijden.map(()=>20),richting=tijden.map(()=>225),code=tijden.map((_,i)=>i>=5?61:3),dag=tijden.map((_,i)=>i<4?1:0);
  const kans=[2,2,3,10,26,48,63,66,63,61,62],mm=[0,0,0,0,0,2.1,0,0.1,0.5,0.5,0.5];
  S.d={timezone:'Europe/Amsterdam',utc_offset_seconds:7200,current:{time:'2026-09-12T16:35',temperature_2m:20,is_day:1},hourly:{time:tijden,temperature_2m:temp,apparent_temperature:temp.map(v=>v-.4),precipitation_probability:kans,precipitation:mm,wind_speed_10m:wind,wind_gusts_10m:wind.map(v=>v+5),cloud_cover:tijden.map(()=>90),weather_code:code,is_day:dag,wind_direction_10m:richting},daily:{time:['2026-09-12','2026-09-13'],sunrise:['2026-09-12T07:05','2026-09-13T07:07'],sunset:['2026-09-12T20:01','2026-09-13T19:59']}};
  S.dag=null;S.bereik=24;S.i0=0;S.klokInstantOverride=new Date('2026-09-12T14:35:00Z');
  etmaal(0,11);
  const svg=document.getElementById('chart'),dot18=svg.querySelector('circle[data-temp-index="1"]'),dot17=svg.querySelector('circle[data-temp-index="0"]'),rain=svg.querySelector('g[data-q4-rain-periods]');
  const vb=(svg.getAttribute('viewBox')||'').trim().split(/\\s+/).map(Number),h=vb[3]||0;
  const labels=[...svg.querySelectorAll('text')].map(x=>String(x.textContent||'').trim());
  zet('dot18',dot18?'ja':'nee');zet('dot17',dot17?'ja':'nee');zet('label19',labels.includes('19°')?'ja':'nee');zet('height',h);zet('rain',rain?'ja':'nee');zet('overflow',Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);zet('done','ok');
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},180),{once:true});
</script>`;
html=html.replace("</body>",reporter+"</body>");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-live-chart-"));
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html,"utf8");
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=1660,900","--virtual-time-budget=2500","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:36*1024*1024,timeout:30000});
  if(r.status!==0)throw new Error("browser exit "+r.status+": "+String(r.stderr||"").slice(-1200));
  const dom=r.stdout||"",v=k=>{const m=new RegExp('data-live-chart-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(v('done')!=='ok')throw new Error("reporter: "+v('exception'));
  if(v('dot18')!=='ja')throw new Error("18:00-modelpunt/temperatuurlabel ontbreekt nog in de compacte desktopgrafiek");
  if(v('dot17')!=='nee')throw new Error("het modeluur op de nu-lijn wordt niet meer als redundante actuele waarde onderdrukt");
  if(v('label19')!=='ja')throw new Error("18:00-temperatuur rondt niet zichtbaar af naar 19°");
  const h=Number(v('height'));if(!(h>=296&&h<=310))throw new Error("desktopgrafiek reserveert nog te veel/te weinig onderruimte: viewBox-hoogte="+h);
  if(v('rain')!=='ja')throw new Error("Q4-regenannotatie ontbreekt in de regenfixture");
  if(Number(v('overflow'))>2)throw new Error("pre-cleanup desktopfixture heeft horizontale overflow: "+v('overflow')+"px");
  console.log("Live chart/layout browserregressie groen vóór bundling: 18:00-label aanwezig, 17:00 bij nu onderdrukt, chart viewBox "+h+".");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
