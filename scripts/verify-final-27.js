"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
const swPad=path.join(OUT,"sw.js");
const bronSnapshotPad=path.join(ROOT,".weather-runtime-source.tmp");
if(!fs.existsSync(htmlPad)||!fs.existsSync(swPad))throw new Error("Definitieve WeatherNow-artifact ontbreekt.");
const paginaHtml=fs.readFileSync(htmlPad,"utf8");
/* platform-output-cleanup draait bewust ná de semantische postbuildketen. Als die
   deliverylaag de runtime heeft geëxternaliseerd/minified, bewaart hij uitsluitend
   voor de CI-verifier een niet-publieke bronmomentopname buiten public/. Zo kunnen
   de bestaande architectuurinvarianten op de leesbare bron blijven gelden, terwijl
   syntaxis en browsergedrag hieronder juist op de werkelijk geleverde bundle
   worden gecontroleerd. */
const bronSnapshot=fs.existsSync(bronSnapshotPad)?fs.readFileSync(bronSnapshotPad,"utf8"):"";
const html=paginaHtml+(bronSnapshot?"\n"+bronSnapshot:"");

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
  "formatteerMaanTekst","nachtzichtregel","nachtmaanregel","pollenKop",
  "weatherNowMaanGeschiktVoorNachtvenster"
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

/* Finale copy-architectuur: zichtbare microcopy komt uit inhoudelijke owners.
   Windstoot-, zonuren-, zeven-dagen- en briefingcopy zijn al in de base-build
   definitief; UI-polish mag die domeinen niet opnieuw wrappen. Luchtdruk wordt
   pas ná deze semantische guard in platform-output-cleanup volledig retired en
   daar afzonderlijk als afwezig geverifieerd. De latere neerslag-presentatie mag
   briefing() wel afzonderlijk synchroniseren, want die bezit een ander domein:
   actuele/model-neerslagwaarheid. */
for(const tekst of [
  "weatherNowWindstootTekst","weatherNowZonurenWoord","weatherNowDagNeerslagTekst","weatherNowDagNeerslagMmTekst","weatherNowBriefingNachtzin",
  "De hoogste windstoot wordt vandaag tussen ","De hoogste windstoot werd vandaag tussen ","verwacht: ",
  "Naar verwachting bijna de hele dag zon.","Naar verwachting veel zon vandaag.",
  '<div class="bar">Bereik</div>','<div class="drain">Neerslag</div>',
  "Het verwachte maximum ligt vandaag rond ","Het verwachte maximum ligt morgen rond ",
  "Het verwachte maximum lag vandaag rond ","Het verwachte maximum voor morgen is ",
  "De komende twee uur wordt er geen neerslag verwacht."
])vereist(tekst,"copy-eigenaar "+tekst);
verboden("uiWindstootTekst","late UI-polish windstootcopy-owner");
verboden("const uiBasisMeters=meters;","late UI-polish meters-wrapper");
verboden("uiLuchtdrukTekst","late UI-polish luchtdrukcopy-owner");
verboden('document.getElementById("pressub")',"late UI-polish pressub-rewrite");
verboden("uiZonurenWoord","late UI-polish zonurencopy-owner");
verboden("const uiBasisZonurenTegel=zonurenTegel;","late UI-polish zonurentegel-wrapper");
verboden("uiDagNeerslagTekst","late UI-polish daily-forecast copy-owner");
verboden("uiPolishDagen","late UI-polish daily-forecast DOM-owner");
verboden("const uiBasisDagen=dagen;","late UI-polish dagen-wrapper");
verboden("uiBriefingBronSemantiek","late UI-polish briefing-broncopy-owner");
verboden("uiBriefingTijdtaal","late UI-polish briefing-tijdcopy-owner");
verboden("const uiBasisBriefing=briefing;","late UI-polish briefing-wrapper");
verboden("De officiële waarschuwing heeft voorrang op de modelverwachting.","verouderde briefing-waarschuwingcopy");

