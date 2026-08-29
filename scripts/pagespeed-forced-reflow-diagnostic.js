"use strict";
const fs=require("fs");
const path=require("path");
const ROOT=path.join(__dirname,"..");
const PUBLIC=path.join(ROOT,"public");
const bestanden=fs.readdirSync(PUBLIC).filter(n=>/^app-[0-9a-f]{12}\.min\.js$/.test(n));
if(bestanden.length!==1)throw new Error("Verwacht exact één homepage-appbundle, gevonden: "+bestanden.join(", "));
const naam=bestanden[0];
const bron=fs.readFileSync(path.join(PUBLIC,naam),"utf8");
const regels=bron.split("\n");
const posities=[
  [1,17072],[2,24807],[2,117072],[2,149239],[2,154846],[3,58270]
];
console.log("PAGESPEED REFLOW DIAGNOSTIC bundle="+naam+" regels="+regels.length+" bytes="+Buffer.byteLength(bron));
for(const [regelNummer,kolom] of posities){
  const regel=regels[regelNummer-1]||"";
  const start=Math.max(0,kolom-260),eind=Math.min(regel.length,kolom+260);
  console.log(`REFLOW_POS ${regelNummer}:${kolom} len=${regel.length} :: ${regel.slice(start,eind)}`);
}
const patronen=["getBoundingClientRect","getClientRects","offsetWidth","offsetHeight","offsetTop","offsetLeft","clientWidth","clientHeight","scrollWidth","scrollHeight","scrollIntoView","innerWidth","innerHeight","getComputedStyle"];
for(const patroon of patronen){
  let vanaf=0,aantal=0;
  while(true){
    const i=bron.indexOf(patroon,vanaf);if(i<0)break;
    aantal++;
    const voor=bron.slice(0,i),regelNummer=voor.split("\n").length,laatste=voor.lastIndexOf("\n"),kolom=i-(laatste+1);
    console.log(`LAYOUT_API ${patroon} #${aantal} @ ${regelNummer}:${kolom} :: ${bron.slice(Math.max(0,i-180),Math.min(bron.length,i+260))}`);
    vanaf=i+patroon.length;
  }
}
