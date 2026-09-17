"use strict";

const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
function vindBrowser(){for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){const r=spawnSync(n,["--version"],{encoding:"utf8"});if(r.status===0)return n;}return null;}
const browser=vindBrowser();
if(!browser){if(process.env.CI){console.error("FOUT mobile-axis-rhythm: Chrome/Chromium ontbreekt.");process.exit(1);}console.log("SKIP mobile-axis-rhythm: lokaal geen Chrome/Chromium.");process.exit(0);}

const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(productie,"utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"");
if(!html.includes("WeatherNowMobileGraphUX20260828"))throw new Error("Mobiele grafiek-UX ontbreekt in finale artifact.");
const stub=`<script>try{localStorage.clear();sessionStorage.clear();}catch(e){}window.fetch=()=>new Promise(()=>{});window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),16);try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
html=html.replace("</head>",stub+"</head>");
const reporter=`<script>
window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{const zet=(k,v)=>document.body.setAttribute('data-axis-rhythm-'+k,String(v));try{
  document.documentElement.classList.remove('wn-progressief');const app=document.getElementById('app');if(app){app.style.display='block';app.style.visibility='visible';app.classList.remove('wn-progressief');}const state=document.getElementById('state');if(state)state.style.display='none';
  if(typeof S==='undefined'||typeof etmaal!=='function')throw new Error('grafiekruntime ontbreekt');
  const tijden=Array.from({length:24},(_,i)=>{const uur=(22+i)%24,dag=i<2?'2026-09-17':'2026-09-18';return dag+'T'+String(uur).padStart(2,'0')+':00';});
  const temp=[15.4,15.0,14.8,14.6,14.3,14.1,14.2,13.7,13.2,14.0,14.8,15.4,15.8,16.4,17.0,17.6,18.0,18.2,18.4,18.2,17.8,17.1,17.1,16.2];
  const zeros=tijden.map(()=>0),wind=tijden.map(()=>12),richting=tijden.map(()=>220),code=tijden.map(()=>3),daglicht=tijden.map((_,i)=>i>=9&&i<=20?1:0);
  S.d={timezone:'Europe/Amsterdam',utc_offset_seconds:7200,current:{time:'2026-09-17T21:33',temperature_2m:15.5,is_day:0},hourly:{time:tijden,temperature_2m:temp,apparent_temperature:temp.map(v=>v-.3),precipitation_probability:zeros,precipitation:zeros,wind_speed_10m:wind,wind_gusts_10m:wind.map(v=>v+4),cloud_cover:tijden.map(()=>55),weather_code:code,is_day:daglicht,wind_direction_10m:richting},daily:{time:['2026-09-17','2026-09-18'],sunrise:['2026-09-17T07:17','2026-09-18T07:19'],sunset:['2026-09-17T19:51','2026-09-18T19:48']}};
  S.dag=null;S.bereik=24;S.i0=0;S.klokInstantOverride=new Date('2026-09-17T19:33:00Z');
  etmaal(0,24);
  setTimeout(()=>{try{
    const svg=document.getElementById('chart'),g=S.geo;if(!svg||!g)throw new Error('chart/geometrie ontbreekt');
    const pb=Number(g.pt)+Number(g.ih),labels=[...svg.querySelectorAll('text')].filter(el=>/^\\d{2}:00$/.test(String(el.textContent||'').trim())&&Number(el.getAttribute('y'))>=pb+6).sort((a,b)=>Number(a.getAttribute('x'))-Number(b.getAttribute('x')));
    const teksten=labels.map(el=>String(el.textContent||'').trim()),fonts=labels.map(el=>String(el.getAttribute('font-family')||'')),stijlen=labels.map(el=>String(el.getAttribute('font-style')||''));
    const W=Number(g.W),buiten=labels.filter(el=>{const b=el.getBBox();return b.x<-.5||b.x+b.width>W+.5;});
    zet('labels',teksten.join(','));zet('count',labels.length);zet('font-ok',fonts.every(v=>/Instrument Sans/.test(v))?'ja':'nee');zet('style-ok',stijlen.every(v=>v==='normal')?'ja':'nee');zet('overflow',buiten.length?buiten.map(el=>el.textContent).join(','):'geen');zet('done','ok');
  }catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},700);
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},180),{once:true});
</script>`;
html=html.replace("</body>",reporter+"</body>");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-mobile-axis-rhythm-"));
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html,"utf8");
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=402,900","--virtual-time-budget=3800","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:36*1024*1024,timeout:30000});
  if(r.status!==0)throw new Error("browser exit "+r.status+": "+String(r.stderr||"").slice(-1200));
  const dom=r.stdout||"",v=k=>{const m=new RegExp('data-axis-rhythm-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(v('done')!=='ok')throw new Error("reporter: "+v('exception'));
  const verwacht='00:00,04:00,08:00,12:00,16:00,20:00';
  if(v('labels')!==verwacht)throw new Error("mobiele uuras heeft geen rustig vier-uursritme: kreeg "+v('labels')+", verwacht "+verwacht);
  if(Number(v('count'))!==6)throw new Error("mobiele 24-uursas moet exact zes tijdlabels tonen; kreeg "+v('count'));
  if(v('font-ok')!=='ja'||v('style-ok')!=='ja')throw new Error("mobiele uuras gebruikt niet overal het rechte Instrument Sans-letterbeeld");
  if(v('overflow')!=='geen')throw new Error("mobiele uuras valt buiten de SVG: "+v('overflow'));
  console.log("Mobiele uuras-regressie groen: 402 px toont zes rustige vier-uurslabels in recht Instrument Sans zonder randoverflow.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
