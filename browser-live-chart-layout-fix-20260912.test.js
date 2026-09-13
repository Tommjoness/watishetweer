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
  /* Unieke hele graden maken de contracttest streng: ieder toekomstig uur heeft
     precies één herkenbaar label en een ontbrekend/verwisseld uur kan niet door
     een toevallig gelijke afgeronde temperatuur worden gemaskeerd. */
  const temp=[20,19,18,17,16,15,14,13,12,11,10];
  const wind=tijden.map(()=>20),richting=tijden.map(()=>225),code=tijden.map((_,i)=>i>=5?61:3),dag=tijden.map((_,i)=>i<4?1:0);
  const kans=[2,2,3,10,26,48,63,66,63,61,62],mm=[0,0,0,0,0,2.1,0,0.1,0.5,0.5,0.5];
  const huidig='2026-09-12T17:35';
  S.d={timezone:'Europe/Amsterdam',utc_offset_seconds:7200,current:{time:huidig,temperature_2m:20,is_day:1},hourly:{time:tijden,temperature_2m:temp,apparent_temperature:temp.map(v=>v-.4),precipitation_probability:kans,precipitation:mm,wind_speed_10m:wind,wind_gusts_10m:wind.map(v=>v+5),cloud_cover:tijden.map(()=>90),weather_code:code,is_day:dag,wind_direction_10m:richting},daily:{time:['2026-09-12','2026-09-13'],sunrise:['2026-09-12T07:05','2026-09-13T07:07'],sunset:['2026-09-12T20:01','2026-09-13T19:59']}};
  S.dag=null;S.bereik=24;S.i0=0;S.klokInstantOverride=new Date('2026-09-12T15:35:00Z');
  etmaal(0,11);
  const svg=document.getElementById('chart'),geoTijden=S.geo&&Array.isArray(S.geo.TI)?S.geo.TI:[];
  const idx18=geoTijden.indexOf('2026-09-12T18:00'),idx17=geoTijden.indexOf('2026-09-12T17:00');
  const dot17=idx17>=0?svg.querySelector('circle[data-temp-index="'+idx17+'"]'):null;
  const toekomstigeIndices=geoTijden.map((t,i)=>String(t||'')>huidig?i:-1).filter(i=>i>=0);
  const puntEls=[...svg.querySelectorAll('circle[data-temp-index]')].map(el=>({el,i:Number(el.getAttribute('data-temp-index')),cx:Number(el.getAttribute('cx')),cy:Number(el.getAttribute('cy'))})).filter(p=>Number.isInteger(p.i)&&Number.isFinite(p.cx)&&Number.isFinite(p.cy));
  const dotIndices=puntEls.map(p=>p.i),dotSet=new Set(dotIndices),missend=toekomstigeIndices.filter(i=>!dotSet.has(i));
  const tekstEls=[...svg.querySelectorAll('text')],numeriekeLabels=tekstEls.filter(el=>/^-?\\d+°$/.test(String(el.textContent||'').trim()));
  const verwacht=toekomstigeIndices.map(i=>Math.round(S.geo.T[i])+'°'),gebruikt=new Set(),gekoppeldeLabels=[],labelMissend=[];
  const maxAfstand=Math.max(90,((S.geo&&Number.isFinite(S.geo.cw))?S.geo.cw:36)*3);
  toekomstigeIndices.forEach((i,pos)=>{
    const punt=puntEls.find(p=>p.i===i),doel=verwacht[pos];
    if(!punt){labelMissend.push(i);return;}
    let beste=null,besteD=Infinity;
    numeriekeLabels.forEach(el=>{
      if(gebruikt.has(el)||String(el.textContent||'').trim()!==doel)return;
      const b=el.getBBox(),cx=b.x+b.width/2,cy=b.y+b.height/2,d=Math.hypot(cx-punt.cx,cy-punt.cy);
      if(d<besteD){beste=el;besteD=d;}
    });
    if(!beste||besteD>maxAfstand){labelMissend.push(i);return;}
    gebruikt.add(beste);gekoppeldeLabels.push(beste);
  });
  const currentEl=tekstEls.find(el=>String(el.textContent||'').trim()==='nu 20°')||null;
  const tempEls=[...gekoppeldeLabels,...(currentEl?[currentEl]:[])];
  const dozen=tempEls.map(el=>{const b=el.getBBox();return {t:String(el.textContent||'').trim(),x:b.x,y:b.y,w:b.width,h:b.height};});
  const botsingen=[];
  for(let i=0;i<dozen.length;i++)for(let j=i+1;j<dozen.length;j++){
    const a=dozen[i],b=dozen[j],pad=2;
    if(a.x<b.x+b.w+pad&&a.x+a.w+pad>b.x&&a.y<b.y+b.h+pad&&a.y+a.h+pad>b.y) botsingen.push(a.t+'↔'+b.t);
  }
  const rain=svg.querySelector('g[data-q4-rain-periods]');
  const vb=(svg.getAttribute('viewBox')||'').trim().split(/\\s+/).map(Number),h=vb[3]||0;
  const labels=tekstEls.map(x=>String(x.textContent||'').trim());
  zet('idx18',idx18);zet('idx17',idx17);zet('indices',dotIndices.join(',')||'geen');zet('geon',S.geo&&S.geo.n);zet('geoti0',geoTijden[0]||'geen');
  zet('dot17',dot17?'ja':'nee');zet('current',currentEl?'ja':'nee');zet('future-count',toekomstigeIndices.length);zet('paired-count',gekoppeldeLabels.length);zet('missing',missend.length?missend.join(','):'geen');zet('label-missing',labelMissend.length?labelMissend.join(','):'geen');zet('paired-labels',gekoppeldeLabels.map(el=>String(el.textContent||'').trim()).join(','));zet('expected-labels',verwacht.join(','));zet('collision',botsingen.length?botsingen.join('|'):'geen');
  zet('height',h);zet('rain',rain?'ja':'nee');zet('overflow',Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);zet('done','ok');
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},220),{once:true});
</script>`;
html=html.replace("</body>",reporter+"</body>");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-live-chart-"));
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html,"utf8");
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=1660,900","--virtual-time-budget=2800","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:36*1024*1024,timeout:30000});
  if(r.status!==0)throw new Error("browser exit "+r.status+": "+String(r.stderr||"").slice(-1200));
  const dom=r.stdout||"",v=k=>{const m=new RegExp('data-live-chart-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(v('done')!=='ok')throw new Error("reporter: "+v('exception'));
  if(v('current')!=='ja')throw new Error("rode actuele temperatuur nu 20° ontbreekt");
  if(Number(v('idx18'))<0)throw new Error("18:00 ontbreekt uit de zichtbare provider-as; geo.TI0="+v('geoti0'));
  if(v('dot17')!=='nee')throw new Error("17:00-modeluur wordt niet als redundante actuele waarde onderdrukt");
  if(v('missing')!=='geen')throw new Error("niet ieder toekomstig desktopuur heeft een temperatuurpunt/label; ontbrekende indices="+v('missing')+", aanwezig="+v('indices'));
  if(v('label-missing')!=='geen')throw new Error("niet ieder toekomstig desktopuur heeft een koppelbaar zichtbaar temperatuurcijfer; ontbrekende indices="+v('label-missing'));
  if(Number(v('paired-count'))!==Number(v('future-count')))throw new Error("aantal gekoppelde zichtbare temperatuurcijfers is niet gelijk aan aantal toekomstige uren: "+v('paired-count')+" vs "+v('future-count'));
  if(v('paired-labels')!==v('expected-labels'))throw new Error("uurlijkse temperatuurcijfers zijn onvolledig of in verkeerde volgorde: kreeg "+v('paired-labels')+", verwacht "+v('expected-labels'));
  if(v('collision')!=='geen')throw new Error("temperatuurcijfers botsen visueel: "+v('collision'));
  const h=Number(v('height'));if(!(h>=296&&h<=310))throw new Error("desktopgrafiek reserveert nog te veel/te weinig onderruimte: viewBox-hoogte="+h);
  if(v('rain')!=='ja')throw new Error("Q4-regenannotatie ontbreekt in de regenfixture");
  if(Number(v('overflow'))>2)throw new Error("pre-cleanup desktopfixture heeft horizontale overflow: "+v('overflow')+"px");
  console.log("Live chart/layout browserregressie groen vóór bundling: ieder volledig toekomstig desktopuur heeft exact één gekoppeld temperatuurcijfer, zonder onderlinge/nu-labelbotsing; chart viewBox="+h+".");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
