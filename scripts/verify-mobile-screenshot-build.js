"use strict";

const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
const swPad=path.join(OUT,"sw.js");
if(!fs.existsSync(htmlPad)||!fs.existsSync(swPad))throw new Error("Definitieve public-artifact ontbreekt.");

const html=fs.readFileSync(htmlPad,"utf8");
for(const vereist of [
  "WeatherNowMobileScreenshotPolish",
  "Afgelopen kwartier",
  "pollenEenheid",
  "grid-template-columns:62px 58px minmax(0,1fr) 76px",
  "bron-bronnen",
  "MOBILE SCREENSHOT POLISH 20260810B",
  "WeatherNowFinale27",
  "dag-mm",
  "tooltipNeerslag",
  "weerbriefing.plaatscache.v1",
  "FINAL CONSUMER POLISH 27",
  "WeatherNowFinalCopy",
  "FINAL DUTCH COPY",
  "WeatherNowUvBridge",
  "FINAL UV BRIDGE",
  "WeatherNowMoonV3",
  "maan-fase-svg-v3",
  "MOON PHASE V3"
]){
  if(!html.includes(vereist))throw new Error("Definitieve productie-invariant ontbreekt: "+vereist);
}

const CACHE_BRONNEN=[
  "index.html","manifest.json","icon-192.png","icon-512.png","icon-maskable-512.png",
  "bodoni-moda-latin-400-normal.woff2","bodoni-moda-latin-500-normal.woff2",
  "instrument-sans-latin-400-normal.woff2","instrument-sans-latin-500-normal.woff2",
  "instrument-sans-latin-600-normal.woff2","dm-mono-latin-400-normal.woff2","dm-mono-latin-500-normal.woff2"
];
const hash=crypto.createHash("sha256");
for(const naam of CACHE_BRONNEN){
  const p=path.join(OUT,naam);
  if(!fs.existsSync(p))throw new Error("App-shellbestand ontbreekt in definitieve artifact: "+naam);
  hash.update(naam+"\0");hash.update(fs.readFileSync(p));hash.update("\0");
}
const verwacht="watishetweer-"+hash.digest("hex").slice(0,12);
const sw=fs.readFileSync(swPad,"utf8");
const m=/const CACHE = "([^"]+)";/.exec(sw);
if(!m)throw new Error("Serviceworker-cache-id ontbreekt in definitieve artifact.");
if(m[1]!==verwacht)throw new Error("Serviceworker-cache hoort bij een andere artifact: "+m[1]+" versus "+verwacht);

console.log("Definitieve consumentenartifact geverifieerd: "+verwacht+".");
