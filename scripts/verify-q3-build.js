"use strict";

const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const vm=require("vm");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const html=fs.readFileSync(path.join(OUT,"index.html"),"utf8");
const sw=fs.readFileSync(path.join(OUT,"sw.js"),"utf8");

const exactEen=(tekst,naam)=>{
  const n=html.split(tekst).length-1;
  if(n!==1)throw new Error(naam+" moet exact één keer in de eindartifact staan; gevonden "+n+".");
};

exactEen("/* ===== CHECKPOINT 75 Q3 CSS ===== */","checkpoint-75 CSS-marker");
exactEen('if(n===100)return "Geheel bewolkt";','100%-bewolkingsregel');
exactEen('UV-gegevens voor vandaag worden bijgewerkt.','stale-dag UV-bescherming');
exactEen('Piek was rond ','verstreken UV-piekformulering');
exactEen('Piek rond ','toekomstige UV-piekformulering');
exactEen('const pUv=typeof plaatsTijdDelen','UV gebruikt live plaatsklok');

for(const vereist of [
  "slashed-zero",
  'font-feature-settings:"tnum" 1,"zero" 1',
  "function plaatsTijdDelen()",
  "timeZone:tz",
  "if(dag!==klokKalenderdag)",
  "#suntimes.senior-zoninfo",
  "pollenEenheid",
  '"korrel/m³"',
  '"korrels/m³"',
  "bron-bronnen"
]){
  if(!html.includes(vereist))throw new Error("Checkpoint-75 artifact mist invariant: "+vereist);
}

if((html.split('const basisMeters=meters;').length-1)!==2){
  throw new Error("Checkpoint 75 mag geen extra meters-wrapper introduceren; verwacht exact de bestaande senior- en Q1-owner.");
}

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:q3-verify-"+(i+1)}));

const CACHE_BRONNEN=[
  "index.html","manifest.json","icon-192.png","icon-512.png","icon-maskable-512.png",
  "bodoni-moda-latin-400-normal.woff2","bodoni-moda-latin-500-normal.woff2",
  "instrument-sans-latin-400-normal.woff2","instrument-sans-latin-500-normal.woff2",
  "instrument-sans-latin-600-normal.woff2","dm-mono-latin-400-normal.woff2","dm-mono-latin-500-normal.woff2"
];
const hash=crypto.createHash("sha256");
for(const naam of CACHE_BRONNEN){
  const p=path.join(OUT,naam);
  if(!fs.existsSync(p))throw new Error("App-shellbestand ontbreekt: "+naam);
  hash.update(naam+"\0");hash.update(fs.readFileSync(p));hash.update("\0");
}
const verwacht="watishetweer-"+hash.digest("hex").slice(0,12);
if(!sw.includes(verwacht))throw new Error("Serviceworker-cachehash volgt checkpoint-75 artifact niet: verwacht "+verwacht+".");

console.log("Checkpoint-75 artifact geverifieerd: geen nieuwe runtime-owner, live lokale tijdankers, zon/pollen, slashed zero, cloud 100% en UV-tijdsemantiek; cache "+verwacht+".");
