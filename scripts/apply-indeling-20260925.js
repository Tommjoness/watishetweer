"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-indeling-20260925";
const OWNER_ID="wiw-kleur-20260925";

/* Indeling van het eerste scherm.
   - Desktop (vanaf 1100px): links briefing, waarschuwing en temperatuur,
     rechts de tegels. De linkerkolom is hoger; rechts onder de tegels bleef
     een lege strook en het modelsignaal stond daaronder over de volle
     breedte, zodat de grafiek op een laptop (1366x768) pas op y=699 begon.
     De runtime zet het modelsignaal als laatste in het raster; hier komt het
     rechts onder de tegels. De grafiek schuift zo'n 60px omhoog.
   - Tegels: de inhoud stond verticaal gecentreerd, dus bij een label over
     twee regels stonden labels en getallen in één rij op verschillende
     hoogtes (tot 19px). Inhoud bovenaan; de runtime geeft labels in één rij
     dezelfde hoogte, met de tekst onderaan, zodat de getallen op één lijn
     staan. */
const CSS=`
@media(min-width:1100px){
  html body #app>.final-top-grid{row-gap:0}
  html body .final-top-grid>.final-top-left{grid-column:1;grid-row:1 / span 2}
  html body .final-top-grid>.stats{grid-column:2;grid-row:1}
  html body .final-top-grid>#modelrisico{grid-column:2;grid-row:2;align-self:start;margin:14px 0 0!important;max-width:none}
}
html body .stats>.stat{justify-content:flex-start!important}
html body .stats>.stat>.eyebrow{display:flex;align-items:flex-end;justify-content:center}
`;

function htmlBestanden(dir){
  const uit=[];
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,item.name);
    if(item.isDirectory())uit.push(...htmlBestanden(p));
    else if(item.isFile()&&item.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function pasToe(html,rel){
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": indelingslaag staat al in artifact.");
  if(!html.includes("</head>"))throw new Error(rel+": headafsluiting ontbreekt.");
  return html.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
}

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    const html=fs.readFileSync(p,"utf8");
    if(!html.includes(`id="${OWNER_ID}"`))continue;
    fs.writeFileSync(p,pasToe(html,path.relative(OUT,p)),"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerartifact geraakt door indelingslaag.");
  const cache=vernieuwServiceworkerCache(OUT,"indeling-20260925");
  console.log("Indelingslaag toegepast op "+geraakt+" weerartifacts: modelsignaal rechts onder de tegels op desktop, tegellabels en getallen op één lijn; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,OWNER_ID,CSS,htmlBestanden,pasToe,main};
