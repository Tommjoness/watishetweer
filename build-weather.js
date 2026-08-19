"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const PRODUCT_CONFIG=require("./product-config.js");
const {pasSeoFoundationToe}=require("./scripts/seo-foundation.js");
const {pasPollenHourCorrectnessToe}=require("./scripts/pollen-hour-correctness.js");
const {vernieuwServiceworkerCache}=require("./scripts/postbuild-cache.js");
/* CACHE_BRONNEN en het hashrecept zijn uitsluitend eigendom van postbuild-cache.js. */
const ROOT=__dirname,OUT=path.join(ROOT,"public");
const NIET_PUBLICEREN=new Set([
  ".git",".github","api","lib","node_modules","public","scripts",
  "build-weather.js","interpretatie-engine.js","interpretatie-engine.test.js","nederlandse-weergrammatica.js","senior-correctness-v2.js","neerslagkans-policy-v3.js","live-polish.css","live-polish-v2.js","senior-semantiek-20260810.css","senior-semantiek-20260810.js","product-config.js",
  "run.js","run-built-matrix.js","kern.js","data.js","package.json","package-lock.json","vercel.json"
]);
function intern(n){return NIET_PUBLICEREN.has(n)||n.endsWith(".test.js");}
function kopieer(bron,doel){
  const st=fs.statSync(bron);
  if(st.isDirectory()){
    fs.mkdirSync(doel,{recursive:true});
    for(const n of fs.readdirSync(bron))kopieer(path.join(bron,n),path.join(doel,n));
  }else{fs.mkdirSync(path.dirname(doel),{recursive:true});fs.copyFileSync(bron,doel);}
}
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
for(const n of fs.readdirSync(ROOT)){if(!intern(n))kopieer(path.join(ROOT,n),path.join(OUT,n));}
let html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
let engine=fs.readFileSync(path.join(ROOT,"interpretatie-engine.js"),"utf8");
const grammatica=fs.readFileSync(path.join(ROOT,"nederlandse-weergrammatica.js"),"utf8");
const correctness=fs.readFileSync(path.join(ROOT,"senior-correctness-v2.js"),"utf8");
const kansbeleid=fs.readFileSync(path.join(ROOT,"neerslagkans-policy-v3.js"),"utf8");
const polishCss=fs.readFileSync(path.join(ROOT,"live-polish.css"),"utf8");
const polishJs=fs.readFileSync(path.join(ROOT,"live-polish-v2.js"),"utf8");
const seniorSemantiekCss=fs.readFileSync(path.join(ROOT,"senior-semantiek-20260810.css"),"utf8");
const seniorSemantiekJs=fs.readFileSync(path.join(ROOT,"senior-semantiek-20260810.js"),"utf8");
const progressiveCss=fs.readFileSync(path.join(ROOT,"scripts","progressive-location.css"),"utf8");
const progressiveJs=fs.readFileSync(path.join(ROOT,"scripts","progressive-location.js"),"utf8");
const globalLocationCss=fs.readFileSync(path.join(ROOT,"scripts","global-location-hardening.css"),"utf8");
const globalLocationJs=fs.readFileSync(path.join(ROOT,"scripts","global-location-hardening.js"),"utf8");
const start="/* ---------- start ---------- */";
if((html.match(/\/\* ---------- start ---------- \*\//g)||[]).length!==1)throw new Error("Startmarker ontbreekt of is dubbel.");
if((html.match(/<\/style>/g)||[]).length!==1)throw new Error("Stijlblok ontbreekt of is dubbel.");
if(html.includes("CENTRALE INTERPRETATIE-ENGINE")||html.includes("SENIOR CORRECTHEIDSLAAG")||html.includes("NEERSLAGKANSBELEID V3")||html.includes("LIVE POLISH")||html.includes("LIVE INTERACTIEPOLISH")||html.includes("SENIOR SEMANTIEK 20260810")||html.includes("PROGRESSIEVE LOCATIELADING")||html.includes("WERELDWIJDE LOCATIEHARDENING"))throw new Error("Bron-index bevat een buildlaag al.");

/* De bestaande briefingrenderer blijft eigenaar van waarschuwingen, markup en
   de overige briefingzinnen. Alleen zijn korte neerslagzin wordt op runtime
   aan het nieuwe kansbeleid gekoppeld. De hook zit expres in de geassembleerde
   engine: WeatherNowKansbeleidV3 wordt later in hetzelfde script gedefinieerd,
   maar bestaat altijd vóór de eerste locatie/render wordt gestart. */
const BRIEFING_HAAK="  function briefingNeerslagZin(a){\n";
const briefingHaakAantal=engine.split(BRIEFING_HAAK).length-1;
if(briefingHaakAantal!==1)throw new Error("Briefing-kansbeleidhaak ontbreekt of is dubbel: "+briefingHaakAantal);
engine=engine.replace(BRIEFING_HAAK,
  BRIEFING_HAAK
  +"    const beleid=root.WeatherNowKansbeleidV3;\n"
  +"    if(beleid&&typeof beleid.briefingZin===\"function\") return beleid.briefingZin(a);\n");

/* Alle bewuste verschillen tussen ontwikkeltemplate en productie staan in
   product-config.js. De build bevat zelf geen duplicaat van die semantiek. */
function vervangProductregel(bron,productie,label){
  const aantal=html.split(bron).length-1;
  if(aantal!==1)throw new Error(label+" ontbreekt of is dubbel: "+aantal+" keer gevonden.");
  html=html.replace(bron,productie);
}
vervangProductregel(PRODUCT_CONFIG.EERSTE_BEZOEK_BRON,PRODUCT_CONFIG.EERSTE_BEZOEK_PRODUCTIE,"Eerste-bezoekblok");
vervangProductregel(PRODUCT_CONFIG.KALENDERDAG_PUNTEN_BRON,PRODUCT_CONFIG.KALENDERDAG_PUNTEN_PRODUCTIE,"24-uursgrensregel");
vervangProductregel(PRODUCT_CONFIG.OPHAALFOUT_BRON,PRODUCT_CONFIG.OPHAALFOUT_PRODUCTIE,"Ophaalfoutsemantiek");
vervangProductregel(PRODUCT_CONFIG.CACHE_FALLBACK_LAND_BRON,PRODUCT_CONFIG.CACHE_FALLBACK_LAND_PRODUCTIE,"Cachefallback-landcontext");
vervangProductregel(PRODUCT_CONFIG.POLAR_GRAFIEK_BRON,PRODUCT_CONFIG.POLAR_GRAFIEK_PRODUCTIE,"Poolgrafiek-zonsemantiek");

/* De compacte meelopende weerbalk gebruikte oorspronkelijk alleen een
   IntersectionObserver. Dat is zuinig, maar browsers mogen zo'n callback rond
   layoutwisselingen uitstellen. Productie krijgt daarom één gedeelde
   zichtbaarheidstest op de echte onderrand van de hero, aangeroepen door de
   observer én door passieve scroll/resize-events. Een maximaal eens per 16 ms
   lopende timer coalescet snelle scroll-events zonder afhankelijkheid van de
   render-scheduler van de browser.

   Op mobiel verdwijnt de fixed balk bovendien bij duidelijk neerwaarts scrollen
   en komt hij terug zodra de gebruiker weer omhoog navigeert. Daarmee blijft de
   context beschikbaar zonder tijdens het lezen de bovenste inhoudsregel af te
   dekken. Desktop behoudt de bestaande vaste balk exact zoals hij was. */
const MINIBAR_BRON=`(function(){
  const hero=document.querySelector(".hero"),bar=document.getElementById("minibar");
  if(!hero||!("IntersectionObserver" in window)) return;
  new IntersectionObserver(([e])=>{
    bar.classList.toggle("aan",!e.isIntersecting&&e.boundingClientRect.top<0);
  },{threshold:0}).observe(hero);
})();`;
const MINIBAR_PRODUCTIE=`(function(){
  const hero=document.querySelector(".hero"),bar=document.getElementById("minibar");
  if(!hero||!bar) return;
  let timer=null,richtingY=Math.max(0,window.scrollY||0);
  const mobiel=()=>window.matchMedia&&window.matchMedia("(max-width:900px)").matches;
  const pasRichtingToe=()=>{
    if(!mobiel()){
      bar.classList.remove("senior-verstopt");
      richtingY=Math.max(0,window.scrollY||0);
      return;
    }
    const y=Math.max(0,window.scrollY||0),verschil=y-richtingY;
    if(Math.abs(verschil)<10) return;
    if(bar.classList.contains("aan"))bar.classList.toggle("senior-verstopt",verschil>0);
    else bar.classList.remove("senior-verstopt");
    richtingY=y;
  };
  const zet=()=>{
    timer=null;
    const r=hero.getBoundingClientRect();
    const aan=Number.isFinite(r.bottom)&&r.bottom<=0;
    bar.classList.toggle("aan",aan);
    if(!aan)bar.classList.remove("senior-verstopt");
    pasRichtingToe();
  };
  const plan=()=>{
    if(timer!==null) return;
    timer=setTimeout(zet,16);
  };
  if("IntersectionObserver" in window)new IntersectionObserver(plan,{threshold:0}).observe(hero);
  window.addEventListener("scroll",plan,{passive:true});
  window.addEventListener("resize",plan,{passive:true});
  plan();
})();`;
vervangProductregel(MINIBAR_BRON,MINIBAR_PRODUCTIE,"Minibalk-zichtbaarheidsblok");
/* Presentatiepolish, semantiek, progressieve locatielading en wereldwijde
   locatiehardening zijn expliciete, afzonderlijk testbare buildlagen. De
   hardeninglaag wijzigt alleen locatiezoekresultaten, bewezen waarschuwingsscope
   en de robuustheid van het hero-layout; weerwaarden/formules blijven eigendom
   van de bestaande forecast- en interpretatieketen. */
html=html.replace("</style>",
  "\n/* ===== LIVE POLISH ===== */\n"+polishCss+"\n/* ===== EINDE LIVE POLISH ===== */\n"
  +"/* ===== SENIOR SEMANTIEK 20260810 CSS ===== */\n"+seniorSemantiekCss+"\n/* ===== EINDE SENIOR SEMANTIEK 20260810 CSS ===== */\n"
  +"/* ===== PROGRESSIEVE LOCATIELADING CSS ===== */\n"+progressiveCss+"\n/* ===== EINDE PROGRESSIEVE LOCATIELADING CSS ===== */\n"
  +"/* ===== WERELDWIJDE LOCATIEHARDENING CSS ===== */\n"+globalLocationCss+"\n/* ===== EINDE WERELDWIJDE LOCATIEHARDENING CSS ===== */\n</style>");

html=html.replace(start,
  "/* ===== NEDERLANDSE WEERGRAMMATICA ===== */\n"+grammatica+"\n/* ===== EINDE NEDERLANDSE WEERGRAMMATICA ===== */\n\n"
  +"/* ===== CENTRALE INTERPRETATIE-ENGINE ===== */\n"+engine+"\n/* ===== EINDE CENTRALE INTERPRETATIE-ENGINE ===== */\n\n"
  +"/* ===== SENIOR CORRECTHEIDSLAAG ===== */\n"+correctness+"\n/* ===== EINDE SENIOR CORRECTHEIDSLAAG ===== */\n\n"
  +"/* ===== NEERSLAGKANSBELEID V3 ===== */\n"+kansbeleid+"\n/* ===== EINDE NEERSLAGKANSBELEID V3 ===== */\n\n"
  +"/* ===== LIVE INTERACTIEPOLISH ===== */\n"+polishJs+"\n/* ===== EINDE LIVE INTERACTIEPOLISH ===== */\n\n"
  +"/* ===== SENIOR SEMANTIEK 20260810 ===== */\n"+seniorSemantiekJs+"\n/* ===== EINDE SENIOR SEMANTIEK 20260810 ===== */\n\n"
  +"/* ===== PROGRESSIEVE LOCATIELADING ===== */\n"+progressiveJs+"\n/* ===== EINDE PROGRESSIEVE LOCATIELADING ===== */\n\n"
  +"/* ===== WERELDWIJDE LOCATIEHARDENING ===== */\n"+globalLocationJs+"\n/* ===== EINDE WERELDWIJDE LOCATIEHARDENING ===== */\n\n"+start);

/* Lucht/pollen-correctheid is één pure productie-owner. De vier bestaande
   productregels worden nu al in de base-build toegepast; latere postbuildlagen
   mogen deze semantiek alleen nog verifiëren, niet herschrijven. */
html=pasPollenHourCorrectnessToe(html);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline script gevonden.");
scripts.forEach((s,i)=>new vm.Script(s,{filename:"public/index.html:inline-"+(i+1)}));
const vereist=[
  "WeatherNowInterpretatie","WeatherNowCorrectnessV2","WeatherNowKansbeleidV3","WeatherNowPolishV2","WeatherNowSeniorRonde20260810","WeatherNowProgressiveLocation","WeatherNowGlobalLocationHardening","weatherNowActueleLokaleTijd","plaatsTijdDelen","weatherNowZoneOffset",
  "const beleid=root.WeatherNowKansbeleidV3;","typeof beleid.briefingZin===\"function\"",
  "const eind=Math.min(i+25,h.time.length);","const punten=n===24?25:n;",
  "hoeveelheid onzeker","daily.weather_code&&daily.weather_code[dagIndex]","117.000001",
  "c.visibility!=null?c.visibility","weatherNowUurWaardeOp(\"pressure_msl\"","zoekGeneratie",
  "klokKalenderdag","Komend uur","item.precipitation*item.fractie",
  "luchtBelofte","plaatsSpecifiek!==false","nachtzichtScore","grafiekNeerslagVerschuiving",
  "k<=9","k<=29","k<=69","k<=89","Zeer grote kans op neerslag",
  "grid-template-columns:repeat(3,minmax(0,1fr))","klokMinuutTimer=setInterval(klokBijwerken,60000)","tooltipWaardeKort","temperatuurLabelsBotsen","neerslagkans",
  "forecastMomentZinsdeel","Globale indicatie:","kop.textContent=\"Neerslag\"","senior-zoninfo","tooltipCompactMaten",
  "window.addEventListener(\"scroll\",plan,{passive:true})","r.bottom<=0","timer=setTimeout(zet,16)","senior-verstopt","verschil>0","(max-width:900px)",
  "Verwachting wordt aangevuld.","current=temperature_2m,apparent_temperature,is_day,weather_code",
  "geen plaats-specifieke dekking","dedupliceerZoekresultaten","grid-template-areas:","informatie informatie","overflow-wrap:anywhere",
  "load(52.3676,4.9041,\"Amsterdam\",false,true,\"NL\")"
];
for(const x of vereist)if(!html.includes(x))throw new Error("Canonieke broninvariant ontbreekt: "+x);

/* SEO-fundering is productmetadata en hoort net als de overige canonieke
   productieconfiguratie in de base-build. De pure owner gebruikt uitsluitend
   seo-foundation.config.js; latere plaatsroutegeneratie erft deze rootmetadata. */
html=pasSeoFoundationToe(html);
fs.writeFileSync(path.join(OUT,"index.html"),html,"utf8");

/* Ook de eerste build gebruikt dezelfde eigenaar als alle latere postbuildlagen.
   Daarmee bestaan lijst, hashrecept, legacy-id-migratie en verificatie nog maar
   op één plek. Iedere volgende artifactmutatie kan dezelfde helper opnieuw
   aanroepen zonder dat build-weather een tweede cachecontract onderhoudt. */
const versie=vernieuwServiceworkerCache(OUT,"build-weather");

for(const n of fs.readdirSync(OUT))if(intern(n))throw new Error("Intern bestand publiek gebouwd: "+n);
console.log("WeatherNow-build geslaagd: expliciete productconfiguratie, lucht/pollen-correctheid, SEO-fundering, centrale interpretatie, correctheidslaag, neerslagkansbeleid, live-polish, senior-semantiek, progressieve locatielading, wereldwijde locatiehardening en cache "+versie+".");