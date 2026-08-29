"use strict";
const fs=require("fs");
const path=require("path");
const ROOT=path.join(__dirname,"..");
const PUBLIC=path.join(ROOT,"public");
const html=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
const matches=[...html.matchAll(/<script\b[^>]*\bsrc=["']\/(app-[0-9a-f]{12}\.min\.js)["'][^>]*>/gi)];
const namen=[...new Set(matches.map(m=>m[1]))];
if(namen.length!==1)throw new Error("Verwacht exact één homepage-appbundle in index.html, gevonden: "+namen.join(", "));
const naam=namen[0];
const bron=fs.readFileSync(path.join(PUBLIC,naam),"utf8");
const regels=bron.split("\n");
const posities=[[1,17072],[2,24807],[2,117072],[2,149239],[2,154846],[3,58270]];
console.log("PAGESPEED REFLOW DIAGNOSTIC bundle="+naam+" regels="+regels.length+" bytes="+Buffer.byteLength(bron));
for(const [regelNummer,kolom] of posities){
  const regel=regels[regelNummer-1]||"";
  const start=Math.max(0,kolom-260),eind=Math.min(regel.length,kolom+260);
  console.log(`REFLOW_POS ${regelNummer}:${kolom} len=${regel.length} :: ${regel.slice(start,eind)}`);
}
const patronen=["getBoundingClientRect","getClientRects","getComputedTextLength","getBBox","offsetWidth","offsetHeight","offsetTop","offsetLeft","clientWidth","clientHeight","scrollWidth","scrollHeight","scrollIntoView","innerWidth","innerHeight","getComputedStyle"];
for(const patroon of patronen){
  let vanaf=0,aantal=0;
  while(true){
    const i=bron.indexOf(patroon,vanaf);if(i<0)break;
    aantal++;
    const voor=bron.slice(0,i),regelNummer=voor.split("\n").length,laatste=voor.lastIndexOf("\n"),kolom=i-(laatste+1);
    console.log(`LAYOUT_API ${patroon} #${aantal} @ ${regelNummer}:${kolom} :: ${bron.slice(Math.max(0,i-220),Math.min(bron.length,i+320))}`);
    vanaf=i+patroon.length;
  }
}
