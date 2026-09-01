"use strict";
const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
function vindBrowser(){for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){const r=spawnSync("sh",["-lc","command -v "+n],{encoding:"utf8"});if(r.status===0&&r.stdout.trim())return r.stdout.trim();}return null;}
const browser=vindBrowser();
if(!browser){if(process.env.CI){console.error("FOUT finale auditbrowsertest: Chrome/Chromium ontbreekt.");process.exit(1);}console.log("SKIP finale auditbrowsertest: lokaal geen Chrome/Chromium.");process.exit(0);}
const productie=path.join(__dirname,"public","index.html");if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(productie,"utf8");
const stub=`<script>try{localStorage.clear();sessionStorage.clear();}catch(e){}window.fetch=()=>new Promise(()=>{});try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
html=html.replace("</head>",stub+"</head>");
const reporter=`<script>
setTimeout(()=>{
 const zet=(k,v)=>document.body.setAttribute('data-final-'+k,String(v));
 try{
  document.documentElement.classList.remove('wn-progressief');
  const app=document.getElementById('app');if(app){app.classList.remove('wn-progressief');app.removeAttribute('aria-busy');app.style.display='block';}
  const state=document.getElementById('state');if(state)state.style.display='none';
  const grid=document.querySelector('.final-top-grid'),stats=grid&&grid.querySelector(':scope > .stats'),left=grid&&grid.querySelector(':scope > .final-top-left');
  const tegels=stats?[...stats.children].filter(el=>el.classList&&el.classList.contains('stat')&&getComputedStyle(el).display!=='none'):[];
  const rects=tegels.map(el=>el.getBoundingClientRect());
  const uniek=(xs,tol=3)=>{const u=[];for(const x of xs){if(!u.some(y=>Math.abs(y-x)<=tol))u.push(x);}return u;};
  const breed=window.innerWidth,desktop=breed>=1100;
  zet('grid',!!grid);zet('count',tegels.length);zet('cols',uniek(rects.map(r=>r.left)).length);zet('rows',uniek(rects.map(r=>r.top)).length);
  if(grid&&stats){const gr=grid.getBoundingClientRect(),sr=stats.getBoundingClientRect();zet('right-top',Math.abs(sr.top-gr.top)<=3?'ok':'fout');zet('stats-width',sr.width);}
  zet('desktop-display',grid?getComputedStyle(grid).display:'geen');
  const dagmod=document.querySelector('.dashrow-chart .dagmod');if(dagmod)zet('chart-width',Math.round(dagmod.getBoundingClientRect().width));
  if(!desktop){
   const doelen=[document.querySelector('input[type=text]'),document.getElementById('here'),document.getElementById('ververs'),document.getElementById('thema')].filter(Boolean);
   zet('touch',doelen.every(el=>el.getBoundingClientRect().height>=43.5)?'ok':'fout');
  }
  const ov=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth;zet('overflow',Math.round(ov));zet('done','ok');
 }catch(e){zet('exception',e&&e.message||e);zet('done','fout');}
},220);
</script>`;
html=html.replace("</body>",reporter+"</body>");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-final-audit-"));
try{
 const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html);
 for(const [w,h] of [[320,1100],[360,1100],[390,1100],[430,1100],[1440,1100],[1920,1200]]){
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",`--window-size=${w},${h}`,"--virtual-time-budget=900","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:28*1024*1024});
  if(r.status!==0)throw new Error(`${w}px: browser exit ${r.status}: `+String(r.stderr||"").slice(-800));
  const dom=r.stdout||"",veld=k=>{const m=new RegExp('data-final-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(veld('done')!=='ok')throw new Error(`${w}px: reporter faalde: ${veld('exception')||'onbekend'}`);
  if(veld('grid')!=='true'||veld('count')!=='8')throw new Error(`${w}px: finale topgrid/8 tegels ontbreekt (${veld('grid')}, ${veld('count')})`);
  if(veld('cols')!=='2'||veld('rows')!=='4')throw new Error(`${w}px: verwacht 2×4 tegelgeometrie, kreeg ${veld('cols')}×${veld('rows')}`);
  if(Number(veld('overflow'))>2)throw new Error(`${w}px: ${veld('overflow')}px horizontale overflow`);
  if(w>=1100){if(veld('desktop-display')!=='grid'||veld('right-top')!=='ok')throw new Error(`${w}px: rechter tegelkolom begint niet bovenaan naast briefing/hero`);if(Number(veld('chart-width'))>1282)throw new Error(`${w}px: grafiek blijft te breed (${veld('chart-width')}px)`);}else if(veld('touch')!=='ok')throw new Error(`${w}px: primaire mobiele touchdoelen zijn kleiner dan 44px`);
  console.log(`${w}px: topgrid 2×4 groen, overflow ${veld('overflow')}px${w>=1100?`, grafiek ${veld('chart-width')}px`:', touchdoelen ≥44px'}.`);
 }
 console.log("Finale auditbrowsertest geslaagd op 320/360/390/430/1440/1920 px.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
