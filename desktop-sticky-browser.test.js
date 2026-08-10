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
assertBronInvariant(html,"pointer-events:none","verborgen mobiele minibalk onderschept geen interactie");
assertBronInvariant(html,"background:var(--rule-soft)","maanfase heeft een zichtbare subtiele schijf");

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
    const mobiel=window.innerWidth<=900,hs=getComputedStyle(hero),voor=hero.getBoundingClientRect();
    /* Niet gokken op een vaste scrollafstand: scroll exact voorbij de werkelijke
       onderrand van de hero plus een marge. Daarmee test deze fixture dezelfde
       grens als productie. */
    const doel=Math.max(0,window.scrollY+voor.bottom+180);
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

      /* CSS-transities worden in headless dump-DOM niet in iedere runner op exact
         hetzelfde geometrische tussenframe afgerekend. Het productdoel is visueel:
         bij neerwaarts lezen mag de balk de inhoud niet meer bedekken. Daarom eisen
         we runtime de actieve hide-class + vrijwel nul opacity + geen pointer-events;
         de volledige translateY(-100%) is hierboven apart als broninvariant geborgd. */
      const opacityNeer=parseFloat(bs.opacity),transformNeer=bs.transform,pointerNeer=bs.pointerEvents;
      const neerwaartsVerborgen=bar.classList.contains('aan')&&bar.classList.contains('senior-verstopt')&&opacityNeer<0.1&&pointerNeer==='none'&&heroVoorbij;
      document.body.dataset.mobileStickyNeer=String(neerwaartsVerborgen);
      document.body.dataset.mobileStickyAanNeer=String(bar.classList.contains('aan'));
      document.body.dataset.mobileStickyVerstoptNeer=String(bar.classList.contains('senior-verstopt'));
      document.body.dataset.mobileStickyOpacityNeer=String(opacityNeer);
      document.body.dataset.mobileStickyTransformNeer=String(transformNeer);
      document.body.dataset.mobileStickyPointerNeer=String(pointerNeer);
      document.body.dataset.mobileStickyBottomNeer=String(Math.round(br.bottom));
      window.scrollTo(0,Math.max(0,window.scrollY-140));
      window.dispatchEvent(new Event('scroll'));
      setTimeout(()=>{
        const bs2=getComputedStyle(bar),br2=bar.getBoundingClientRect(),hr2=hero.getBoundingClientRect();
        const omhoogZichtbaar=bar.classList.contains('aan')&&!bar.classList.contains('senior-verstopt')&&parseFloat(bs2.opacity)>0.9&&Math.abs(br2.top)<=1&&hr2.bottom<=0;
        document.body.dataset.mobileStickyOmhoog=String(omhoogZichtbaar);
        document.body.dataset.mobileStickyAanOmhoog=String(bar.classList.contains('aan'));
        document.body.dataset.mobileStickyVerstoptOmhoog=String(bar.classList.contains('senior-verstopt'));
        document.body.dataset.mobileStickyOpacityOmhoog=String(bs2.opacity);
        document.body.dataset.mobileStickyTopOmhoog=String(Math.round(br2.top));
        document.body.dataset.mobileStickyResult=(neerwaartsVerborgen&&omhoogZichtbaar)?'ok':'fout';
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
  if(waarde(mobiel,"mobile-sticky-result")!=="ok") throw new Error("mobiel resultaat="+waarde(mobiel,"mobile-sticky-result")+", neer="+waarde(mobiel,"mobile-sticky-neer")+", aanNeer="+waarde(mobiel,"mobile-sticky-aan-neer")+", verstoptNeer="+waarde(mobiel,"mobile-sticky-verstopt-neer")+", opacityNeer="+waarde(mobiel,"mobile-sticky-opacity-neer")+", transformNeer="+waarde(mobiel,"mobile-sticky-transform-neer")+", pointerNeer="+waarde(mobiel,"mobile-sticky-pointer-neer")+", bottomNeer="+waarde(mobiel,"mobile-sticky-bottom-neer")+", omhoog="+waarde(mobiel,"mobile-sticky-omhoog")+", aanOmhoog="+waarde(mobiel,"mobile-sticky-aan-omhoog")+", verstoptOmhoog="+waarde(mobiel,"mobile-sticky-verstopt-omhoog")+", opacityOmhoog="+waarde(mobiel,"mobile-sticky-opacity-omhoog")+", topOmhoog="+waarde(mobiel,"mobile-sticky-top-omhoog")+", exception="+waarde(mobiel,"mobile-sticky-exception"));

  console.log("Sticky browsertest geslaagd: desktop blijft vast; mobiel verdwijnt neerwaarts en keert omhoog terug.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}