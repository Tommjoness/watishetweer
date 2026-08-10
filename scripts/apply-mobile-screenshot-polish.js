"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const crypto=require("crypto");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
const mobileCss=fs.readFileSync(path.join(__dirname,"mobile-screenshot-polish.css"),"utf8");
const finalCss=fs.readFileSync(path.join(__dirname,"final-27-polish.css"),"utf8");
const mobileJs=fs.readFileSync(path.join(__dirname,"mobile-screenshot-polish.js"),"utf8");
const finalJs=fs.readFileSync(path.join(__dirname,"final-27-polish.js"),"utf8");
const uvBridgeJs=fs.readFileSync(path.join(__dirname,"final-27-uv-bridge.js"),"utf8");
const moonJs=fs.readFileSync(path.join(__dirname,"moon-v3-final.js"),"utf8");
let html=fs.readFileSync(htmlPad,"utf8");

const CSS_MARK="/* ===== MOBILE SCREENSHOT POLISH 20260810B CSS ===== */";
const FINAL_CSS_MARK="/* ===== FINAL CONSUMER POLISH 27 CSS ===== */";
const JS_MARK="/* ===== MOBILE SCREENSHOT POLISH 20260810B ===== */";
const FINAL_JS_MARK="/* ===== FINAL CONSUMER POLISH 27 ===== */";
const UV_BRIDGE_MARK="/* ===== FINAL UV BRIDGE ===== */";
const MOON_JS_MARK="/* ===== MOON PHASE V3 ===== */";
const START="/* ---------- start ---------- */";
if(html.includes(CSS_MARK)||html.includes(JS_MARK)||html.includes(FINAL_CSS_MARK)||html.includes(FINAL_JS_MARK)||html.includes(UV_BRIDGE_MARK)||html.includes(MOON_JS_MARK))throw new Error("Definitieve post-build polish is al geïnjecteerd.");
if((html.match(/<\/style>/g)||[]).length!==1)throw new Error("Exact één stijlblok vereist voor mobiele polish.");
if((html.split(START).length-1)!==1)throw new Error("Startmarker ontbreekt of is dubbel voor mobiele polish.");

html=html.replace("</style>",
  "\n"+CSS_MARK+"\n"+mobileCss+"\n/* ===== EINDE MOBILE SCREENSHOT POLISH 20260810B CSS ===== */\n"
  +FINAL_CSS_MARK+"\n"+finalCss+"\n/* ===== EINDE FINAL CONSUMER POLISH 27 CSS ===== */\n</style>");
html=html.replace(START,
  JS_MARK+"\n"+mobileJs+"\n/* ===== EINDE MOBILE SCREENSHOT POLISH 20260810B ===== */\n\n"
  +FINAL_JS_MARK+"\n"+finalJs+"\n/* ===== EINDE FINAL CONSUMER POLISH 27 ===== */\n\n"
  +UV_BRIDGE_MARK+"\n"+uvBridgeJs+"\n/* ===== EINDE FINAL UV BRIDGE ===== */\n\n"
  +MOON_JS_MARK+"\n"+moonJs+"\n/* ===== EINDE MOON PHASE V3 ===== */\n\n"+START);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline script na mobiele polish.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:mobile-polish-"+(i+1)}));
for(const vereist of [
  "WeatherNowMobileScreenshotPolish","Afgelopen kwartier","bron-bronnen",
  "WeatherNowFinale27","dag-mm","tooltipNeerslag","weerbriefing.plaatscache.v1",
  "WeatherNowUvBridge","WeatherNowMoonV3","maan-fase-svg-v3"
]){
  if(!html.includes(vereist))throw new Error("Definitieve polish-invariant ontbreekt: "+vereist);
}
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

console.log("Definitieve consumentenpolish geïnjecteerd; cache "+versie+".");
