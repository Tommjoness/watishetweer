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
  "maan-fase-svg-v2",
  "Temperatuurtrend",
  "temperatuurTrend",
  "q1-pop-hidden",
  "pollenEenheid",
  "grid-template-columns:62px 58px minmax(0,1fr) 76px",
  "bron-bronnen",
  "MOBILE SCREENSHOT POLISH 20260810B",
  "WeatherNowQ1",
  "q1-dag-mm",
  "weerbriefing.plaatscache.q1",
  "CHECKPOINT 25 Q1"
]){
  if(!html.includes(vereist))throw new Error("Definitieve productie-invariant ontbreekt: "+vereist);
}
const oude15='<div class="eyebrow">Afgelopen 15 minuten</div><div class="sval" id="prec">';
const oudeKwartier="Afgelopen kwartier";
const trend='<div class="eyebrow">Temperatuurtrend</div><div class="sval" id="prec">';
if(html.includes(oude15)||html.includes(oudeKwartier))throw new Error("Verwijderde recente-neerslagtegel staat nog in de definitieve artifact.");
if((html.split(trend).length-1)!==1)throw new Error("Definitieve temperatuurtrendtegel ontbreekt of is dubbel.");
if(html.includes("const recenteNeerslag=eindigGetal(c.precipitation)"))throw new Error("Legacy recente-neerslagberekening staat nog in de definitieve artifact.");
if(html.includes("compactRecentLabel"))throw new Error("Legacy kwartier-wrapper staat nog in de definitieve artifact.");

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

console.log("Definitieve checkpoint-25 artifact geverifieerd: "+verwacht+".");
