"use strict";

const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
function vindBrowser(){for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){const r=spawnSync("sh",["-lc","command -v "+n],{encoding:"utf8"});if(r.status===0&&r.stdout.trim())return r.stdout.trim();}return null;}
const browser=vindBrowser();
if(!browser){if(process.env.CI){console.error("FOUT final visual polish browsertest: Chrome/Chromium ontbreekt.");process.exit(1);}console.log("SKIP final visual polish browsertest: lokaal geen Chrome/Chromium.");process.exit(0);}
const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(productie,"utf8");
const stub=`<script>try{localStorage.clear();sessionStorage.clear();}catch(e){}window.fetch=()=>new Promise(()=>{});try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
html=html.replace("</head>",stub+"</head>");
const reporter=`<script>
setTimeout(()=>{const zet=(k,v)=>document.body.setAttribute('data-final-visual-'+k,String(v));try{
  document.documentElement.classList.remove('wn-progressief');
  const app=document.getElementById('app');if(app){app.classList.remove('wn-progressief');app.removeAttribute('aria-busy');app.style.display='block';}
  const state=document.getElementById('state');if(state)state.style.display='none';
  if(globalThis.WeatherNowFinalDesktopUI20260902&&typeof WeatherNowFinalDesktopUI20260902.render==='function')WeatherNowFinalDesktopUI20260902.render();
  const table=document.getElementById('wiw-hour-table'),scroll=document.getElementById('wiw-hour-scroll');if(!table||!scroll)throw new Error('uurtabel ontbreekt');
  const tbody=table.querySelector('tbody');tbody.innerHTML='';for(let i=0;i<12;i++){const tr=document.createElement('tr');tr.innerHTML='<td>'+(i<10?'0':'')+i+':00</td><td>'+(10+i)+' °C</td><td>'+(9+i)+' °C</td>';tbody.appendChild(tr);}
  const nights=document.getElementById('nights');if(!nights)throw new Error('#nights ontbreekt');
  nights.innerHTML='<div class="row night kop"><div class="dname">Nacht</div><div class="score">Indicatie</div><div class="sbar"></div><div class="nmeta">Bewolking</div><div class="nmeta wide">Beste zichtperiode</div></div><div class="row night"><div class="dname">vannacht</div><div class="score">1/10</div><div class="sbar"><i style="width:10%"></i></div><div class="nmeta"><span class="perc">84%</span> bewolking</div><div class="nmeta wide"><span class="nachtadvies">Ongunstig · Geen gunstig kijkvenster door bewolking.</span><span class="nachtmaan">Maanopkomst om 23:08.</span></div></div>';
  const vis=document.getElementById('vis'),vissub=document.getElementById('vissub');if(vis&&vissub){vis.innerHTML='10+<s>km</s>';vissub.textContent='Goed zicht, meer dan tien kilometer.';}
  if(!globalThis.WeatherNowFinalVisualPolish20260903||typeof WeatherNowFinalVisualPolish20260903.sync!=='function')throw new Error('final visual UX runtime ontbreekt');
  WeatherNowFinalVisualPolish20260903.sync();
  const rr=e=>{const r=e&&e.getBoundingClientRect();return r?{l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height,cx:r.left+r.width/2}:null;};
  const stats=[...document.querySelectorAll('.final-top-grid>.stats .stat')].filter(e=>getComputedStyle(e).display!=='none');
  const values=stats.map(e=>e.querySelector('.sval')).filter(Boolean);
  zet('viewport-width',innerWidth);zet('compact-media',matchMedia('(max-width:430px)').matches?'ja':'nee');
  zet('tiles',stats.length);zet('values-centered',values.length&&values.every(e=>getComputedStyle(e).justifyContent==='center')?'ok':'fout');
  const ss=getComputedStyle(scroll),hs=getComputedStyle(document.documentElement);zet('hour-scrollbar',ss.scrollbarWidth||'');zet('page-scrollbar',hs.scrollbarWidth||'');
  zet('hour-overflow-y',ss.overflowY);zet('hour-role',scroll.getAttribute('role')||'');zet('hour-tabindex',scroll.hasAttribute('tabindex')?'ja':'nee');
  const knop=document.getElementById('wiw-hour-toggle');zet('hour-toggle',knop&&!knop.hidden?'zichtbaar':'verborgen');zet('hour-toggle-expanded',knop&&knop.getAttribute('aria-expanded'));zet('hour-hidden',table.querySelectorAll('tbody tr.wiw-hour-mobile-hidden').length);
  if(innerWidth<=900&&knop&&!knop.hidden){knop.click();zet('hour-expanded-hidden',table.querySelectorAll('tbody tr.wiw-hour-mobile-hidden').length);zet('hour-expanded-state',knop.getAttribute('aria-expanded'));}else{zet('hour-expanded-hidden','nvt');zet('hour-expanded-state','nvt');}
  const kop=nights.querySelector('.row.night.kop'),rij=nights.querySelector('.row.night:not(.kop)'),kw=kop.querySelector('.nmeta.wide'),rw=rij.querySelector('.nmeta.wide'),ka=kop.querySelector('.nmeta:not(.wide)'),ra=rij.querySelector('.nmeta:not(.wide)'),advies=rij.querySelector('.nachtadvies'),bar=rij.querySelector('.sbar');
  const R=rr(rij),KW=rr(kw),RW=rr(rw),KA=rr(ka),RA=rr(ra),ADV=rr(advies),BAR=rr(bar),w=innerWidth;
  zet('night-label',kop.querySelector('.score').textContent.trim());zet('visibility-copy',vissub?vissub.textContent.trim():'');
  const here=document.getElementById('here'),ververs=document.getElementById('ververs'),thema=document.getElementById('thema');zet('here-opacity',here?getComputedStyle(here).opacity:'');zet('refresh-opacity',ververs?getComputedStyle(ververs).opacity:'');zet('theme-opacity',thema?getComputedStyle(thema).opacity:'');
  zet('theme-menu',document.getElementById('themamenu')?'ja':'nee');
  const bodyStyle=getComputedStyle(document.body),sheet=document.querySelector('.sheet'),sheetStyle=sheet&&getComputedStyle(sheet);zet('body-pad-left',parseFloat(bodyStyle.paddingLeft)||0);zet('sheet-pad-left',sheetStyle?parseFloat(sheetStyle.paddingLeft)||0:0);
  zet('overflow',Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);
  if(w>=1100){
    const ws=getComputedStyle(rw);
    zet('night-wide-style',ws.textAlign==='center'&&ws.alignItems==='center'&&ws.display==='flex'?'ok':'fout');
    zet('night-wide-axis',KW&&RW&&Math.abs(KW.cx-RW.cx)<=1?'ok':'fout');
    zet('night-cloud-axis',KA&&RA&&Math.abs(KA.cx-RA.cx)<=1?'ok':'fout');
    zet('night-advice-axis',ADV&&RW&&Math.abs(ADV.cx-RW.cx)<=2?'ok':'fout');
    zet('night-advice-align',getComputedStyle(advies).textAlign);
    zet('night-wide-width',RW?Math.round(RW.w):0);zet('night-bar-width',BAR?Math.round(BAR.w):0);
    zet('night-right-edge',R&&RW&&Math.abs(R.r-RW.r)<=2?'ok':'fout');
  }else{
    zet('night-mobile-wide',getComputedStyle(rw).gridColumnEnd==='-1'?'ok':'fout');
  }
  zet('done','ok');
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},350);
</script>`;
html=html.replace("</body>",reporter+"</body>");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-final-visual-"));
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html,"utf8");
  const viewports=[[320,844],[390,844],[430,932],[1100,900],[1366,900],[1440,900],[1600,900],[1920,1080]];
  for(const [w,h] of viewports){
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",`--window-size=${w},${h}`,"--virtual-time-budget=1300","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:36*1024*1024,timeout:30000});
    if(r.status!==0)throw new Error(`${w}px: browser exit ${r.status}: `+String(r.stderr||"").slice(-1000));
    const dom=r.stdout||"",v=k=>{const m=new RegExp('data-final-visual-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
    if(v('done')!=='ok')throw new Error(`${w}px reporter: ${v('exception')}`);
    const actualW=Number(v('viewport-width'));
    if(v('tiles')!=='8'||v('values-centered')!=='ok')throw new Error(`${w}px: hoofdtegelwaarden niet geometrisch gecentreerd (tiles=${v('tiles')}, values=${v('values-centered')})`);
    if(v('hour-scrollbar')!=='thin'||v('page-scrollbar')!=='thin')throw new Error(`${w}px: scrollbar styling niet actief (hour=${v('hour-scrollbar')}, page=${v('page-scrollbar')})`);
    if(v('night-label')!=='Zichtscore')throw new Error(`${w}px: Nachtzicht gebruikt nog geen duidelijke Zichtscore-label (${v('night-label')})`);
    if(v('visibility-copy')!=='Goed zicht.')throw new Error(`${w}px: redundante zichttekst niet ingekort (${v('visibility-copy')})`);
    if(v('theme-menu')!=='ja')throw new Error(`${w}px: ondersteunde Auto/Licht/Donker-weergave ontbreekt`);
    if(!(Number(v('refresh-opacity'))<Number(v('here-opacity'))&&Number(v('theme-opacity'))<Number(v('here-opacity'))))throw new Error(`${w}px: headerhiërarchie ontbreekt (locatie=${v('here-opacity')}, ververs=${v('refresh-opacity')}, weergave=${v('theme-opacity')})`);
    if(Number(v('overflow'))>2)throw new Error(`${w}px: ${v('overflow')}px horizontale overflow`);
    if(actualW<=900){
      if(v('hour-overflow-y')!=='visible'||v('hour-role')!==''||v('hour-tabindex')!=='nee')throw new Error(`${w}px: mobiele uurtabel is nog een geneste scroller (overflow=${v('hour-overflow-y')}, role=${v('hour-role')}, tabindex=${v('hour-tabindex')})`);
      if(v('hour-toggle')!=='zichtbaar'||v('hour-toggle-expanded')!=='false'||v('hour-hidden')!=='4')throw new Error(`${w}px: mobiele 8-uurs preview klopt niet (toggle=${v('hour-toggle')}, expanded=${v('hour-toggle-expanded')}, hidden=${v('hour-hidden')})`);
      if(v('hour-expanded-hidden')!=='0'||v('hour-expanded-state')!=='true')throw new Error(`${w}px: uitklappen uren werkt niet (hidden=${v('hour-expanded-hidden')}, state=${v('hour-expanded-state')})`);
      if(v('night-mobile-wide')!=='ok')throw new Error(`${w}px: mobiele Nachtzicht-flow is geraakt`);
      if(v('compact-media')==='ja'&&(Number(v('body-pad-left'))>8.5||Math.abs(Number(v('sheet-pad-left'))-16)>.5))throw new Error(`${w}px: mobiele horizontale ruimte niet optimaal (body=${v('body-pad-left')}, sheet=${v('sheet-pad-left')})`);
    }else{
      if(v('hour-overflow-y')!=='auto'||v('hour-role')!=='region'||v('hour-tabindex')!=='ja'||v('hour-toggle')!=='verborgen')throw new Error(`${w}px: desktop uurtabelgedrag is geraakt (overflow=${v('hour-overflow-y')}, role=${v('hour-role')}, tabindex=${v('hour-tabindex')}, toggle=${v('hour-toggle')})`);
      if(v('night-wide-style')!=='ok'||v('night-wide-axis')!=='ok'||v('night-cloud-axis')!=='ok'||v('night-advice-axis')!=='ok'||v('night-right-edge')!=='ok')throw new Error(`${w}px: Nachtzicht-uitlijning fout wide=${v('night-wide-style')}/${v('night-wide-axis')} cloud=${v('night-cloud-axis')} advice=${v('night-advice-axis')} edge=${v('night-right-edge')}`);
      if(v('night-advice-align')!=='left')throw new Error(`${w}px: lange Nachtzicht-uitleg niet links uitgelijnd (${v('night-advice-align')})`);
      if(Number(v('night-wide-width'))<280)throw new Error(`${w}px: Beste zichtperiode te smal (${v('night-wide-width')}px)`);
      if(Number(v('night-bar-width'))<180)throw new Error(`${w}px: zichtscorebalk te smal (${v('night-bar-width')}px)`);
    }
    console.log(`${w}px (CSS viewport ${actualW}px): final visual UX groen; overflow ${v('overflow')}px, urenpreview en headerhiërarchie correct${actualW>=1100?', zichtperiode '+v('night-wide-width')+'px':''}.`);
  }
  console.log("Final visual polish browsertest geslaagd op de aangevraagde 320/390/430/1100/1366/1440/1600/1920 vensters; asserts volgen de gemeten CSS-viewport.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
