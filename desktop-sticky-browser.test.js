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
  if(process.env.CI){console.error("FOUT sticky: Chrome/Chromium ontbreekt op CI.");process.exit(1);}
  console.log("SKIP sticky: lokaal geen Chrome/Chromium gevonden.");process.exit(0);
}

const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie)){console.error("FOUT sticky: public/index.html ontbreekt.");process.exit(1);}
let html=fs.readFileSync(productie,"utf8");
assertBronInvariant(html,"senior-verstopt","mobiele minibalk bevat auto-hideklasse");
assertBronInvariant(html,"translateY(calc(-100% - 2px))","mobiele minibalk schuift werkelijk buiten beeld");
assertBronInvariant(html,"opacity:0","verborgen mobiele minibalk wordt visueel transparant");
assertBronInvariant(html,"pointer-events:none","verborgen mobiele minibalk onderschept geen interactie");
assertBronInvariant(html,"background:var(--rule-soft)","maanfase heeft een zichtbare subtiele schijf");

/* Deze snelle Chromium-fixture controleert de scroll-state-machine. CSS-transities
   lopen onder --dump-dom/virtual-time niet betrouwbaar door frames heen; de echte
   visuele transform + opacity wordt daarom aanvullend in de Playwright-consumententest
   in Chromium én WebKit gecontroleerd. */
html=html.replace("</head>",'<style>#app{display:block!important}</style><script>window.fetch=()=>new Promise(()=>{});</script></head>');
const reporter=`<script>
setTimeout(()=>{
  try{
    const bar=document.getElementById('minibar'),hero=document.querySelector('.hero'),sheet=document.querySelector('.sheet');
    if(!bar||!hero||!sheet) throw new Error('vereiste DOM ontbreekt');
    document.body.style.minHeight='3600px';
    const mobiel=window.innerWidth<=900,hs=getComputedStyle(hero),voor=hero.getBoundingClientRect();
    const doel=Math.max(0,window.scrollY+voor.bottom+400);
    window.scrollTo(0,doel);
    window.dispatchEvent(new Event('scroll'));
    setTimeout(()=>{
      const bs=getComputedStyle(bar),br=bar.getBoundingClientRect(),sr=sheet.getBoundingClientRect(),hr=hero.getBoundingClientRect();
      const heroVoorbij=hr.bottom<=0,heroOk=hs.alignSelf==='center'&&hs.marginTop==='0px';
      if(!mobiel){
        const breedteOk=Math.abs(br.width-sr.width)<=2,bovenOk=Math.abs(br.top)<=1;
        const balkOk=bar.classList.contains('aan')&&!bar.classList.contains('senior-verstopt')&&bs.display==='flex'&&bs.position==='fixed'&&breedteOk&&bovenOk&&heroVoorbij;
        document.body.dataset.desktopStickyResult=(balkOk&&heroOk)?'ok':'fout';
        document.body.dataset.desktopStickyAan=String(bar.classList.contains('aan'));
        document.body.dataset.desktopStickyVerstopt=String(bar.classList.contains('senior-verstopt'));
        document.body.dataset.desktopStickyDisplay=bs.display;
        document.body.dataset.desktopStickyPosition=bs.position;
        document.body.dataset.desktopStickyBreedte=String(breedteOk);
        document.body.dataset.desktopStickyBoven=String(bovenOk);
        document.body.dataset.desktopStickyHero=String(heroOk);
        document.body.dataset.desktopStickyHeroVoorbij=String(heroVoorbij);
        return;
      }

      const neerwaartsState=bar.classList.contains('aan')&&bar.classList.contains('senior-verstopt')&&bs.pointerEvents==='none'&&heroVoorbij;
      document.body.dataset.mobileStickyNeer=String(neerwaartsState);
      document.body.dataset.mobileStickyAanNeer=String(bar.classList.contains('aan'));
      document.body.dataset.mobileStickyVerstoptNeer=String(bar.classList.contains('senior-verstopt'));
      document.body.dataset.mobileStickyPointerNeer=String(bs.pointerEvents);
      window.scrollTo(0,Math.max(0,window.scrollY-140));
      window.dispatchEvent(new Event('scroll'));
      setTimeout(()=>{
        const bs2=getComputedStyle(bar),hr2=hero.getBoundingClientRect();
        const omhoogState=bar.classList.contains('aan')&&!bar.classList.contains('senior-verstopt')&&bs2.pointerEvents!=='none'&&hr2.bottom<=0;
        document.body.dataset.mobileStickyOmhoog=String(omhoogState);
        document.body.dataset.mobileStickyAanOmhoog=String(bar.classList.contains('aan'));
        document.body.dataset.mobileStickyVerstoptOmhoog=String(bar.classList.contains('senior-verstopt'));
        document.body.dataset.mobileStickyPointerOmhoog=String(bs2.pointerEvents);
        document.body.dataset.mobileStickyResult=(neerwaartsState&&omhoogState)?'ok':'fout';
      },260);
    },520);
  }catch(e){
    const sleutel=window.innerWidth<=900?'mobileSticky':'desktopSticky';
    document.body.dataset[sleutel+'Result']='exception';
    document.body.dataset[sleutel+'Exception']=String(e&&e.message||e);
  }
},180);
</script>`;
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-sticky-"));
const fixture=path.join(dir,"index.html");fs.writeFileSync(fixture,html);
const url="file://"+fixture;

