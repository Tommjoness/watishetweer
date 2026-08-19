"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
const swPad=path.join(OUT,"sw.js");
if(!fs.existsSync(htmlPad)||!fs.existsSync(swPad))throw new Error("Definitieve WeatherNow-artifact ontbreekt.");
const html=fs.readFileSync(htmlPad,"utf8");

const aantal=tekst=>html.split(tekst).length-1;
const exactEen=(tekst,naam)=>{const n=aantal(tekst);if(n!==1)throw new Error(naam+" moet exact één keer voorkomen; gevonden "+n+".");};
const vereist=(tekst,naam)=>{if(!html.includes(tekst))throw new Error("Finale invariant ontbreekt: "+(naam||tekst));};
const verboden=(tekst,naam)=>{if(html.includes(tekst))throw new Error("Verwijderde/ongewenste invariant staat nog in artifact: "+(naam||tekst));};

/* 25%: oude recente-neerslagtegel is echt weg en temperatuurtrend is uniek. */
exactEen('<div class="eyebrow">Temperatuur komende 3 uur</div><div class="sval" id="prec">',"temperatuurtrendtegel");
for(const [tekst,naam] of [
  ['<div class="eyebrow">Afgelopen 15 minuten</div><div class="sval" id="prec">',"oude 15-minutentegel"],
  ["Afgelopen kwartier","oude kwartiertekst"],
  ["compactRecentLabel","oude kwartier-wrapper"],
  ["const recenteNeerslag=eindigGetal(c.precipitation)","oude recente-neerslagberekening"]
])verboden(tekst,naam);
for(const tekst of ["WeatherNowQ1","CHECKPOINT 25 Q1","weerbriefing.plaatscache.q1","renderNeerslagSectie","q1-dag-mm","naEersteCachePaint","requestAnimationFrame"]){vereist(tekst);}

/* 50%: Nachtzicht heeft één presentatie-owner. Die owner bezit nu ook de lokale
   kalendergrens, astronomische eindgrens en scanbare maan/zichtpresentatie. */
const nachtOwners=aantal("const basisNachten=nachten;");
if(nachtOwners!==1)throw new Error("Nachtzicht heeft "+nachtOwners+" presentatie-owners; exact één vereist.");
exactEen("const ruimBotsendeAslabelsOp=()=>{","grafiek fontbox-collisionlaag");
vereist("getBBox()","echte SVG-fontboxmeting");
vereist("maan-fase-svg-v2","platformonafhankelijke maanfase-SVG");
for(const tekst of [
  "normaliseerNachtDagdata","nachtIsActiefNu","corrigeerNachtVensterBron",
  "formatteerMaanTekst","nachtzichtregel","nachtmaanregel","pollenKop"
])vereist(tekst,"Nachtzicht-kern "+tekst);
verboden("Beste modeluren","oude modeljargon-beste-periodepresentatie");
verboden("Relatief gunstigste modeluren","oude relatieve modeljargonpresentatie");

/* 75%: live plaatsklok, 100% bewolking, één UV-copy-owner en consumentvriendelijke cijfers. */
exactEen('if(n===100)return "Geheel bewolkt";','100%-bewolkingsregel');
exactEen('const pUv=typeof plaatsTijdDelen','UV live-plaatsklokanker');
exactEen("Verwachte UV-piek lag rond ","verstreken finale UV-copy");
exactEen("Verwachte UV-piek rond ","actuele/toekomstige finale UV-copy");
exactEen("Nauwelijks UV verwacht vandaag.","nul-UV finale modelcopy");
for(const tekst of [
  "UV-gegevens voor vandaag worden bijgewerkt.",
  'font-feature-settings:"tnum" 1,"zero" 0',"senior-zoninfo","pollenEenheid","bron-bronnen"
])vereist(tekst);
verboden("Piek was rond ","oude Q3-tussenformulering voor verstreken UV-piek");
verboden("Piek rond ","oude Q3-tussenformulering voor actuele/toekomstige UV-piek");
verboden("uiUvPiekTekst","late UI-polish UV-copy-owner");
verboden('font-feature-settings:"tnum" 1,"zero" 1',"oude OpenType slashed-zero feature");
verboden("tabular-nums slashed-zero","oude slashed-zero fontvariant");

/* Finale copy-architectuur: tijdtaal en microcopy komen uit de inhoudelijke
   eigenaren; de late Nederlandse laag is alleen neerslagcompatibiliteit. */
for(const tekst of [
  "uiWindstootTekst","uiLuchtdrukTekst","uiBriefingTijdtaal","uiZonurenWoord",
  "De komende twee uur wordt er geen neerslag verwacht."
])vereist(tekst,"copy-eigenaar "+tekst);

