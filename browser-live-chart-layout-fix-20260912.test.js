"use strict";

const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
function vindBrowser(){return require("./scripts/vind-browser.js").vindBrowser();}
const browser=vindBrowser();
if(!browser){if(process.env.CI){console.error("FOUT live-chart-layout browsertest: Chrome/Chromium ontbreekt.");process.exit(1);}console.log("SKIP live-chart-layout browsertest: lokaal geen Chrome/Chromium.");process.exit(0);}
const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(productie,"utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"");
if(!html.includes("LIVE CHART LABEL FIX 20260912")||!html.includes("LIVE Q4 CHART COMPACTION 20260912")||!html.includes("LIVE CHART COPY CLEANUP 20260916"))throw new Error("pre-cleanup chart/layout-copy-fix ontbreekt in het te testen artifact");
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
  const currentMarker=!!svg.querySelector('line[stroke="var(--carmine)"]')&&!!svg.querySelector('circle[fill="var(--carmine)"]');
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
  const zonEl=document.getElementById('suntimes'),zonTekst=String(zonEl&&zonEl.textContent||'').replace(/\\s+/g,' ').trim();
  zet('idx18',idx18);zet('idx17',idx17);zet('indices',dotIndices.join(',')||'geen');zet('geon',S.geo&&S.geo.n);zet('geoti0',geoTijden[0]||'geen');
  zet('dot17',dot17?'ja':'nee');zet('current',currentEl?'ja':'nee');zet('marker',currentMarker?'ja':'nee');zet('future-count',toekomstigeIndices.length);zet('paired-count',gekoppeldeLabels.length);zet('missing',missend.length?missend.join(','):'geen');zet('label-missing',labelMissend.length?labelMissend.join(','):'geen');zet('paired-labels',gekoppeldeLabels.map(el=>String(el.textContent||'').trim()).join(','));zet('expected-labels',verwacht.join(','));zet('collision',botsingen.length?botsingen.join('|'):'geen');
  zet('sun-copy',zonTekst);zet('height',h);zet('rain',rain?'ja':'nee');zet('overflow',Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);zet('done','ok');
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
  if(v('current')!=='nee'||v('marker')!=='ja')throw new Error("desktop herhaalt de actuele temperatuur of mist de rode tijdlijn/stip");
  if(Number(v('idx18'))<0)throw new Error("18:00 ontbreekt uit de zichtbare provider-as; geo.TI0="+v('geoti0'));
  if(v('dot17')!=='nee')throw new Error("17:00-modeluur wordt niet als redundante actuele waarde onderdrukt");
  if(v('missing')!=='geen')throw new Error("niet ieder toekomstig desktopuur heeft een temperatuurpunt/label; ontbrekende indices="+v('missing')+", aanwezig="+v('indices'));
  if(v('label-missing')!=='geen')throw new Error("niet ieder toekomstig desktopuur heeft een koppelbaar zichtbaar temperatuurcijfer; ontbrekende indices="+v('label-missing'));
  if(Number(v('paired-count'))!==Number(v('future-count')))throw new Error("aantal gekoppelde zichtbare temperatuurcijfers is niet gelijk aan aantal toekomstige uren: "+v('paired-count')+" vs "+v('future-count'));
  if(v('paired-labels')!==v('expected-labels'))throw new Error("uurlijkse temperatuurcijfers zijn onvolledig of in verkeerde volgorde: kreeg "+v('paired-labels')+", verwacht "+v('expected-labels'));
  if(v('collision')!=='geen')throw new Error("temperatuurcijfers botsen visueel: "+v('collision'));
  const zon=v('sun-copy')||'';
  if(/\b\d+ uur(?: en \d+ minu(?:ut|ten))? daglicht\b/i.test(zon))throw new Error("gewone numerieke daglengte staat nog boven de grafiek: "+zon);
  if(!/zon onder 20:01/i.test(zon)||!/zon op 07:07/i.test(zon))throw new Error("relevante zonsopkomst/-ondergangcopy is bij daglengtecleanup verloren gegaan: "+zon);
  const h=Number(v('height'));if(!(h>=296&&h<=310))throw new Error("desktopgrafiek reserveert nog te veel/te weinig onderruimte: viewBox-hoogte="+h);
  if(v('rain')!=='ja')throw new Error("Q4-regenannotatie ontbreekt in de regenfixture");
  if(Number(v('overflow'))>2)throw new Error("pre-cleanup desktopfixture heeft horizontale overflow: "+v('overflow')+"px");
  console.log("Live chart/layout browserregressie groen vóór bundling: nu-markering houdt de actuele temperatuur, gewone daglengte is uit de grafiekkop en ieder volledig toekomstig desktopuur houdt exact één gekoppeld temperatuurcijfer; chart viewBox="+h+".");
}finally{fs.rmSync(dir,{recursive:true,force:true});}

