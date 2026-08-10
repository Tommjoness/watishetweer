"use strict";
const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");

function vindBrowser(){
  for(const naam of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    const r=spawnSync("sh",["-lc","command -v "+naam],{encoding:"utf8"});
    if(r.status===0&&r.stdout.trim()) return r.stdout.trim();
  }
  return null;
}
const browser=vindBrowser();
if(!browser){
  if(process.env.CI){console.error("FOUT desktop-sticky: Chrome/Chromium ontbreekt op CI.");process.exit(1);}
  console.log("SKIP desktop-sticky: lokaal geen Chrome/Chromium gevonden.");process.exit(0);
}

const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie)){console.error("FOUT desktop-sticky: public/index.html ontbreekt.");process.exit(1);}
let html=fs.readFileSync(productie,"utf8");
/* De test gaat uitsluitend over layout en scrollgedrag. Een nooit oplossende fetch
   voorkomt externe netwerkafhankelijkheid. De !important-regel maakt #app al
   zichtbaar vóór de productiescriptcode zijn zichtbaarheidshandlers aanmaakt;
   dat bootst de echte situatie na nadat weerdata is geladen, zonder data te hoeven
   vervalsen. */
html=html.replace("</head>",'<style>#app{display:block!important}</style><script>window.fetch=()=>new Promise(()=>{});</script></head>');
const reporter=`<script>
setTimeout(()=>{
  try{
    const bar=document.getElementById('minibar'),hero=document.querySelector('.hero'),sheet=document.querySelector('.sheet');
    if(!bar||!hero||!sheet) throw new Error('vereiste DOM ontbreekt');
    document.body.style.minHeight='3600px';
    const hs=getComputedStyle(hero),voor=hero.getBoundingClientRect();
    /* Niet gokken op 900 px: scroll exact voorbij de werkelijke onderrand van de
       hero plus een marge. Daarmee test deze fixture dezelfde grens als productie. */
    const doel=Math.max(0,window.scrollY+voor.bottom+120);
    window.scrollTo(0,doel);
    window.dispatchEvent(new Event('scroll'));
    setTimeout(()=>{
      const bs=getComputedStyle(bar),br=bar.getBoundingClientRect(),sr=sheet.getBoundingClientRect(),hr=hero.getBoundingClientRect();
      const breedteOk=Math.abs(br.width-sr.width)<=2;
      const bovenOk=Math.abs(br.top)<=1;
      const heroVoorbij=hr.bottom<=0;
      const heroOk=hs.alignSelf==='center'&&hs.marginTop==='0px';
      const balkOk=bar.classList.contains('aan')&&bs.display==='flex'&&bs.position==='fixed'&&breedteOk&&bovenOk&&heroVoorbij;
      document.body.dataset.desktopStickyResult=(balkOk&&heroOk)?'ok':'fout';
      document.body.dataset.desktopStickyAan=String(bar.classList.contains('aan'));
      document.body.dataset.desktopStickyDisplay=bs.display;
      document.body.dataset.desktopStickyPosition=bs.position;
      document.body.dataset.desktopStickyBreedte=String(breedteOk);
      document.body.dataset.desktopStickyBoven=String(bovenOk);
      document.body.dataset.desktopStickyHero=String(heroOk);
      document.body.dataset.desktopStickyHeroVoorbij=String(heroVoorbij);
      document.body.dataset.desktopStickyScroll=String(Math.round(window.scrollY));
      document.body.dataset.desktopStickyHeroBottom=String(Math.round(hr.bottom));
    },500);
  }catch(e){document.body.dataset.desktopStickyResult='exception';document.body.dataset.desktopStickyException=String(e&&e.message||e);}
},150);
</script>`;
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-sticky-"));
const fixture=path.join(dir,"index.html");fs.writeFileSync(fixture,html);
const url="file://"+fixture;
try{
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=1440,1000","--virtual-time-budget=2600","--dump-dom",url],{encoding:"utf8",maxBuffer:16*1024*1024});
  if(r.status!==0)throw new Error("browser exit "+r.status+" "+(r.stderr||"").slice(-1000));
  const dom=r.stdout||"",waarde=veld=>{const m=new RegExp('data-'+veld+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(waarde("desktop-sticky-result")!=="ok") throw new Error("resultaat="+waarde("desktop-sticky-result")+", aan="+waarde("desktop-sticky-aan")+", display="+waarde("desktop-sticky-display")+", position="+waarde("desktop-sticky-position")+", breedte="+waarde("desktop-sticky-breedte")+", boven="+waarde("desktop-sticky-boven")+", hero="+waarde("desktop-sticky-hero")+", heroVoorbij="+waarde("desktop-sticky-hero-voorbij")+", scroll="+waarde("desktop-sticky-scroll")+", heroBottom="+waarde("desktop-sticky-hero-bottom")+", exception="+waarde("desktop-sticky-exception"));
  console.log("Desktop-sticky browsertest geslaagd: balk verschijnt na scrollen en hero is verticaal gecentreerd.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
