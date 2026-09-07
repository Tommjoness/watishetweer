"use strict";

const fs=require("fs");
const os=require("os");
const path=require("path");
const {spawnSync}=require("child_process");

function vindBrowser(){
  for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    const r=spawnSync(n,["--version"],{encoding:"utf8"});if(r.status===0)return n;
  }
  return null;
}
const browser=vindBrowser();
if(!browser){
  if(process.env.CI){console.error("FOUT uurpaneelrefinement browsertest: Chrome/Chromium ontbreekt.");process.exit(1);}
  console.log("SKIP uurpaneelrefinement browsertest: lokaal geen Chrome/Chromium.");process.exit(0);
}
const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(productie,"utf8");
html=html.replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"");
const stub=`<script>try{localStorage.clear();sessionStorage.clear();}catch(e){}window.fetch=()=>new Promise(()=>{});window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),16);window.cancelAnimationFrame=clearTimeout;try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
html=html.replace("</head>",stub+"</head>");
const reporter=`<script>
document.addEventListener('DOMContentLoaded',async()=>{const zet=(k,v)=>document.body.setAttribute('data-hour-refine-'+k,String(v));try{
 document.documentElement.classList.remove('wn-progressief');const app=document.getElementById('app');if(app){app.classList.remove('wn-progressief');app.removeAttribute('aria-busy');app.style.display='block';app.style.visibility='visible';}const state=document.getElementById('state');if(state)state.style.display='none';
 const TI=Array.from({length:24},(_,i)=>i<11?'2026-09-02T'+String(i+13).padStart(2,'0')+':00':'2026-09-03T'+String(i-11).padStart(2,'0')+':00');
 const precipitation=TI.map(()=>0);precipitation[2]=null;
 S.d={timezone:'Europe/Amsterdam',utc_offset_seconds:7200,current:{time:'2026-09-02T13:27'},hourly:{time:TI,temperature_2m:TI.map((_,i)=>18-i*.1),apparent_temperature:TI.map((_,i)=>18-i*.1),precipitation_probability:TI.map(()=>0),precipitation}};
 S.klokInstantOverride=new Date('2026-09-02T11:27:00Z');S.geo={TI,T:S.d.hourly.temperature_2m,A:S.d.hourly.apparent_temperature,P:S.d.hourly.precipitation_probability,MM:S.d.hourly.precipitation};S.dag=null;
 const kandidaten=WeatherNowFinalDesktopUI20260902.komendeUurRijen(S.d,S.klokInstantOverride.getTime(),12);
 WeatherNowFinalDesktopUI20260902.render();
 // Laat ook font-ready/hoogtesync en een tweede stabiele layoutpass afronden.
 await new Promise(resolve=>setTimeout(resolve,160));WeatherNowFinalDesktopUI20260902.render();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const rows=[...document.querySelectorAll('#wiw-hour-table tbody tr')];const panel=document.getElementById('wiw-hour-panel');const last=rows.at(-1);const tijden=rows.map(r=>r.querySelector('time')?.textContent.trim()||'');const mm=rows.map(r=>r.children[3]?.textContent.trim()||'');
 const pr=panel?.getBoundingClientRect(),lr=last?.getBoundingClientRect();
 zet('candidates',kandidaten.length);zet('candidate-first',kandidaten[0]?String(kandidaten[0].tijd).slice(11,16):'');zet('candidate-last',kandidaten.at(-1)?String(kandidaten.at(-1).tijd).slice(11,16):'');
 zet('rows',rows.length);zet('first',tijden[0]||'');zet('zero-first',mm[0]||'');zet('missing-second',mm[1]||'');zet('fits',pr&&lr&&lr.bottom<=pr.bottom+1?'ok':'fout');zet('panel-bottom',pr?pr.bottom.toFixed(1):'');zet('last-bottom',lr?lr.bottom.toFixed(1):'');zet('done','ok');
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},{once:true});
</script>`;
const bodyEinde=/<\/body>\s*<\/html>\s*$/i;if(!bodyEinde.test(html))throw new Error("public/index.html heeft geen afgesloten body voor browserfixture");html=html.replace(bodyEinde,reporter+"</body>\n</html>");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-hour-refine-"));
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html);
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=1920,1080","--virtual-time-budget=3000","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:36*1024*1024});
  if(r.status!==0)throw new Error(`browser exit ${r.status}: `+String(r.stderr||"").slice(-800));
  const dom=r.stdout||"",v=k=>{const m=new RegExp('data-hour-refine-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(v('done')!=='ok')throw new Error("reporter: "+v('exception'));
  if(v('candidates')!=='12'||v('candidate-first')!=='14:00'||v('candidate-last')!=='01:00')throw new Error(`12-uurskandidaatset fout: count=${v('candidates')} first=${v('candidate-first')} last=${v('candidate-last')}`);
  const zichtbaar=Number(v('rows'));if(!(zichtbaar>=1&&zichtbaar<=12)||v('first')!=='14:00')throw new Error(`zichtbare uurselectie fout: rows=${v('rows')} first=${v('first')}`);
  if(v('zero-first')!=='0,0 mm'||v('missing-second')!=='–')throw new Error(`0 mm/missing-semantiek fout: first=${v('zero-first')} second=${v('missing-second')}`);
  if(v('fits')!=='ok')throw new Error(`laatste volledige uurregel valt buiten paneel: row=${v('last-bottom')} panel=${v('panel-bottom')}`);
  console.log(`Uurpaneel browsertest groen op 1920×1080: 12 uur beschikbaar, ${zichtbaar} volledige rijen passen; numerieke nul toont 0,0 mm en alleen ontbrekende neerslag toont –.`);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