/* Finale architectuur/performance. */
for(const tekst of [
  "let laadTeller=0,waarschuwingTeller=0,actieveWeerController=null,actieveLuchtController=null,actieveWaarschuwingController=null",
  "const luchtBelofte=luchtVerversen",
  "?j(a,{timeoutMs:7000,signal:luchtController.signal})",
  "const WEER_HEDGE_MS=5000;",
  "const WEER_FALLBACK_TIMEOUT_MS=5000;",
  "const volledigeBelofte=j(f,{timeoutMs:10000,signal:weerController.signal});",
  "fallbackBelofte=j(fmin,{timeoutMs:WEER_FALLBACK_TIMEOUT_MS,signal:weerController.signal})",
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
const luchtStart=html.indexOf("const luchtBelofte=luchtVerversen"),weerStart=html.indexOf("const volledigeBelofte=j(f,{timeoutMs:10000"),waarschuwingStart=html.indexOf("waarschuwingen();");
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

/* release-recovery-finalize mag vóór de delivery-cleanup al één onafhankelijke
   bootstrapresource toevoegen. Dat is bewust nog géén app-delivery: de hoofdapp
   staat op dit moment inline en wordt pas daarna geëxternaliseerd. De finale
   deliveryguard blijft strikt zodra de deliverymarker aanwezig is. */
const inlineBlokken=[...paginaHtml.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g)];
const inlineRuntime=inlineBlokken.filter(m=>!/\btype\s*=\s*["'](?:application\/ld\+json|application\/json)["']/i.test(m[1])).map(m=>m[2]);
const jsonLdScripts=inlineBlokken.filter(m=>/\btype\s*=\s*["']application\/ld\+json["']/i.test(m[1])).map(m=>m[2]);
const externePaden=[...paginaHtml.matchAll(/<script[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/g)].map(m=>m[1]);
const deliveryActief=paginaHtml.includes('<meta name="weather-delivery" content="external-minified-v1">');
const appPatroon=/^\/app-[0-9a-f]{12}\.min\.js$/;
const earlyPatroon=/^\/early-[0-9a-f]{12}\.min\.js$/;
const bootstrapPatroon=/^\/bootstrap-[0-9a-f]{12}(?:\.min)?\.js$/;
const hoofdBundles=externePaden.filter(src=>appPatroon.test(src));
const bootstrapBundles=externePaden.filter(src=>bootstrapPatroon.test(src));
if(bootstrapBundles.length>1)throw new Error("Homepage mag maximaal één onafhankelijke bootstrapbundle hebben; gevonden "+bootstrapBundles.length+".");
if(deliveryActief){
  if(hoofdBundles.length!==1)throw new Error("Definitief homepage-artifact moet exact één app-hoofdbundle hebben; gevonden "+hoofdBundles.length+".");
  if(inlineRuntime.length)throw new Error("Definitief delivery-artifact mag geen executable inline runtime meer bevatten.");
}else{
  if(hoofdBundles.length)throw new Error("App-hoofdbundle staat extern vóór de deliverymarker actief is.");
  const onverwacht=externePaden.filter(src=>!bootstrapPatroon.test(src));
  if(onverwacht.length)throw new Error("Onverwachte externe pre-delivery runtime: "+onverwacht.join(", "));
  if(!inlineRuntime.length)throw new Error("Pre-delivery artifact mist de inline WeatherNow-runtime.");
}
const externeRuntime=externePaden.map(src=>{
  if(!(appPatroon.test(src)||earlyPatroon.test(src)||bootstrapPatroon.test(src)))throw new Error("Onverwachte externe runtime in definitief artifact: "+src);
  const p=path.join(OUT,src.replace(/^\//,""));
  if(!fs.existsSync(p))throw new Error("Externe runtime ontbreekt: "+src);
  return fs.readFileSync(p,"utf8");
});
const runtimeScripts=deliveryActief?externeRuntime:inlineRuntime.concat(externeRuntime);
if(!runtimeScripts.length)throw new Error("Geen WeatherNow-runtime gevonden.");
runtimeScripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/runtime-final-27-"+(i+1)+".js"}));
jsonLdScripts.forEach((bron,i)=>{try{JSON.parse(bron);}catch(e){throw new Error("Ongeldige JSON-LD in definitief artifact #"+(i+1)+": "+e.message);}});
if(deliveryActief){
  if(/http-equiv="Content-Security-Policy"/i.test(paginaHtml))throw new Error("CSP-meta hoort na delivery niet meer in het document.");
}

const verwacht=verifieerServiceworkerCache(OUT,"finale");
console.log("Finale 27-punten artifactguard geslaagd: één Nachtzicht-owner met kalendergrens en maanvenster, gewone nullen, één Q3-UV-copy-owner, geconsolideerde copy-eigenaars inclusief zonuren, zeven-dagenpresentatie en briefingcopy, requestarchitectuur, syntactische geleverde runtime, geldige JSON-LD en serviceworker "+verwacht+".");