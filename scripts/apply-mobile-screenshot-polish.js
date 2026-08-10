"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const crypto=require("crypto");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
const css=fs.readFileSync(path.join(__dirname,"mobile-screenshot-polish.css"),"utf8");
const js=fs.readFileSync(path.join(__dirname,"mobile-screenshot-polish.js"),"utf8");
let html=fs.readFileSync(htmlPad,"utf8");

const CSS_MARK="/* ===== MOBILE SCREENSHOT POLISH 20260810B CSS ===== */";
const JS_MARK="/* ===== MOBILE SCREENSHOT POLISH 20260810B ===== */";
const START="/* ---------- start ---------- */";
if(html.includes(CSS_MARK)||html.includes(JS_MARK))throw new Error("Mobiele screenshot-polish is al geïnjecteerd.");
if((html.match(/<\/style>/g)||[]).length!==1)throw new Error("Exact één stijlblok vereist voor mobiele polish.");
if((html.split(START).length-1)!==1)throw new Error("Startmarker ontbreekt of is dubbel voor mobiele polish.");

html=html.replace("</style>","\n"+CSS_MARK+"\n"+css+"\n/* ===== EINDE MOBILE SCREENSHOT POLISH 20260810B CSS ===== */\n</style>");
html=html.replace(START,JS_MARK+"\n"+js+"\n/* ===== EINDE MOBILE SCREENSHOT POLISH 20260810B ===== */\n\n"+START);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline script na mobiele polish.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:mobile-polish-"+(i+1)}));
for(const vereist of ["WeatherNowMobileScreenshotPolish","maan-fase-svg-v2","Afgelopen kwartier","bron-bronnen"]){
  if(!html.includes(vereist))throw new Error("Mobiele polish-invariant ontbreekt: "+vereist);
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

console.log("Mobiele screenshot-polish geïnjecteerd; cache "+versie+".");
