"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");
const {OUT,htmlBestanden,gebundeldeWeerpagina}=require("./apply-kleur-20261012.js");

/* Leesbaarheidslaag (UX-opdracht oktober 2026): kleine, betekenisdragende teksten op de weerpagina
   (secundaire waarden in de uurtabel, uitleg bij de grafiek, tijdstempel, nachtregels). De CSS staat
   in scripts/leesbaarheid-20261021.css en komt vóór de voetlaag, die als laatste stijllaag blijft. */
const STYLE_ID="wiw-leesbaarheid-20261021";
const CSS=fs.readFileSync(path.join(__dirname,"leesbaarheid-20261021.css"),"utf8");

function pasToe(html,rel){
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": leesbaarheidslaag staat al in artifact.");
  if(html.split("</head>").length!==2)throw new Error(rel+": verwacht exact één </head>.");
  return html.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
}

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    const html=fs.readFileSync(p,"utf8");
    if(!gebundeldeWeerpagina(html))continue;
    fs.writeFileSync(p,pasToe(html,path.relative(OUT,p)),"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerpagina geraakt door de leesbaarheidslaag.");
  const cache=vernieuwServiceworkerCache(OUT,"leesbaarheid-20261021");
  console.log(`Leesbaarheidslaag toegepast op ${geraakt} weerpagina's; cache ${cache}.`);
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={STYLE_ID,CSS,pasToe,main};
