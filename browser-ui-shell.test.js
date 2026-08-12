"use strict";

const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
function vindBrowser(){
  for(const naam of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    const r=spawnSync("sh",["-lc","command -v "+naam],{encoding:"utf8"});
    if(r.status===0&&r.stdout.trim())return r.stdout.trim();
  }
  return null;
}
const browser=vindBrowser();
if(!browser){
  if(process.env.CI){console.error("FOUT UI-shell: Chrome/Chromium ontbreekt op CI.");process.exit(1);}
  console.log("SKIP UI-shell: lokaal geen Chrome/Chromium gevonden.");process.exit(0);
}

const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie)){console.error("FOUT UI-shell: public/index.html ontbreekt.");process.exit(1);}
let html=fs.readFileSync(productie,"utf8");
/* Deze fixture toetst uitsluitend de reeds opgebouwde UI-shell. Netwerk faalt
   direct en deterministisch; de controle zelf draait synchroon nadat de normale
   WeatherNow-runtime is geëvalueerd, zodat --dump-dom niet van timers afhangt. */
html=html.replace("</head>",'<script>try{localStorage.removeItem("weerbriefing.thema");}catch(e){};window.fetch=async()=>({ok:false,status:503,json:async()=>({}),text:async()=>""});</script></head>');
const reporter=`<script>
(()=>{
  try{
    const knop=document.getElementById('thema'),menu=document.getElementById('themamenu'),favicon=document.querySelector('link[rel="icon"]');
    const zoek=document.getElementById('res'),invoer=document.getElementById('q');
    const opties=menu?[...menu.querySelectorAll('[data-thema-keuze]')]:[];
    const uniek=new Set(opties.map(x=>x.dataset.themaKeuze)).size===4;
    const begin=!!(knop&&menu&&menu.hidden&&knop.getAttribute('aria-expanded')==='false'&&knop.textContent.trim()==='Weergave · auto');
    if(zoek)zoek.classList.add('on');if(invoer)invoer.setAttribute('aria-expanded','true');
    knop.click();
    const open=!menu.hidden&&knop.getAttribute('aria-expanded')==='true';
    const zoekSluit=!!(zoek&&invoer&&!zoek.classList.contains('on')&&invoer.getAttribute('aria-expanded')==='false');
    const autoOpt=menu.querySelector('[data-thema-keuze="auto"]'),lichtOpt=menu.querySelector('[data-thema-keuze="licht"]');
    const focusBegin=document.activeElement===autoOpt;
    menu.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
    const pijlOk=document.activeElement===lichtOpt;
    const donker=menu.querySelector('[data-thema-keuze="donker"]');
    donker.click();
    const donkerOk=document.documentElement.getAttribute('data-thema')==='donker'&&menu.hidden&&knop.textContent.trim()==='Weergave · donker'&&donker.getAttribute('aria-checked')==='true';
    knop.click();
    const rood=menu.querySelector('[data-thema-keuze="rood"]');
    rood.click();
    const roodOk=document.documentElement.getAttribute('data-thema')==='rood'&&menu.hidden&&knop.textContent.trim()==='Weergave · rood'&&rood.getAttribute('aria-checked')==='true';
    knop.click();
    const auto=menu.querySelector('[data-thema-keuze="auto"]');
    auto.click();
    const autoOk=document.documentElement.getAttribute('data-thema')==='licht'&&knop.textContent.trim()==='Weergave · auto'&&auto.getAttribute('aria-checked')==='true'&&/dag\/nacht/i.test(auto.textContent||'');
    const knopLeesbaar=knop.scrollWidth<=knop.clientWidth+1;
    knop.click();
    const r=menu.getBoundingClientRect();
    const binnen=r.left>=-1&&r.right<=window.innerWidth+1;
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    const escapeOk=menu.hidden&&knop.getAttribute('aria-expanded')==='false';
    const favOk=!!(favicon&&String(favicon.getAttribute('href')||'').startsWith('data:image/svg+xml,')&&decodeURIComponent(favicon.getAttribute('href')).includes('<circle cx="32" cy="32" r="11"'));
    const goed=begin&&open&&zoekSluit&&focusBegin&&pijlOk&&donkerOk&&roodOk&&autoOk&&knopLeesbaar&&uniek&&binnen&&escapeOk&&favOk;
    document.body.dataset.uiShellResult=goed?'ok':'fout';
    document.body.dataset.uiShellDiag=JSON.stringify({begin,open,zoekSluit,focusBegin,pijlOk,donkerOk,roodOk,autoOk,knopLeesbaar,uniek,binnen,escapeOk,favOk,breedte:window.innerWidth,knop:knop&&knop.textContent,menuHidden:menu&&menu.hidden});
  }catch(e){document.body.dataset.uiShellResult='exception';document.body.dataset.uiShellDiag=String(e&&e.message||e);}
})();
</script>`;
if(!html.includes("</body>"))throw new Error("UI-shell browserfixture kan body-afsluiting niet vinden.");
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-ui-shell-"));
const fixture=path.join(dir,"index.html");fs.writeFileSync(fixture,html);
const url="file://"+fixture;
function draai(breedte){
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size="+breedte+",900","--virtual-time-budget=1000","--dump-dom",url],{encoding:"utf8",maxBuffer:16*1024*1024});
  if(r.status!==0)throw new Error("browser exit "+r.status+" "+(r.stderr||"").slice(-1000));
  const dom=r.stdout||"",m=/data-ui-shell-result="([^"]+)"/.exec(dom),d=/data-ui-shell-diag="([^"]*)"/.exec(dom);
  if(!m||m[1]!=="ok")throw new Error("UI-shell "+breedte+" px resultaat="+(m&&m[1])+" diag="+(d&&d[1])+" stderr="+(r.stderr||"").slice(-500));
}
try{
  draai(390);draai(1280);
  console.log("UI-shell browsercontrole geslaagd op 390 px en 1280 px.");
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}
