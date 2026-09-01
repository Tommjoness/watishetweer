"use strict";

const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
function vindBrowser(){for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){const r=spawnSync("sh",["-lc","command -v "+n],{encoding:"utf8"});if(r.status===0&&r.stdout.trim())return r.stdout.trim();}return null;}
const browser=vindBrowser();
if(!browser){if(process.env.CI){console.error("FOUT primaire metriekgridbrowsertest: Chrome/Chromium ontbreekt.");process.exit(1);}console.log("SKIP primaire metriekgridbrowsertest: lokaal geen Chrome/Chromium.");process.exit(0);}

const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(productie,"utf8");
const stub=`<script>
try{localStorage.clear();sessionStorage.clear();}catch(e){}
window.fetch=()=>new Promise(()=>{});
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");
const reporter=`<script>
setTimeout(()=>{
  const zet=(k,v)=>document.body.setAttribute('data-'+k,String(v));
  try{
    document.documentElement.classList.remove('wn-progressief');
    const app=document.getElementById('app');if(app){app.classList.remove('wn-progressief');app.removeAttribute('aria-busy');app.style.display='block';}
    const state=document.getElementById('state');if(state)state.style.display='none';
    const grid=document.querySelector('.dashrow-hero .stats')||document.querySelector('.stats');
    const stats=grid?[...grid.children].filter(el=>el.classList&&el.classList.contains('stat')&&getComputedStyle(el).display!=='none'):[];
    const uv=document.getElementById('uv'),uvStat=uv&&uv.closest('.stat'),pres=document.getElementById('pres'),diag=document.getElementById('wiw-pressure-diagnostic');
    const gr=grid&&grid.getBoundingClientRect(),ur=uvStat&&uvStat.getBoundingClientRect();
    const labels=stats.map(el=>(el.querySelector('.eyebrow')?.textContent||'').trim());
    zet('count',stats.length);
    zet('pressure-grid',!!(grid&&pres&&grid.contains(pres)));
    zet('pressure-hidden',!!(diag&&diag.hidden&&diag.getAttribute('aria-hidden')==='true'&&getComputedStyle(diag).display==='none'));
    zet('pressure-label-visible',labels.some(x=>/Luchtdruk/i.test(x)));
    zet('uv-breed',!!(uvStat&&uvStat.classList.contains('breed')));
    zet('uv-width',gr&&ur&&ur.width<=gr.width*0.56?'ok':'fout');
    zet('copy-day',typeof CODES!=='undefined'&&CODES[0]&&CODES[0][0]==='Vrijwel onbewolkt'?'ok':'fout');
    zet('copy-night',typeof CODESNACHT!=='undefined'&&CODESNACHT[0]==='Vrijwel helder'?'ok':'fout');
    zet('overflow',Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth);
    zet('done','ok');
  }catch(e){zet('exception',e&&e.message||e);zet('done','fout');}
},180);
</script>`;
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-primary-grid-"));
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html);
  for(const [w,h] of [[320,1000],[390,1000],[1440,1000]]){
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",`--window-size=${w},${h}`,"--virtual-time-budget=700","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:24*1024*1024});
    if(r.status!==0)throw new Error(`${w}px: browser exit ${r.status}: `+String(r.stderr||"").slice(-800));
    const dom=r.stdout||"",veld=k=>{const m=new RegExp('data-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
    if(veld('done')!=='ok')throw new Error(`${w}px: reporter faalde: ${veld('exception')||'onbekend'}`);
    if(veld('count')!=='8')throw new Error(`${w}px: verwacht 8 zichtbare hoofdtegels, kreeg ${veld('count')}`);
    if(veld('pressure-grid')!=='false'||veld('pressure-label-visible')!=='false'||veld('pressure-hidden')!=='true')throw new Error(`${w}px: luchtdruk is niet correct uit het zichtbare raster gehaald`);
    if(veld('uv-breed')!=='false'||veld('uv-width')!=='ok')throw new Error(`${w}px: UV-tegel is nog breed of beslaat meer dan één kolom`);
    if(veld('copy-day')!=='ok'||veld('copy-night')!=='ok')throw new Error(`${w}px: genuanceerde heldercopy ontbreekt`);
    if(Number(veld('overflow'))>2)throw new Error(`${w}px: ${veld('overflow')}px horizontale overflow`);
    console.log(`${w}px: 8-tegelraster groen; luchtdruk verborgen, UV één kolom, heldercopy genuanceerd, overflow ${veld('overflow')}px.`);
  }
  console.log("Primaire metriekgridbrowsertest geslaagd op 320, 390 en 1440 px.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
