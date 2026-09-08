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
 const place=document.getElementById('place');if(place)place.innerHTML='Almere<span id="plaatstijd" aria-hidden="true">23:18</span>';
 let seo=document.querySelector('.seo-plaatsnav');if(!seo){seo=document.createElement('nav');seo.className='seo-plaatsnav';seo.innerHTML='<div class="seo-plaatsnav-inner"><strong class="seo-plaatsnav-kop">Populaire plaatsen in Nederland</strong><div class="seo-plaatsnav-links"><a href="#">Almere</a></div></div>';document.body.appendChild(seo);}
 const nights=document.getElementById('nights');if(nights)nights.innerHTML='<div class="row night"><div class="dname">vannacht</div><div class="score">0/10</div><div class="sbar"></div><div class="nmeta"><span class="perc">100%</span></div><div class="nmeta wide"><span class="nachtadvies">Ongunstig · Geen gunstig kijkvenster door bewolking.</span><span class="nachtmaan">◯ Maanopkomst om 03:08.</span></div></div>';
 const TI=Array.from({length:24},(_,i)=>i<11?'2026-09-02T'+String(i+13).padStart(2,'0')+':00':'2026-09-03T'+String(i-11).padStart(2,'0')+':00');
 const precipitation=TI.map(()=>0);precipitation[2]=null;
 S.d={timezone:'Europe/Amsterdam',utc_offset_seconds:7200,current:{time:'2026-09-02T13:27'},hourly:{time:TI,temperature_2m:TI.map((_,i)=>18-i*.1),apparent_temperature:TI.map((_,i)=>16-i*.1),precipitation_probability:TI.map((_,i)=>i%4?35:0),precipitation,weather_code:TI.map((_,i)=>i%3?3:61),is_day:TI.map((_,i)=>i<8?1:0),wind_speed_10m:TI.map((_,i)=>12+i),wind_direction_10m:TI.map(()=>225)}};
 /* Deze fixture is bewust alleen eigenaar van de desktoprange en geometrie.
    Exacte grafiek/tabel-bronuren worden in de production-style CWV- en
    klokgates met volledige S.geo-state geverifieerd. */
 S.klokInstantOverride=new Date('2026-09-02T11:27:00Z');S.geo={TI,T:S.d.hourly.temperature_2m,A:S.d.hourly.apparent_temperature,P:S.d.hourly.precipitation_probability,MM:S.d.hourly.precipitation};S.dag=null;S.bereik=24;
 const kandidaten=WeatherNowFinalDesktopUI20260902.komendeUurRijen(S.d,S.klokInstantOverride.getTime(),12);
 const wacht=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const meet=()=>{const rows=[...document.querySelectorAll('#wiw-hour-table tbody tr')],panel=document.getElementById('wiw-hour-panel'),main=document.querySelector('.wiw-chart-main'),layout=document.getElementById('wiw-chart-layout'),scroll=document.getElementById('wiw-hour-scroll'),table=document.getElementById('wiw-hour-table'),last=rows.at(-1),pr=panel?.getBoundingClientRect(),mr=main?.getBoundingClientRect(),gr=layout?.getBoundingClientRect(),tr=table?.getBoundingClientRect(),lr=last?.getBoundingClientRect();return {count:rows.length,first:rows[0]?.querySelector('time')?.textContent.trim()||'',last:last?.querySelector('time')?.textContent.trim()||'',mm:rows.map(r=>r.querySelector('.wiw-hour-rain .wiw-hour-primary')?.textContent.trim()||''),panelHeight:pr?.height||0,mainHeight:mr?.height||0,layoutWidth:gr?.width||0,mainWidth:mr?.width||0,panelWidth:pr?.width||0,lastBottom:lr?.bottom||0,panelBottom:pr?.bottom||0,tableBottom:tr?.bottom||0,rowHeights:rows.map(r=>r.getBoundingClientRect().height),overflow:scroll?getComputedStyle(scroll).overflowY:'',panelTitle:document.getElementById('wiw-hour-title')?.textContent||'',panelVisibility:panel?getComputedStyle(panel).visibility:'',layoutColumns:layout?getComputedStyle(layout).gridTemplateColumns:'',chartTitle:document.getElementById('chartlab')?.textContent||'',headers:[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim()).join('|'),rowShape:rows.every(r=>r.children.length===5),icons:rows.filter(r=>r.querySelector('.wiw-hour-weather-icon svg')).length,rich:rows.every(r=>r.querySelector('.wiw-hour-temp .wiw-hour-secondary')&&r.querySelector('.wiw-hour-rain .wiw-hour-secondary')&&r.querySelector('.wiw-hour-wind .wiw-hour-secondary')),graphCount:S.geo&&S.geo.TI?S.geo.TI.length:0,graphFirst:S.geo&&S.geo.TI&&S.geo.TI[0]};};
 WeatherNowFinalDesktopUI20260902.render();await new Promise(resolve=>setTimeout(resolve,160));WeatherNowFinalDesktopUI20260902.render();await wacht();
 const basis=meet();const main=document.querySelector('.wiw-chart-main'),natuurlijk=main?.getBoundingClientRect().height||0;
 if(main)main.style.height=(natuurlijk+80)+'px';WeatherNowFinalDesktopUI20260902.render();await wacht();const groter=meet();
 if(main)main.style.height='';WeatherNowFinalDesktopUI20260902.render();await wacht();
 const finalPlace=document.getElementById('place'),placeStyle=finalPlace?getComputedStyle(finalPlace):null;
 const finalSeoInner=document.querySelector('.seo-plaatsnav-inner'),seoInnerStyle=finalSeoInner?getComputedStyle(finalSeoInner):null,seoKop=finalSeoInner?.querySelector('.seo-plaatsnav-kop'),seoLinks=finalSeoInner?.querySelector('.seo-plaatsnav-links'),sir=finalSeoInner?.getBoundingClientRect(),skr=seoKop?.getBoundingClientRect(),slr=seoLinks?.getBoundingClientRect(),wide=document.querySelector('#nights .row.night .nmeta.wide'),advies=document.querySelector('#nights .nachtadvies'),maan=document.querySelector('#nights .nachtmaan'),wr=wide?.getBoundingClientRect(),ar=advies?.getBoundingClientRect(),moonr=maan?.getBoundingClientRect();
 zet('candidates',kandidaten.length);zet('candidate-first',kandidaten[0]?String(kandidaten[0].tijd).slice(11,16):'');zet('candidate-last',kandidaten.at(-1)?String(kandidaten.at(-1).tijd).slice(11,16):'');
 for(const [prefix,m] of [['base',basis],['grown',groter]]){zet(prefix+'-rows',m.count);zet(prefix+'-first',m.first);zet(prefix+'-last',m.last);zet(prefix+'-panel-height',m.panelHeight.toFixed(1));zet(prefix+'-main-height',m.mainHeight.toFixed(1));zet(prefix+'-layout-width',m.layoutWidth.toFixed(1));zet(prefix+'-main-width',m.mainWidth.toFixed(1));zet(prefix+'-panel-width',m.panelWidth.toFixed(1));zet(prefix+'-fits',m.lastBottom<=m.panelBottom+1?'ok':'fout');zet(prefix+'-table-tight',Math.abs(m.tableBottom-m.lastBottom)<=2?'ok':'fout');zet(prefix+'-panel-fill',Math.abs(m.panelBottom-m.tableBottom)<=3?'ok':'fout');zet(prefix+'-row-min',m.rowHeights.length?Math.min(...m.rowHeights).toFixed(1):'0');zet(prefix+'-row-max',m.rowHeights.length?Math.max(...m.rowHeights).toFixed(1):'0');zet(prefix+'-overflow',m.overflow);zet(prefix+'-panel-title',m.panelTitle);zet(prefix+'-panel-visibility',m.panelVisibility);zet(prefix+'-layout-columns',m.layoutColumns);zet(prefix+'-chart-title',m.chartTitle);zet(prefix+'-headers',m.headers);zet(prefix+'-row-shape',m.rowShape?'ok':'fout');zet(prefix+'-icons',m.icons);zet(prefix+'-rich',m.rich?'ok':'fout');zet(prefix+'-graph-count',m.graphCount);zet(prefix+'-graph-first',m.graphFirst||'');}
 zet('zero-first',basis.mm[0]||'');zet('missing-second',basis.mm[1]||'');
 zet('place-left-inset',placeStyle?parseFloat(placeStyle.paddingLeft)||0:0);zet('place-right-inset',placeStyle?parseFloat(placeStyle.paddingRight)||0:0);zet('seo-left-padding',seoInnerStyle?parseFloat(seoInnerStyle.paddingLeft)||0:0);zet('seo-right-padding',seoInnerStyle?parseFloat(seoInnerStyle.paddingRight)||0:0);zet('seo-content-left-gap',sir&&skr?(skr.left-sir.left).toFixed(1):'0');zet('seo-content-right-gap',sir&&slr?(sir.right-slr.right).toFixed(1):'0');
 zet('night-display',wide?getComputedStyle(wide).display:'');zet('night-moon-right-gap',wr&&moonr?(wr.right-moonr.right).toFixed(1):'999');zet('night-separated',ar&&moonr&&ar.right<=moonr.left+1?'ok':'fout');zet('done','ok');
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},{once:true});
</script>`;
const bodyEinde=/<\/body>\s*<\/html>\s*$/i;if(!bodyEinde.test(html))throw new Error("public/index.html heeft geen afgesloten body voor browserfixture");html=html.replace(bodyEinde,reporter+"</body>\n</html>");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-hour-refine-"));
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html);
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=1600,900","--virtual-time-budget=4000","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:36*1024*1024});
  if(r.status!==0)throw new Error(`browser exit ${r.status}: `+String(r.stderr||"").slice(-800));
  const dom=r.stdout||"",v=k=>{const m=new RegExp('data-hour-refine-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(v('done')!=='ok')throw new Error("reporter: "+v('exception'));
  if(v('candidates')!=='12'||v('candidate-first')!=='14:00'||v('candidate-last')!=='01:00')throw new Error(`12-uurs kandidaatvenster fout: count=${v('candidates')} first=${v('candidate-first')} last=${v('candidate-last')}`);
  const basis=Number(v('base-rows')),groter=Number(v('grown-rows')),kandidaten=Number(v('candidates'));
  if(!(basis>=8&&basis<=12))throw new Error(`natuurlijke grafiekhoogte levert geen comfortabele 8–12 uurregels: rows=${basis}`);
  if(!(groter>=basis&&groter<=kandidaten))throw new Error(`uurbron reageert onjuist op extra grafiekhoogte: basis=${basis} groter=${groter}`);
  if(basis<kandidaten&&groter<=basis)throw new Error(`extra beschikbare grafiekhoogte levert geen extra volledig uur terwijl kandidaten over zijn: basis=${basis} groter=${groter}`);
  for(const prefix of ['base','grown']){
    if(v(prefix+'-first')!=='14:00')throw new Error(`${prefix}: eerste uur verschoof onverwacht naar ${v(prefix+'-first')}`);
    if(v(prefix+'-fits')!=='ok'||v(prefix+'-table-tight')!=='ok'||v(prefix+'-panel-fill')!=='ok')throw new Error(`${prefix}: uurpaneel bevat een halve/lege onderste rij of loos ondervlak`);
    if(Math.abs(Number(v(prefix+'-panel-height'))-Number(v(prefix+'-main-height')))>1)throw new Error(`${prefix}: tabel en grafiekhoogte sluiten niet aan (${v(prefix+'-panel-height')} vs ${v(prefix+'-main-height')})`);
    const aandeel=Number(v(prefix+'-main-width'))/(Number(v(prefix+'-main-width'))+Number(v(prefix+'-panel-width')));
    if(!(aandeel>=.65&&aandeel<=.72))throw new Error(`${prefix}: grafiekaandeel ${aandeel.toFixed(3)} buiten 65–72%`);
    if(Number(v(prefix+'-row-min'))<29||Number(v(prefix+'-row-max'))>46)throw new Error(`${prefix}: uurregels zijn te smal of te ruim (${v(prefix+'-row-min')}–${v(prefix+'-row-max')}px)`);
    if(v(prefix+'-overflow')!=='visible')throw new Error(`${prefix}: interne desktopscrollbar is niet uitgeschakeld (${v(prefix+'-overflow')})`);
    if(v(prefix+'-panel-title')!=='Komende uren')throw new Error(`${prefix}: uurtitel is niet Komende uren`);
    if(v(prefix+'-panel-visibility')!=='visible')throw new Error(`${prefix}: rijke uurkolom is niet zichtbaar (${v(prefix+'-panel-visibility')})`);
    if(v(prefix+'-headers')!=='Tijd|Weer|Temp.|Neerslag|Wind'||v(prefix+'-row-shape')!=='ok'||v(prefix+'-rich')!=='ok'||Number(v(prefix+'-icons'))!==Number(v(prefix+'-rows')))throw new Error(`${prefix}: rijke vijfkolomstabel mist weer/gevoel/neerslagkans/wind`);
    if(v(prefix+'-graph-count')!=='24'||v(prefix+'-graph-first')!=='2026-09-02T13:00')throw new Error(`${prefix}: tabelmeting heeft de natuurlijke grafiekrange gewijzigd`);
    if(v(prefix+'-chart-title')!=='Komende uren')throw new Error(`${prefix}: grafiekkop is niet Komende uren (${v(prefix+'-chart-title')})`);
  }
  if(v('zero-first')!=='0,0 mm'||v('missing-second')!=='–')throw new Error(`0 mm/missing-semantiek fout: first=${v('zero-first')} second=${v('missing-second')}`);
  const plaatsLinks=Number(v('place-left-inset')),plaatsRechts=Number(v('place-right-inset'));
  if(plaatsLinks<26||plaatsRechts<26||Math.abs(plaatsLinks-plaatsRechts)>1)throw new Error(`plaats/tijd missen symmetrische binnenruimte: links=${v('place-left-inset')} rechts=${v('place-right-inset')}`);
  const seoLinks=Number(v('seo-left-padding')),seoRechts=Number(v('seo-right-padding')),seoContentLinks=Number(v('seo-content-left-gap')),seoContentRechts=Number(v('seo-content-right-gap'));
  if(seoLinks<24||seoRechts<24||seoContentLinks<24||seoContentRechts<24)throw new Error(`SEO-plaatsnavigatie mist veilige inhoudsinset: padding=${v('seo-left-padding')}/${v('seo-right-padding')} content=${v('seo-content-left-gap')}/${v('seo-content-right-gap')}`);
  if(v('night-display')!=='grid'||v('night-separated')!=='ok'||Math.abs(Number(v('night-moon-right-gap')))>2)throw new Error(`Nachtzicht-meta is intern niet stabiel: display=${v('night-display')} separated=${v('night-separated')} rightGap=${v('night-moon-right-gap')}`);
  console.log(`Desktoprefinement groen op 1600×900: natuurlijke grafiek links en rijke Komende-uren-tabel rechts met ${basis} volledige regels (${groter} bij +80px), echte weer/gevoel/neerslag/winddata en compacte Nachtzicht-groepering.`);
}finally{fs.rmSync(dir,{recursive:true,force:true});}

/* Gerichte eindmatrix voor de twee UI-correcties van 2026-09-08. De bestaande
   1600px-regressie hierboven blijft ongewijzigd; deze matrix voegt uitsluitend
   de gevraagde contractbreedtes toe. */
let matrixHtml=fs.readFileSync(productie,"utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"");
matrixHtml=matrixHtml.replace("</head>",stub+"</head>");
const matrixReporter=`<script>
document.addEventListener('DOMContentLoaded',async()=>{const zet=(k,v)=>document.body.setAttribute('data-hour-matrix-'+k,String(v));try{
 document.documentElement.classList.remove('wn-progressief');const app=document.getElementById('app');if(app){app.classList.remove('wn-progressief');app.removeAttribute('aria-busy');app.style.display='block';app.style.visibility='visible';}const state=document.getElementById('state');if(state)state.style.display='none';
 const TI=Array.from({length:24},(_,i)=>i<11?'2026-09-02T'+String(i+13).padStart(2,'0')+':00':'2026-09-03T'+String(i-11).padStart(2,'0')+':00');
 S.d={timezone:'Europe/Amsterdam',utc_offset_seconds:7200,current:{time:'2026-09-02T13:27'},hourly:{time:TI,temperature_2m:TI.map((_,i)=>18.2-i*.1),apparent_temperature:TI.map((_,i)=>16.6-i*.1),precipitation_probability:TI.map((_,i)=>i%4?35:0),precipitation:TI.map(()=>0),weather_code:TI.map((_,i)=>i%3?3:61),is_day:TI.map((_,i)=>i<8?1:0),wind_speed_10m:TI.map((_,i)=>12+i),wind_direction_10m:TI.map(()=>225)}};
 S.klokInstantOverride=new Date('2026-09-02T11:27:00Z');S.geo={TI,T:S.d.hourly.temperature_2m,A:S.d.hourly.apparent_temperature,P:S.d.hourly.precipitation_probability,MM:S.d.hourly.precipitation};S.dag=null;S.bereik=24;
 WeatherNowFinalDesktopUI20260902.render();await new Promise(resolve=>setTimeout(resolve,160));WeatherNowFinalDesktopUI20260902.render();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const desktop=innerWidth>=1100,rows=[...document.querySelectorAll('#wiw-hour-table tbody tr')],scroll=document.getElementById('wiw-hour-scroll'),panel=document.getElementById('wiw-hour-panel'),last=rows.at(-1),lr=last?.getBoundingClientRect(),pr=panel?.getBoundingClientRect(),temp=rows[0]?.querySelector('.wiw-hour-temp'),prim=temp?.querySelector('.wiw-hour-primary'),sec=temp?.querySelector('.wiw-hour-secondary'),rr=prim?.getBoundingClientRect(),sr=sec?.getBoundingClientRect(),ps=prim?getComputedStyle(prim):null,ss=sec?getComputedStyle(sec):null;
 zet('desktop',desktop?'1':'0');zet('rows',rows.length);zet('first',rows[0]?.querySelector('time')?.textContent.trim()||'');zet('overflow',Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);zet('internal-overflow',scroll?getComputedStyle(scroll).overflowY:'');zet('current',rows.filter(r=>r.dataset.current==='1').length);zet('marker',document.body.innerText.toUpperCase().includes('EERSTVOLGEND')?'visible':'absent');
 zet('fits',!desktop||!lr||!pr||lr.bottom<=pr.bottom+1?'ok':'fout');zet('temp-nowrap',desktop&&temp&&getComputedStyle(temp).whiteSpace==='nowrap'?'ok':desktop?'fout':'nvt');zet('temp-inline',desktop&&rr&&sr&&ps&&ss&&ps.display==='inline'&&ss.display==='inline'&&sr.left>=rr.right-1?'ok':desktop?'fout':'nvt');zet('temp-overflow',desktop&&temp?Math.max(0,temp.scrollWidth-temp.clientWidth):0);zet('done','ok');
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},{once:true});
</script>`;
if(!bodyEinde.test(matrixHtml))throw new Error("public/index.html heeft geen afgesloten body voor uurcorrectiematrix");matrixHtml=matrixHtml.replace(bodyEinde,matrixReporter+"</body>\n</html>");
const matrixDir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-hour-matrix-"));
try{
  const pad=path.join(matrixDir,"index.html");fs.writeFileSync(pad,matrixHtml);
  for(const [w,h] of [[320,900],[360,900],[390,900],[400,900],[430,932],[1366,768],[1660,900],[1920,1080]]){
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",`--window-size=${w},${h}`,"--virtual-time-budget=4000","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:36*1024*1024});
    if(r.status!==0)throw new Error(`${w}px matrix browser exit ${r.status}: `+String(r.stderr||"").slice(-800));
    const dom=r.stdout||"",v=k=>{const m=new RegExp('data-hour-matrix-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
    if(v('done')!=='ok')throw new Error(`${w}px matrix reporter: ${v('exception')}`);
    if(Number(v('overflow'))>2)throw new Error(`${w}px: ${v('overflow')}px horizontale overflow`);
    if(v('marker')!=='absent')throw new Error(`${w}px: EERSTVOLGEND is nog zichtbaar`);
    if(w>=1100){
      const n=Number(v('rows'));if(!(n>=8&&n<=12))throw new Error(`${w}px: ${n} volledige desktopregels, verwacht 8–12`);
      if(v('first')!=='14:00')throw new Error(`${w}px: eerste tabeluur ${v('first')} i.p.v. 14:00`);
      if(v('internal-overflow')!=='visible')throw new Error(`${w}px: interne desktopscrollbar niet uitgeschakeld (${v('internal-overflow')})`);
      if(v('fits')!=='ok')throw new Error(`${w}px: onderste uurregel valt buiten het paneel`);
      if(v('temp-nowrap')!=='ok'||v('temp-inline')!=='ok'||Number(v('temp-overflow'))>1)throw new Error(`${w}px: gevoelstemperatuur is niet één regel zonder celoverflow (nowrap=${v('temp-nowrap')} inline=${v('temp-inline')} overflow=${v('temp-overflow')})`);
    }else{
      if(v('rows')!=='24')throw new Error(`${w}px: mobiele uurtabel wijzigde inhoudelijk (${v('rows')} regels)`);
      if(v('current')!=='1')throw new Error(`${w}px: bestaande nadruk op eerste relevante mobiele uurregel ging verloren`);
    }
    console.log(`${w}px uurcorrectiematrix groen: ${v('rows')} rijen, overflow ${v('overflow')}px, Eerstvolgend ${v('marker')}.`);
  }
}finally{fs.rmSync(matrixDir,{recursive:true,force:true});}