/* Mobiele regressie uit live screenshot 17 september: het laatste tijdlabel mag
   niet buiten de SVG vallen en een temperatuurcijfer mag door collision-lagen
   nooit los van zijn eigen datapunt komen te zweven. We forceren beide slechte
   geometrieën direct na etmaal(); de bestaande async mobiele polish moet ze
   daarna zelfstandig herstellen. */
let mobielHtml=fs.readFileSync(productie,"utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"");
mobielHtml=mobielHtml.replace("</head>",stub+"</head>");
const mobielReporter=`<script>
window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{const zet=(k,v)=>document.body.setAttribute('data-mobile-edge-'+k,String(v));try{
  document.documentElement.classList.remove('wn-progressief');const app=document.getElementById('app');if(app){app.style.display='block';app.style.visibility='visible';app.classList.remove('wn-progressief');}const state=document.getElementById('state');if(state)state.style.display='none';
  if(typeof S==='undefined'||typeof etmaal!=='function')throw new Error('mobiele runtimeglobals ontbreken');
  const tijden=['2026-09-17T21:00','2026-09-17T22:00','2026-09-17T23:00','2026-09-18T00:00','2026-09-18T01:00','2026-09-18T02:00','2026-09-18T03:00','2026-09-18T04:00','2026-09-18T05:00','2026-09-18T06:00','2026-09-18T07:00','2026-09-18T08:00','2026-09-18T09:00','2026-09-18T10:00','2026-09-18T11:00','2026-09-18T12:00','2026-09-18T13:00','2026-09-18T14:00','2026-09-18T15:00','2026-09-18T16:00','2026-09-18T17:00','2026-09-18T18:00','2026-09-18T19:00','2026-09-18T20:00'];
  const temp=[15.3,15.4,14.9,14.5,14.1,14.0,14.1,13.7,13.2,14.0,14.8,15.4,15.8,16.4,17.0,17.6,18.0,18.2,18.4,18.2,17.8,17.1,17.1,16.7];
  const wind=tijden.map(()=>12),richting=tijden.map(()=>220),code=tijden.map(()=>3),dag=tijden.map((_,i)=>i>=10&&i<=21?1:0),kans=tijden.map((_,i)=>i===1?75:i===0?86:20),mm=tijden.map((_,i)=>i===1?4:0);
  S.d={timezone:'Europe/Amsterdam',utc_offset_seconds:7200,current:{time:'2026-09-17T20:44',temperature_2m:15.5,is_day:0},hourly:{time:tijden,temperature_2m:temp,apparent_temperature:temp.map(v=>v-.3),precipitation_probability:kans,precipitation:mm,wind_speed_10m:wind,wind_gusts_10m:wind.map(v=>v+4),cloud_cover:tijden.map(()=>55),weather_code:code,is_day:dag,wind_direction_10m:richting},daily:{time:['2026-09-17','2026-09-18'],sunrise:['2026-09-17T07:17','2026-09-18T07:19'],sunset:['2026-09-17T19:51','2026-09-18T19:48']}};
  S.dag=null;S.bereik=24;S.i0=0;S.klokInstantOverride=new Date('2026-09-17T18:44:00Z');
  etmaal(0,24);
  const svg=document.getElementById('chart'),g=S.geo;if(!svg||!g||!g.M)throw new Error('mobiele grafiekgeometrie ontbreekt');
  /* De basisrender kan vóór de async mobiele post-renderpass nog kale uren (20)
     bevatten. Dat is juist de lifecycle die we willen testen: forceer de fout
     vóór normalisatie, zodat de resterende +120/+350ms-passes hem moeten herstellen. */
  const pb=Number(g.pt)+Number(g.ih),uren=[...svg.querySelectorAll('text')].filter(el=>/^(?:[01]?\\d|2[0-3])(?::00)?$/.test(String(el.textContent||'').trim())&&Number(el.getAttribute('y'))>=pb+6);
  const laatste=uren.sort((a,b)=>Number(a.getAttribute('x'))-Number(b.getAttribute('x'))).at(-1);if(!laatste)throw new Error('mobiel laatste uur-aslabel ontbreekt vóór post-rendernormalisatie');
  laatste.setAttribute('x',String(Number(g.W)-1));laatste.setAttribute('text-anchor','middle');
  const temps=[...svg.querySelectorAll('text')].filter(el=>/Bodoni Moda/.test(String(el.getAttribute('font-family')||''))&&/^-?\\d+°$/.test(String(el.textContent||'').trim())).sort((a,b)=>Number(a.getAttribute('x'))-Number(b.getAttribute('x')));
  const zwevend=temps.at(-1);if(!zwevend)throw new Error('mobiel temperatuurlabel ontbreekt');
  zwevend.setAttribute('y',String(Number(g.pt)+2));zwevend.setAttribute('x',String(Number(g.W)-1));zwevend.setAttribute('text-anchor','middle');
  setTimeout(()=>{try{
    const W=Number(g.W),aslabels=[...svg.querySelectorAll('text')].filter(el=>/^\\d{2}:00$/.test(String(el.textContent||'').trim())&&Number(el.getAttribute('y'))>=pb+6);
    const buiten=aslabels.filter(el=>{const b=el.getBBox();return b.x<-.5||b.x+b.width>W+.5;});
    const punten=[...svg.querySelectorAll('circle[data-temp-index]')].map(el=>({i:Number(el.getAttribute('data-temp-index')),x:Number(el.getAttribute('cx')),y:Number(el.getAttribute('cy'))})).filter(p=>Number.isInteger(p.i)&&Number.isFinite(p.x)&&Number.isFinite(p.y));
    const tlabels=[...svg.querySelectorAll('text')].filter(el=>/Bodoni Moda/.test(String(el.getAttribute('font-family')||''))&&/^-?\\d+°$/.test(String(el.textContent||'').trim()));
    let maxDy=0;for(const el of tlabels){const m=/^(-?\\d+)°$/.exec(String(el.textContent||'').trim()),x=Number(el.getAttribute('x')),y=Number(el.getAttribute('y'));if(!m||!Number.isFinite(x)||!Number.isFinite(y))continue;const doel=Number(m[1]);let beste=null,d=Infinity;for(const p of punten){if(Math.round(Number(g.T[p.i]))!==doel)continue;const dx=Math.abs(p.x-x);if(dx<d){d=dx;beste=p;}}if(beste)maxDy=Math.max(maxDy,Math.abs(y-beste.y));}
    zet('axis-overflow',buiten.length?buiten.map(el=>el.textContent).join(','):'geen');zet('max-temp-dy',maxDy.toFixed(1));zet('edge-adjusted',svg.querySelectorAll('[data-mobile-edge-adjusted="1"]').length);zet('detached-fixed',svg.querySelectorAll('[data-mobile-detached-temp-fixed="1"]').length);zet('done','ok');
  }catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},650);
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},180),{once:true});
</script>`;
mobielHtml=mobielHtml.replace("</body>",mobielReporter+"</body>");
const mobielDir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-mobile-chart-edge-"));
try{
  const pad=path.join(mobielDir,"index.html");fs.writeFileSync(pad,mobielHtml,"utf8");
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=402,900","--virtual-time-budget=3600","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:36*1024*1024,timeout:30000});
  if(r.status!==0)throw new Error("mobiele browser exit "+r.status+": "+String(r.stderr||"").slice(-1200));
  const dom=r.stdout||"",v=k=>{const m=new RegExp('data-mobile-edge-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(v('done')!=='ok')throw new Error("mobiele reporter: "+v('exception'));
  if(v('axis-overflow')!=='geen')throw new Error("mobiel uur-aslabel valt buiten de chart-viewBox: "+v('axis-overflow'));
  if(Number(v('max-temp-dy'))>42.5)throw new Error("mobiel temperatuurcijfer raakt visueel los van datapunt; max dy="+v('max-temp-dy'));
  if(Number(v('edge-adjusted'))<1)throw new Error("mobiele rechterrandcorrectie is niet uitgevoerd");
  if(Number(v('detached-fixed'))<1)throw new Error("mobiele zwevende-temperatuurcorrectie is niet uitgevoerd");
  console.log("Mobiele chart-edge regressie groen: laatste HH:00-label blijft volledig binnen de SVG en temperatuurcijfers blijven binnen 42 px van hun datapunt.");
}finally{fs.rmSync(mobielDir,{recursive:true,force:true});}
