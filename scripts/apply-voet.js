"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");
const {OUT,htmlBestanden,gebundeldeWeerpagina}=require("./apply-kleur-20261012.js");

/* Voetlaag (eigenaar, 13 oktober): één eigenaar voor nieuwe voetstijl. De CSS
   staat in scripts/voet.css en komt als laatste stijllaag vóór </head> van iedere
   gebundelde weerpagina, na alle ontwerprondes. */
const STYLE_ID="wiw-voet";
const CSS=fs.readFileSync(path.join(__dirname,"voet.css"),"utf8");

function pasToe(html,rel){
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": voetlaag staat al in artifact.");
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
  if(!geraakt)throw new Error("Geen weerpagina geraakt door de voetlaag.");
  const cache=vernieuwServiceworkerCache(OUT,"voet");
  console.log(`Voetlaag toegepast op ${geraakt} weerpagina's; cache ${cache}.`);
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={STYLE_ID,CSS,pasToe,main};
