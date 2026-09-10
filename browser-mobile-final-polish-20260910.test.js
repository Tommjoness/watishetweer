"use strict";

const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");

function vindBrowser(){
  for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    const r=spawnSync("sh",["-lc","command -v "+n],{encoding:"utf8"});
    if(r.status===0&&r.stdout.trim())return r.stdout.trim();
  }
  return null;
}

const browser=vindBrowser();
if(!browser){
  if(process.env.CI){console.error("FOUT mobiele final-polish browsertest: Chrome/Chromium ontbreekt.");process.exit(1);}
  console.log("SKIP mobiele final-polish browsertest: lokaal geen Chrome/Chromium.");process.exit(0);
}

const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(productie,"utf8");
html=html.replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"");
const stub=`<script>try{localStorage.clear();sessionStorage.clear();}catch(e){}window.fetch=()=>new Promise(()=>{});window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),16);window.cancelAnimationFrame=clearTimeout;try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
html=html.replace("</head>",stub+"</head>");

const reporter=`<script>
document.addEventListener('DOMContentLoaded',()=>{const zet=(k,v)=>document.body.setAttribute('data-mobile-final-'+k,String(v));try{
  document.documentElement.classList.remove('wn-progressief');const app=document.getElementById('app');if(app){app.classList.remove('wn-progressief');app.removeAttribute('aria-busy');app.style.display='block';}const state=document.getElementById('state');if(state)state.style.display='none';
  const TI=Array.from({length:24},(_,i)=>i<11?'2026-09-02T'+String(i+13).padStart(2,'0')+':00':'2026-09-03T'+String(i-11).padStart(2,'0')+':00');
  const T=TI.map((_,i)=>17+i/10),A=TI.map((_,i)=>16+i/10),P=TI.map((_,i)=>10+i),MM=TI.map((_,i)=>i/10);
  S.d={timezone:'Europe/Amsterdam',utc_offset_seconds:7200,current:{time:'2026-09-02T13:27'},hourly:{time:TI,temperature_2m:T,apparent_temperature:A,precipitation_probability:P,precipitation:MM,weather_code:TI.map(()=>3),is_day:TI.map(()=>1),wind_speed_10m:TI.map(()=>8),wind_direction_10m:TI.map(()=>180)}};
  S.geo={TI,T,A,P,MM};S.dag=null;S.bereik=24;S.klokOverride=new Date('2026-09-02T11:27:00Z');S.klokInstantOverride=new Date('2026-09-02T11:27:00Z');
  WeatherNowFinalDesktopUI20260902.render();
  const rows=[...document.querySelectorAll('#wiw-hour-table tbody tr')],first=rows[0];
  zet('rows',rows.length);zet('first-time',first?.querySelector('time')?.textContent||'');zet('first-chance',first?.children[2]?.textContent.trim()||'');zet('first-rain',first?.children[3]?.textContent.trim()||'');zet('current',document.querySelectorAll('#wiw-hour-table tr[data-current="1"]').length);zet('marker',document.querySelector('#wiw-hour-table tr[data-current="1"] .wiw-hour-marker')?.textContent||'');
  const title=document.getElementById('wiw-hour-title'),mini=document.getElementById('minibar');mini?.classList.add('aan');
  zet('title-size',parseFloat(getComputedStyle(title).fontSize));zet('mini-overflow',mini?getComputedStyle(mini).overflow:'');
  const after=mini?getComputedStyle(mini,'::after'):null;zet('fade-height',after?parseFloat(after.height):0);zet('fade-bg',after?.backgroundImage||'');
  zet('overflow',Math.round(Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth));
  S.dag=0;WeatherNowFinalDesktopUI20260902.render();const dagRows=[...document.querySelectorAll('#wiw-hour-table tbody tr')];zet('day-rows',dagRows.length);zet('day-first',dagRows[0]?.querySelector('time')?.textContent||'');
  zet('done','ok');
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},{once:true});
</script>`;
const bodyEinde=/<\/body>\s*<\/html>\s*$/i;
if(!bodyEinde.test(html))throw new Error("public/index.html heeft geen afgesloten body voor mobiele final-polishfixture");
html=html.replace(bodyEinde,reporter+"</body>\n</html>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-mobile-final-"));
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html,"utf8");
  for(const [w,h] of [[320,900],[390,900],[430,932]]){
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",`--window-size=${w},${h}`,"--virtual-time-budget=3000","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:32*1024*1024});
    if(r.status!==0)throw new Error(`${w}px browser exit ${r.status}: `+String(r.stderr||"").slice(-800));
    const dom=r.stdout||"",v=k=>{const m=new RegExp('data-mobile-final-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
    if(v('done')!=='ok')throw new Error(`${w}px reporter: ${v('exception')}`);
    if(v('rows')!=='23'||v('first-time')!=='14:00')throw new Error(`${w}px: verstreken 13:00-rij staat nog in komende-uurtabel (${v('rows')} rijen, eerste ${v('first-time')})`);
    if(v('first-chance')!=='11%'||v('first-rain')!=='0,1 mm')throw new Error(`${w}px: eerste toekomstige neerslagvelden zijn niet intact (${v('first-chance')} / ${v('first-rain')})`);
    if(v('current')!=='1'||v('marker')!=='')throw new Error(`${w}px: eerstvolgend uur moet semantisch actueel blijven zonder zichtbare marker (${v('current')} / ${v('marker')})`);
    if(Number(v('title-size'))>18.1)throw new Error(`${w}px: uurtabeltitel blijft te groot (${v('title-size')}px)`);
    if(v('mini-overflow')!=='visible'||Number(v('fade-height'))<11.9||!/linear-gradient/i.test(v('fade-bg')||''))throw new Error(`${w}px: fixed locatiebalk heeft geen zachte onderovergang (${v('mini-overflow')} / ${v('fade-height')} / ${v('fade-bg')})`);
    if(v('day-rows')!=='24'||v('day-first')!=='13:00')throw new Error(`${w}px: expliciet gekozen kalenderdag is onbedoeld ingekort (${v('day-rows')} / ${v('day-first')})`);
    if(Number(v('overflow'))>2)throw new Error(`${w}px: ${v('overflow')}px horizontale overflow`);
    console.log(`${w}px mobiele final-polish groen: eerste komende uur 14:00, 23 rijen, gekozen dag 24 rijen, titel ${v('title-size')}px, headerfade ${v('fade-height')}px.`);
  }
  console.log("Mobiele final-polish browsertest geslaagd op 320/390/430 px.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
