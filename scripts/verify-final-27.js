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

/* 50%: Nachtzicht heeft één eigenaar en de grafiek één fontbox-collisionlaag. */
const nachtOwners=aantal("const basisNachten=nachten;");
if(nachtOwners!==1)throw new Error("Nachtzicht heeft "+nachtOwners+" presentatie-owners; exact één vereist.");
exactEen("const ruimBotsendeAslabelsOp=()=>{","grafiek fontbox-collisionlaag");
vereist("getBBox()","echte SVG-fontboxmeting");
vereist("maan-fase-svg-v2","platformonafhankelijke maanfase-SVG");
vereist("Beste modeluren","niet-overprecieze beste-periodepresentatie");

/* 75%: live plaatsklok, 100% bewolking, UV-tijd en numerieke leesbaarheid. */
exactEen('if(n===100)return "Geheel bewolkt";','100%-bewolkingsregel');
exactEen('const pUv=typeof plaatsTijdDelen','UV live-plaatsklokanker');
for(const tekst of ["Piek was rond ","Piek rond ","UV-gegevens voor vandaag worden bijgewerkt.","slashed-zero",'font-feature-settings:"tnum" 1,"zero" 1',"senior-zoninfo","pollenEenheid","bron-bronnen"]){vereist(tekst);}

/* Finale architectuur/performance: geen cosmetische performanceclaim. De lucht-
   aanvraag start vóór de hoofdforecast wordt afgewacht; waarschuwingen starten
   vanuit de eerste render en blokkeren de hoofdforecast niet. Alle drie hebben
   eigen race-/abortbescherming. */
for(const tekst of [
  "let laadTeller=0,waarschuwingTeller=0,actieveWeerController=null,actieveLuchtController=null,actieveWaarschuwingController=null",
  "const luchtBelofte=j(a,{timeoutMs:7000,signal:luchtController.signal})",
  "vol=await j(f,{timeoutMs:10000,signal:weerController.signal})",
  "vol=await j(fmin,{timeoutMs:10000,signal:weerController.signal})",
  "if(mijnBeurt!==laadTeller) return",
  "if(mijnBeurt!==laadTeller||S.d!==vol) return;",
  "if(mijnBeurt!==waarschuwingTeller||S.lat!==lat||S.lon!==lon) return;",
  "waarschuwingen();",
  "const basisJ=j,zoekCache=new Map();"
])vereist(tekst);
const luchtStart=html.indexOf("const luchtBelofte=j(a"),weerStart=html.indexOf("vol=await j(f,{timeoutMs:10000"),waarschuwingStart=html.indexOf("waarschuwingen();");
if(luchtStart<0||weerStart<0||luchtStart>weerStart)throw new Error("Luchtkwaliteit start niet aantoonbaar parallel vóór het wachten op de hoofdforecast.");
if(waarschuwingStart<0)throw new Error("Waarschuwingen worden niet vanuit de renderketen gestart.");

/* Externe request-eigenaars moeten expliciet blijven. De volledige forecast is
   nog steeds exact één canonieke route. Daarnaast mag er exact één afzonderlijke
   current-only previewroute bestaan; die route mag geen hourly/daily/minutely
   data bezitten en vervangt de hoofdforecast nooit. */
exactEen('const basis="https://api.open-meteo.com/v1/forecast?latitude="','hoofdforecast-URL-eigenaar');
exactEen('return "https://api.open-meteo.com/v1/forecast?latitude="+encodeURIComponent(a)','current-only previewforecast-eigenaar');
for(const tekst of [
  "WeatherNowProgressiveLocation",
  "const SNEL_START_VERTRAGING_MS=120",
  "const SNEL_TIMEOUT_MS=3000",
  'current=temperature_2m,apparent_temperature,is_day,weather_code',
  "const volledigeBelofte=basisLoad(lat,lon,label,stil,opslaan,land)",
  "Verwachting wordt aangevuld."
])vereist(tekst,"progressieve locatielading "+tekst);
exactEen("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=","luchtkwaliteit-URL-eigenaar");
exactEen('"/api/waarschuwingen?lat="',"waarschuwingen-URL-eigenaar");
exactEen("https://geocoding-api.open-meteo.com/v1/search?name=","zoek-geocoding-URL-eigenaar");
exactEen("https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=","primaire reverse-geocode-eigenaar");
exactEen('"/api/plaatsnaam?lat="',"reverse-geocode-fallback-eigenaar");
const bdc=html.indexOf("https://api.bigdatacloud.net/data/reverse-geocode-client?latitude="),fallback=html.indexOf('"/api/plaatsnaam?lat="');
if(!(bdc>=0&&fallback>bdc))throw new Error("Reverse geocoding is niet aantoonbaar primaire bron gevolgd door fallback.");

/* Geen tijdelijke diagnosecode in het productie-artifact. */
for(const tekst of ["CACHEPERF","DEELPERF","window.__q4","console.log(\"DIAG "]){verboden(tekst,"tijdelijke diagnose "+tekst);}

/* Alle inline runtime blijft syntactisch geldig. */
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline WeatherNow-runtime gevonden.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:final-27-"+(i+1)}));

/* Serviceworker moet exact bij deze app-shell horen. */
const verwacht=verifieerServiceworkerCache(OUT,"finale");
console.log("Finale 27-punten artifactguard geslaagd: 25/50/75-invariants, expliciete hoofd- en previewrequesteigenaars, race/fallback-ankers, syntactische runtime en serviceworker "+verwacht+".");
