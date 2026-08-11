"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const crypto=require("crypto");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
const mobileCss=fs.readFileSync(path.join(__dirname,"mobile-screenshot-polish.css"),"utf8");
const q1Css=fs.readFileSync(path.join(__dirname,"q1-precip-performance.css"),"utf8");
const mobileJs=fs.readFileSync(path.join(__dirname,"mobile-screenshot-polish.js"),"utf8");
const q1Js=fs.readFileSync(path.join(__dirname,"q1-precip-performance.js"),"utf8");
let html=fs.readFileSync(htmlPad,"utf8");

const CSS_MARK="/* ===== MOBILE SCREENSHOT POLISH 20260810B CSS ===== */";
const Q1_CSS_MARK="/* ===== CHECKPOINT 25 Q1 CSS ===== */";
const JS_MARK="/* ===== MOBILE SCREENSHOT POLISH 20260810B ===== */";
const Q1_JS_MARK="/* ===== CHECKPOINT 25 Q1 ===== */";
const START="/* ---------- start ---------- */";
const RECENT_OLD='<div class="eyebrow">Afgelopen 15 minuten</div><div class="sval" id="prec">';
const TREND_NEW='<div class="eyebrow">Temperatuurtrend</div><div class="sval" id="prec">';
const LEGACY_RECENT_START='  const recenteNeerslag=eindigGetal(c.precipitation);';
const LEGACY_RECENT_END='  /* De tegel toont de kans voor precies het eerstvolgende uur (i+1). De subtekst';
if(html.includes(CSS_MARK)||html.includes(JS_MARK)||html.includes(Q1_CSS_MARK)||html.includes(Q1_JS_MARK))throw new Error("Post-build polish is al geïnjecteerd.");
if((html.match(/<\/style>/g)||[]).length!==1)throw new Error("Exact één stijlblok vereist voor mobiele polish.");
if((html.split(START).length-1)!==1)throw new Error("Startmarker ontbreekt of is dubbel voor mobiele polish.");
if((html.split(RECENT_OLD).length-1)!==1)throw new Error("Legacy recente-neerslagtegel ontbreekt of is dubbel in de bronartifact.");
if((html.split(LEGACY_RECENT_START).length-1)!==1||(html.split(LEGACY_RECENT_END).length-1)!==1)throw new Error("Legacy recente-neerslaglogica ontbreekt of is dubbel in de bronartifact.");

/* Productbeslissing checkpoint 25: de terugblik op recente neerslag bestaat niet
   meer in de definitieve runtime. De bestaande bron-template bevat die historische
   metriek nog, maar deze reeds bestaande post-buildstap is de enige artifactlaag
   van de branch. We vervangen de tegel statisch en verwijderen het volledige oude
   meters()-blok vóór de runtime-JS wordt gevalideerd. Er blijft dus geen verborgen
   berekening over die later opnieuw een kwartierwaarde kan terugschrijven. */
html=html.replace(RECENT_OLD,TREND_NEW);
const legacyStart=html.indexOf(LEGACY_RECENT_START),legacyEind=html.indexOf(LEGACY_RECENT_END,legacyStart);
if(legacyStart<0||legacyEind<=legacyStart)throw new Error("Legacy recente-neerslaglogica kon niet veilig worden afgebakend.");
html=html.slice(0,legacyStart)
  +'  /* Recente-neerslagterugblik verwijderd; #prec is nu exclusief van Q1 temperatuurtrend. */\n\n'
  +html.slice(legacyEind);

html=html.replace("</style>",
  "\n"+CSS_MARK+"\n"+mobileCss+"\n/* ===== EINDE MOBILE SCREENSHOT POLISH 20260810B CSS ===== */\n"
  +Q1_CSS_MARK+"\n"+q1Css+"\n/* ===== EINDE CHECKPOINT 25 Q1 CSS ===== */\n</style>");
html=html.replace(START,
  JS_MARK+"\n"+mobileJs+"\n/* ===== EINDE MOBILE SCREENSHOT POLISH 20260810B ===== */\n\n"
  +Q1_JS_MARK+"\n"+q1Js+"\n/* ===== EINDE CHECKPOINT 25 Q1 ===== */\n\n"+START);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline script na mobiele polish.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:postbuild-"+(i+1)}));
for(const vereist of [
  "WeatherNowMobileScreenshotPolish","maan-fase-svg-v2","Temperatuurtrend","bron-bronnen",
  "WeatherNowQ1","q1-dag-mm","weerbriefing.plaatscache.q1","neerslagkans",
  "temperatuurTrend","q1-pop-hidden"
]){
  if(!html.includes(vereist))throw new Error("Post-build invariant ontbreekt: "+vereist);
}
if(html.includes(RECENT_OLD)||html.includes("Afgelopen kwartier"))throw new Error("Verwijderde recente-neerslagtegel staat nog in de productieartifact.");
if(html.includes(LEGACY_RECENT_START))throw new Error("Legacy recente-neerslagberekening staat nog in de productieartifact.");
fs.writeFileSync(htmlPad,html,"utf8");

/* build-weather.js maakt de serviceworker-cacheversie vóór deze gerichte laag.
   Omdat index.html nu bewust is gewijzigd, berekenen we exact dezelfde shellhash
   opnieuw en vervangen uitsluitend de versie-id in sw.js. */
const CACHE_BRONNEN=[
  "index.html","manifest.json","icon-192.png","icon-512.png","icon-maskable-512.png",
  "bodoni-moda-latin-400-normal.woff2","bodoni-moda-latin-500-normal.woff2",
  "instrument-sans-latin-400-normal.woff2","instrument-sans-latin-500-normal.woff2",
  "instrument-sans-latin-600-normal.woff2","dm-mono-latin-400-normal.woff2","dm-mono-latin-500-normal.woff2"
];
const hash=crypto.createHash("sha256");
for(const naam of CACHE_BRONNEN){
  const p=path.join(OUT,naam);
  if(!fs.existsSync(p))throw new Error("App-shellbestand ontbreekt voor mobiele cachehash: "+naam);
  hash.update(naam+"\0");hash.update(fs.readFileSync(p));hash.update("\0");
}
const versie="watishetweer-"+hash.digest("hex").slice(0,12);
const swPad=path.join(OUT,"sw.js");
let sw=fs.readFileSync(swPad,"utf8");
const aantal=(sw.match(/watishetweer-[0-9a-f]{12}/g)||[]).length;
if(aantal<1)throw new Error("Geen bestaande serviceworker-cachehash gevonden.");
sw=sw.replace(/watishetweer-[0-9a-f]{12}/g,versie);
if(!sw.includes(versie))throw new Error("Nieuwe mobiele cachehash niet toegepast.");
fs.writeFileSync(swPad,sw,"utf8");

console.log("Mobiele polish + checkpoint 25% geïnjecteerd; cache "+versie+".");