/* Finale architectuur/performance. */
for(const tekst of [
  "let laadTeller=0,waarschuwingTeller=0,actieveWeerController=null,actieveLuchtController=null,actieveWaarschuwingController=null",
  "const luchtBelofte=j(a,{timeoutMs:7000,signal:luchtController.signal})",
  "const WEER_HEDGE_MS=5000;",
  "const volledigeBelofte=j(f,{timeoutMs:10000,signal:weerController.signal});",
  "fallbackBelofte=j(fmin,{timeoutMs:10000,signal:weerController.signal})",
  "hedgeTimer=setTimeout(()=>resolve({soort:\"traag\"}),WEER_HEDGE_MS);",
  "volledigeBelofte.then(geslaagd,mislukt);",
  "fallback.then(geslaagd,mislukt);",
  "if(mijnBeurt!==laadTeller) return",
  "if(mijnBeurt!==laadTeller||S.d!==vol) return;",
  "if(mijnBeurt!==waarschuwingTeller||S.lat!==lat||S.lon!==lon) return;",
  "waarschuwingen();",
  "const basisJ=j,zoekCache=new Map();"
])vereist(tekst);
verboden("try{vol=await j(f,{timeoutMs:10000,signal:weerController.signal});}","oude sequentiële full-forecastwait");
const luchtStart=html.indexOf("const luchtBelofte=j(a"),weerStart=html.indexOf("const volledigeBelofte=j(f,{timeoutMs:10000"),waarschuwingStart=html.indexOf("waarschuwingen();");
if(luchtStart<0||weerStart<0||luchtStart>weerStart)throw new Error("Luchtkwaliteit start niet aantoonbaar parallel vóór het wachten op de hoofdforecast.");
if(waarschuwingStart<0)throw new Error("Waarschuwingen worden niet vanuit de renderketen gestart.");

/* Externe request-eigenaars moeten expliciet blijven. */
exactEen('const basis="https://api.open-meteo.com/v1/forecast?latitude="','hoofdforecast-URL-eigenaar');
exactEen('return "https://api.open-meteo.com/v1/forecast?latitude="+encodeURIComponent(a)','current-only previewforecast-eigenaar');
for(const tekst of [
  "WeatherNowProgressiveLocation","const SNEL_START_VERTRAGING_MS=120","const SNEL_TIMEOUT_MS=3000",
  'current=temperature_2m,apparent_temperature,is_day,weather_code',
  "const volledigeBelofte=basisLoad(lat,lon,label,stil,opslaan,land)","Verwachting wordt aangevuld."
])vereist(tekst,"progressieve locatielading "+tekst);
exactEen("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=","luchtkwaliteit-URL-eigenaar");
exactEen('"/api/waarschuwingen?lat="',"waarschuwingen-URL-eigenaar");
exactEen("https://geocoding-api.open-meteo.com/v1/search?name=","zoek-geocoding-URL-eigenaar");
exactEen("https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=","primaire reverse-geocode-eigenaar");
const plaatsFallback='"/api/plaatsnaam?lat="';
const fallbackAantal=aantal(plaatsFallback);
if(fallbackAantal!==2)throw new Error("Reverse-geocodefallback moet exact twee expliciete consumenten hebben; gevonden "+fallbackAantal+".");
const bdc=html.indexOf("https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=");
const gpsFallback=html.indexOf(plaatsFallback);
const gedeeldeLaag=html.indexOf("/* ===== GEDEELDE URL PLAATSIDENTITEIT ===== */");
const gedeeldeFallback=html.indexOf(plaatsFallback,gpsFallback+1);
if(!(bdc>=0&&gpsFallback>bdc))throw new Error("GPS reverse geocoding is niet aantoonbaar BigDataCloud gevolgd door de serverfallback.");
if(!(gedeeldeLaag>gpsFallback&&gedeeldeFallback>gedeeldeLaag))throw new Error("De tweede plaatsnaamfallback hoort uitsluitend bij de gedeelde-linklaag.");
vereist("plaatsnaamUitCoordinaten","gedeelde plaatsnaamhelper");

for(const tekst of ["CACHEPERF","DEELPERF","window.__q4","console.log(\"DIAG "]){verboden(tekst,"tijdelijke diagnose "+tekst);}

const scriptBlokken=[...html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g)];
const runtimeScripts=scriptBlokken.filter(m=>!/\btype\s*=\s*["']application\/ld\+json["']/i.test(m[1])).map(m=>m[2]);
const jsonLdScripts=scriptBlokken.filter(m=>/\btype\s*=\s*["']application\/ld\+json["']/i.test(m[1])).map(m=>m[2]);
if(!runtimeScripts.length)throw new Error("Geen inline WeatherNow-runtime gevonden.");
runtimeScripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:final-27-runtime-"+(i+1)}));
jsonLdScripts.forEach((bron,i)=>{try{JSON.parse(bron);}catch(e){throw new Error("Ongeldige JSON-LD in definitief artifact #"+(i+1)+": "+e.message);}});

const verwacht=verifieerServiceworkerCache(OUT,"finale");
console.log("Finale 27-punten artifactguard geslaagd: één Nachtzicht-owner met kalendergrens, gewone nullen, één Q3-UV-copy-owner, copy-eigenaars, requestarchitectuur, syntactische runtime, geldige JSON-LD en serviceworker "+verwacht+".");
