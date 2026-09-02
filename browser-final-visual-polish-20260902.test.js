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
  document.documentElement.classList.remove('wn-progressief');const app=document.getElementById('app');if(app){app.classList.remove('wn-progressief');app.removeAttribute('aria-busy');app.style.display='block';}
  const state=document.getElementById('state');if(state)state.style.display='none';
  if(globalThis.WeatherNowFinalDesktopUI20260902&&typeof WeatherNowFinalDesktopUI20260902.render==='function')WeatherNowFinalDesktopUI20260902.render();
  const nights=document.getElementById('nights');if(!nights)throw new Error('#nights ontbreekt');
  nights.innerHTML='<div class="row night kop"><div class="dname">Nacht</div><div class="score">Indicatie</div><div class="sbar"></div><div class="nmeta">Bewolking</div><div class="nmeta wide">Beste zichtperiode</div></div><div class="row night"><div class="dname">vannacht</div><div class="score">1/10</div><div class="sbar"><i style="width:10%"></i></div><div class="nmeta"><span class="perc">84%</span> bewolking</div><div class="nmeta wide"><span class="nachtadvies">Ongunstig · Geen gunstig kijkvenster door bewolking.</span><span class="nachtmaan">Maanopkomst om 23:08.</span></div></div>';
  const rr=e=>{const r=e&&e.getBoundingClientRect();return r?{l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height,cx:r.left+r.width/2}:null;};
  const stats=[...document.querySelectorAll('.final-top-grid>.stats .stat')].filter(e=>getComputedStyle(e).display!=='none');
  const values=stats.map(e=>e.querySelector('.sval')).filter(Boolean);
  zet('tiles',stats.length);zet('values-centered',values.length&&values.every(e=>getComputedStyle(e).justifyContent==='center')?'ok':'fout');
  const scroll=document.getElementById('wiw-hour-scroll');if(!scroll)throw new Error('#wiw-hour-scroll ontbreekt');
  const ss=getComputedStyle(scroll),hs=getComputedStyle(document.documentElement);zet('hour-scrollbar',ss.scrollbarWidth||'');zet('page-scrollbar',hs.scrollbarWidth||'');
  const kop=nights.querySelector('.row.night.kop'),rij=nights.querySelector('.row.night:not(.kop)'),kw=kop.querySelector('.nmeta.wide'),rw=rij.querySelector('.nmeta.wide'),ka=kop.querySelector('.nmeta:not(.wide)'),ra=rij.querySelector('.nmeta:not(.wide)'),advies=rij.querySelector('.nachtadvies'),bar=rij.querySelector('.sbar');
  const R=rr(rij),KW=rr(kw),RW=rr(rw),KA=rr(ka),RA=rr(ra),ADV=rr(advies),BAR=rr(bar),w=innerWidth;
  zet('overflow',Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);
  if(w>=1100){
    const ws=getComputedStyle(rw);
    zet('night-wide-style',ws.textAlign==='center'&&ws.alignItems==='center'&&ws.display==='flex'?'ok':'fout');
    zet('night-wide-axis',KW&&RW&&Math.abs(KW.cx-RW.cx)<=1?'ok':'fout');
    zet('night-cloud-axis',KA&&RA&&Math.abs(KA.cx-RA.cx)<=1?'ok':'fout');
    zet('night-advice-axis',ADV&&RW&&Math.abs(ADV.cx-RW.cx)<=2?'ok':'fout');
    zet('night-wide-width',RW?Math.round(RW.w):0);zet('night-bar-width',BAR?Math.round(BAR.w):0);
    zet('night-right-edge',R&&RW&&Math.abs(R.r-RW.r)<=2?'ok':'fout');
  }else{
    zet('night-mobile-wide',getComputedStyle(rw).gridColumnEnd==='-1'?'ok':'fout');
  }
  zet('done','ok');
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},300);
</script>`;
html=html.replace("</body>",reporter+"</body>");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-final-visual-"));
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html,"utf8");
  for(const [w,h] of [[390,900],[1100,900],[1366,900],[1440,900],[1920,1080]]){
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",`--window-size=${w},${h}`,"--virtual-time-budget=1100","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:36*1024*1024,timeout:30000});
    if(r.status!==0)throw new Error(`${w}px: browser exit ${r.status}: `+String(r.stderr||"").slice(-1000));
    const dom=r.stdout||"",v=k=>{const m=new RegExp('data-final-visual-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
    if(v('done')!=='ok')throw new Error(`${w}px reporter: ${v('exception')}`);
    if(v('tiles')!=='8'||v('values-centered')!=='ok')throw new Error(`${w}px: hoofdtegelwaarden niet geometrisch gecentreerd (tiles=${v('tiles')}, values=${v('values-centered')})`);
    if(v('hour-scrollbar')!=='thin'||v('page-scrollbar')!=='thin')throw new Error(`${w}px: scrollbar styling niet actief (hour=${v('hour-scrollbar')}, page=${v('page-scrollbar')})`);
    if(Number(v('overflow'))>2)throw new Error(`${w}px: ${v('overflow')}px horizontale overflow`);
    if(w>=1100){
      if(v('night-wide-style')!=='ok'||v('night-wide-axis')!=='ok'||v('night-cloud-axis')!=='ok'||v('night-advice-axis')!=='ok'||v('night-right-edge')!=='ok')throw new Error(`${w}px: Nachtzicht-uitlijning fout wide=${v('night-wide-style')}/${v('night-wide-axis')} cloud=${v('night-cloud-axis')} advice=${v('night-advice-axis')} edge=${v('night-right-edge')}`);
      if(Number(v('night-wide-width'))<280)throw new Error(`${w}px: Beste zichtperiode te smal (${v('night-wide-width')}px)`);
      if(Number(v('night-bar-width'))<180)throw new Error(`${w}px: indicatiebalk te smal (${v('night-bar-width')}px)`);
    }else if(v('night-mobile-wide')!=='ok')throw new Error(`${w}px: mobiele Nachtzicht-flow is geraakt`);
    console.log(`${w}px: visual polish groen; waarden gecentreerd, scrollbars thin, overflow ${v('overflow')}px${w>=1100?', zichtperiode '+v('night-wide-width')+'px':''}.`);
  }
  console.log("Final visual polish browsertest geslaagd op 390/1100/1366/1440/1920 px.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
