"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const html=fs.readFileSync(path.join(OUT,"index.html"),"utf8");

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

/* Niet gokken hoeveel andere historische wrappers bestaan. Bewijs het relevante
   architectuurfeit: de Q3-UV-code staat binnen de al bestaande senior meters()-
   owner, vóór diens volgende briefing-wrapper. apply-q3 bewaakt daarnaast dat
   het totale aantal bestaande meters-owner-signatures vóór/na Q3 gelijk blijft. */
const uvPos=html.indexOf('const pUv=typeof plaatsTijdDelen');
const meterPos=html.lastIndexOf('const basisMeters=meters;',uvPos);
const briefingPos=html.indexOf('const basisBriefing=briefing;',uvPos);
if(uvPos<0||meterPos<0||briefingPos<0||!(meterPos<uvPos&&uvPos<briefingPos)){
  throw new Error("Checkpoint-75 UV-correctie staat niet aantoonbaar in de bestaande senior meters-owner.");
}

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:q3-verify-"+(i+1)}));

const verwacht=verifieerServiceworkerCache(OUT,"checkpoint-75");
console.log("Checkpoint-75 artifact geverifieerd: Q3 blijft in bestaande runtime-owner, live lokale tijdankers, zon/pollen, slashed zero, cloud 100% en UV-tijdsemantiek; cache "+verwacht+".");
