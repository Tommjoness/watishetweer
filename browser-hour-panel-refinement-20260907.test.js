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
 S.d={timezone:'Europe/Amsterdam',utc_offset_seconds:7200,current:{time:'2026-09-02T13:27'},hourly:{time:TI,temperature_2m:TI.map((_,i)=>18-i*.1),apparent_temperature:TI.map((_,i)=>18-i*.1),precipitation_probability:TI.map(()=>0),precipitation}};
 S.klokInstantOverride=new Date('2026-09-02T11:27:00Z');S.geo={TI,T:S.d.hourly.temperature_2m,A:S.d.hourly.apparent_temperature,P:S.d.hourly.precipitation_probability,MM:S.d.hourly.precipitation};S.dag=null;
 const kandidaten=WeatherNowFinalDesktopUI20260902.komendeUurRijen(S.d,S.klokInstantOverride.getTime(),24);
 const wacht=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const meet=()=>{const rows=[...document.querySelectorAll('#wiw-hour-table tbody tr')],panel=document.getElementById('wiw-hour-panel'),main=document.querySelector('.wiw-chart-main'),scroll=document.getElementById('wiw-hour-scroll'),table=document.getElementById('wiw-hour-table'),last=rows.at(-1),pr=panel?.getBoundingClientRect(),mr=main?.getBoundingClientRect(),tr=table?.getBoundingClientRect(),lr=last?.getBoundingClientRect();return {count:rows.length,first:rows[0]?.querySelector('time')?.textContent.trim()||'',last:last?.querySelector('time')?.textContent.trim()||'',mm:rows.map(r=>r.children[3]?.textContent.trim()||''),sourceTimes:rows.map(r=>S.d.hourly.time[Number(r.dataset.sourceIndex)]),graphTimes:[...(S.geo?.TI||[])],panelHeight:pr?.height||0,mainHeight:mr?.height||0,lastBottom:lr?.bottom||0,panelBottom:pr?.bottom||0,tableBottom:tr?.bottom||0,rowHeights:rows.map(r=>r.getBoundingClientRect().height),overflow:scroll?getComputedStyle(scroll).overflowY:'',title:document.getElementById('wiw-hour-title')?.textContent||''};};
 WeatherNowFinalDesktopUI20260902.render();await new Promise(resolve=>setTimeout(resolve,160));WeatherNowFinalDesktopUI20260902.render();await wacht();
 const basis=meet();const main=document.querySelector('.wiw-chart-main'),natuurlijk=main?.getBoundingClientRect().height||0;
 if(main)main.style.height=(natuurlijk+80)+'px';WeatherNowFinalDesktopUI20260902.render();await wacht();const groter=meet();
 if(main)main.style.height='';WeatherNowFinalDesktopUI20260902.render();await wacht();
 const finalPlace=document.getElementById('place'),placeStyle=finalPlace?getComputedStyle(finalPlace):null;
 const finalSeoInner=document.querySelector('.seo-plaatsnav-inner'),seoInnerStyle=finalSeoInner?getComputedStyle(finalSeoInner):null,seoKop=finalSeoInner?.querySelector('.seo-plaatsnav-kop'),seoLinks=finalSeoInner?.querySelector('.seo-plaatsnav-links'),sir=finalSeoInner?.getBoundingClientRect(),skr=seoKop?.getBoundingClientRect(),slr=seoLinks?.getBoundingClientRect(),wide=document.querySelector('#nights .row.night .nmeta.wide'),advies=document.querySelector('#nights .nachtadvies'),maan=document.querySelector('#nights .nachtmaan'),wr=wide?.getBoundingClientRect(),ar=advies?.getBoundingClientRect(),moonr=maan?.getBoundingClientRect();
 zet('candidates',kandidaten.length);zet('candidate-first',kandidaten[0]?String(kandidaten[0].tijd).slice(11,16):'');zet('candidate-last',kandidaten.at(-1)?String(kandidaten.at(-1).tijd).slice(11,16):'');
 for(const [prefix,m] of [['base',basis],['grown',groter]]){zet(prefix+'-rows',m.count);zet(prefix+'-first',m.first);zet(prefix+'-last',m.last);zet(prefix+'-panel-height',m.panelHeight.toFixed(1));zet(prefix+'-main-height',m.mainHeight.toFixed(1));zet(prefix+'-fits',m.lastBottom<=m.panelBottom+1?'ok':'fout');zet(prefix+'-table-tight',Math.abs(m.tableBottom-m.lastBottom)<=2?'ok':'fout');zet(prefix+'-match',JSON.stringify(m.graphTimes)===JSON.stringify(m.sourceTimes)?'ok':'fout');zet(prefix+'-row-min',m.rowHeights.length?Math.min(...m.rowHeights).toFixed(1):'0');zet(prefix+'-row-max',m.rowHeights.length?Math.max(...m.rowHeights).toFixed(1):'0');zet(prefix+'-overflow',m.overflow);zet(prefix+'-title',m.title);}
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
  if(Number(v('candidates'))<20||v('candidate-first')!=='14:00'||v('candidate-last')!=='12:00')throw new Error(`24-uurs bronkandidaatset fout: count=${v('candidates')} first=${v('candidate-first')} last=${v('candidate-last')}`);
  const basis=Number(v('base-rows')),groter=Number(v('grown-rows'));
  if(!(basis>=4&&basis<Number(v('candidates'))))throw new Error(`natuurlijke hoogte levert geen begrensde volledige uurset: rows=${basis} candidates=${v('candidates')}`);
  if(!(groter>basis&&groter<=Number(v('candidates'))))throw new Error(`zichtbare uren reageren niet op extra beschikbare hoogte: basis=${basis} groter=${groter}`);
  for(const prefix of ['base','grown']){
    if(v(prefix+'-first')!=='14:00')throw new Error(`${prefix}: eerste uur verschoof onverwacht naar ${v(prefix+'-first')}`);
    if(v(prefix+'-fits')!=='ok'||v(prefix+'-table-tight')!=='ok')throw new Error(`${prefix}: halve/lege onderste rij of overflow`);
    if(v(prefix+'-match')!=='ok')throw new Error(`${prefix}: grafiek en tabel tonen niet exact dezelfde bronuren`);
    if(Math.abs(Number(v(prefix+'-panel-height'))-Number(v(prefix+'-main-height')))>1)throw new Error(`${prefix}: uurpaneel en grafiekhoogte sluiten niet aan (${v(prefix+'-panel-height')} vs ${v(prefix+'-main-height')})`);
    if(Number(v(prefix+'-row-min'))<18||Number(v(prefix+'-row-max'))>22)throw new Error(`${prefix}: uurregels zijn te smal of te ruim (${v(prefix+'-row-min')}–${v(prefix+'-row-max')}px)`);
    if(v(prefix+'-overflow')!=='visible')throw new Error(`${prefix}: interne desktopscrollbar is niet uitgeschakeld (${v(prefix+'-overflow')})`);
    if(v(prefix+'-title')!=='Temperatuur en neerslag per uur')throw new Error(`${prefix}: titel gewijzigd`);
  }
  if(v('zero-first')!=='0,0 mm'||v('missing-second')!=='–')throw new Error(`0 mm/missing-semantiek fout: first=${v('zero-first')} second=${v('missing-second')}`);
  const plaatsLinks=Number(v('place-left-inset')),plaatsRechts=Number(v('place-right-inset'));
  if(plaatsLinks<26||plaatsRechts<26||Math.abs(plaatsLinks-plaatsRechts)>1)throw new Error(`plaats/tijd missen symmetrische binnenruimte: links=${v('place-left-inset')} rechts=${v('place-right-inset')}`);
  const seoLinks=Number(v('seo-left-padding')),seoRechts=Number(v('seo-right-padding')),seoContentLinks=Number(v('seo-content-left-gap')),seoContentRechts=Number(v('seo-content-right-gap'));
  if(seoLinks<24||seoRechts<24||seoContentLinks<24||seoContentRechts<24)throw new Error(`SEO-plaatsnavigatie mist veilige inhoudsinset: padding=${v('seo-left-padding')}/${v('seo-right-padding')} content=${v('seo-content-left-gap')}/${v('seo-content-right-gap')}`);
  if(v('night-display')!=='grid'||v('night-separated')!=='ok'||Math.abs(Number(v('night-moon-right-gap')))>2)throw new Error(`Nachtzicht benut brede rechterruimte niet: display=${v('night-display')} separated=${v('night-separated')} rightGap=${v('night-moon-right-gap')}`);
  console.log(`Desktoprefinement groen op 1600×900: ${basis} volledige uurregels op natuurlijke hoogte en ${groter} na +80px; rijcount is hoogtegestuurd, grafiek/tabel blijven exact gelijk, paneelhoogtes sluiten aan en de regels blijven leesbaar zonder interne scrollbar.`);
}finally{fs.rmSync(dir,{recursive:true,force:true});}