function assertBronInvariant(bron,naald,label){if(!bron.includes(naald))throw new Error("broninvariant ontbreekt: "+label);}
function draai(breedte,hoogte,budget){
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size="+breedte+","+hoogte,"--virtual-time-budget="+budget,"--dump-dom",url],{encoding:"utf8",maxBuffer:16*1024*1024});
  if(r.status!==0)throw new Error("browser exit "+r.status+" "+(r.stderr||"").slice(-1000));
  return r.stdout||"";
}
function waarde(dom,veld){const m=new RegExp('data-'+veld+'="([^"]*)"').exec(dom);return m&&m[1];}

try{
  const desktop=draai(1440,1000,2800);
  if(waarde(desktop,"desktop-sticky-result")!=="ok") throw new Error("desktop resultaat="+waarde(desktop,"desktop-sticky-result")+", aan="+waarde(desktop,"desktop-sticky-aan")+", verstopt="+waarde(desktop,"desktop-sticky-verstopt")+", display="+waarde(desktop,"desktop-sticky-display")+", position="+waarde(desktop,"desktop-sticky-position")+", breedte="+waarde(desktop,"desktop-sticky-breedte")+", boven="+waarde(desktop,"desktop-sticky-boven")+", hero="+waarde(desktop,"desktop-sticky-hero")+", heroVoorbij="+waarde(desktop,"desktop-sticky-hero-voorbij")+", exception="+waarde(desktop,"desktop-sticky-exception"));

  const mobiel=draai(390,844,3600);
  if(waarde(mobiel,"mobile-sticky-result")!=="ok") throw new Error("mobiel resultaat="+waarde(mobiel,"mobile-sticky-result")+", neer="+waarde(mobiel,"mobile-sticky-neer")+", aanNeer="+waarde(mobiel,"mobile-sticky-aan-neer")+", verstoptNeer="+waarde(mobiel,"mobile-sticky-verstopt-neer")+", pointerNeer="+waarde(mobiel,"mobile-sticky-pointer-neer")+", omhoog="+waarde(mobiel,"mobile-sticky-omhoog")+", aanOmhoog="+waarde(mobiel,"mobile-sticky-aan-omhoog")+", verstoptOmhoog="+waarde(mobiel,"mobile-sticky-verstopt-omhoog")+", pointerOmhoog="+waarde(mobiel,"mobile-sticky-pointer-omhoog")+", exception="+waarde(mobiel,"mobile-sticky-exception"));

  console.log("Sticky state-test geslaagd: desktop blijft vast; mobiele hide/show-state wisselt correct.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}