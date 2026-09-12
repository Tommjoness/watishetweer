"use strict";

const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
function vindBrowser(){for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){const r=spawnSync(n,["--version"],{encoding:"utf8"});if(r.status===0)return n;}return null;}
const browser=vindBrowser();
if(!browser){if(process.env.CI){console.error("FOUT late live-screenshot browsertest: Chrome/Chromium ontbreekt.");process.exit(1);}console.log("SKIP late live-screenshot browsertest: lokaal geen Chrome/Chromium.");process.exit(0);}
const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(productie,"utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"");
if(!html.includes('id="wiw-live-screenshot-polish-20260912"'))throw new Error("late live-screenshot stylesheet ontbreekt in finale artifact");
/* Deze test zit expres ná delivery-cleanup. De app-runtime is daar gebundeld en
   niet global; verwijder scripts zodat dit uitsluitend de geleverde DOM/CSS meet. */
html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<script\b[^>]*\/>/gi,"");
const reporter=`<script>
window.addEventListener('DOMContentLoaded',()=>{const zet=(k,v)=>document.body.setAttribute('data-live-shot-'+k,String(v));try{
  const brief=document.querySelector('.brief'),footer=document.querySelector('footer'),aq=document.getElementById('aq'),chips=document.querySelector('.chips'),svg=document.getElementById('chart');
  let nav=document.querySelector('body > .seo-plaatsnav');if(!nav){nav=document.createElement('nav');nav.className='seo-plaatsnav';nav.innerHTML='<div class="seo-plaatsnav-inner">Populaire plaatsen in Nederland</div>';document.body.appendChild(nav);}
  if(!svg)throw new Error('#chart ontbreekt');
  const ns='http://www.w3.org/2000/svg',rain=document.createElementNS(ns,'g');rain.setAttribute('data-q4-rain-periods','1');svg.appendChild(rain);
  zet('chips-margin',chips?parseFloat(getComputedStyle(chips).marginTop):0);zet('brief-margin',brief?parseFloat(getComputedStyle(brief).marginTop):0);zet('brief-padding',brief?parseFloat(getComputedStyle(brief).paddingTop):0);zet('footer-font',footer?parseFloat(getComputedStyle(footer).fontSize):0);zet('footer-line',footer?parseFloat(getComputedStyle(footer).lineHeight):0);zet('nav-margin',parseFloat(getComputedStyle(nav).marginTop)||0);zet('aq-pad',aq?parseFloat(getComputedStyle(aq).paddingLeft):0);zet('rain-transform',getComputedStyle(rain).transform);zet('overflow',Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);zet('done','ok');
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}}, {once:true});
</script>`;
html=html.replace("</body>",reporter+"</body>");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-live-shot-css-"));
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html,"utf8");
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=1660,900","--virtual-time-budget=1200","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:24*1024*1024,timeout:20000});
  if(r.status!==0)throw new Error("browser exit "+r.status+": "+String(r.stderr||"").slice(-1200));
  const dom=r.stdout||"",v=k=>{const m=new RegExp('data-live-shot-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(v('done')!=='ok')throw new Error("reporter: "+v('exception'));
  if(Math.abs(Number(v('chips-margin'))-12)>.6)throw new Error("bewaarde-plaatsen/topritme is niet 12px: "+v('chips-margin'));
  if(Math.abs(Number(v('brief-margin'))-18)>.6||Math.abs(Number(v('brief-padding'))-18)>.6)throw new Error("bovenste desktopruimte is niet 18/18px: "+v('brief-margin')+"/"+v('brief-padding'));
  if(Number(v('footer-font'))<12.9||Number(v('footer-line'))<19)throw new Error("footer is nog te klein/dicht: "+v('footer-font')+"px / "+v('footer-line')+"px");
  if(Math.abs(Number(v('nav-margin'))-10)>.6)throw new Error("zachte plaatsnav-overgang is niet 10px: "+v('nav-margin'));
  if(Math.abs(Number(v('aq-pad'))-18)>.6)throw new Error("AQI/pollenrij is onbedoeld opnieuw gewijzigd: padding="+v('aq-pad'));
  if(v('rain-transform')!=='none')throw new Error("oude visuele regen-transform is nog actief: "+v('rain-transform'));
  if(Number(v('overflow'))>2)throw new Error("finale statische desktop-DOM heeft horizontale overflow: "+v('overflow')+"px");
  console.log("Late screenshot browserregressie groen ná bundling: top/footer/plaatsnav gemeten, AQI ongemoeid en regen-transform geneutraliseerd.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
