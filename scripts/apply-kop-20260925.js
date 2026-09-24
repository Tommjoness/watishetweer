"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-kop-20260925";
const OWNER_ID="wiw-onderkant-20260925";
const CHIPS='<div class="chips" id="chips"></div>';
const STAMP='<span id="stamp" aria-live="polite"></span>';

/* Kop. Op desktop is de kop een raster van twee kolommen: links titel en
   plaats, rechts zoekbalk en ophaaltijd. De regel met opgeslagen plaatsen,
   Bewaren en Delen stond daaronder over de volle breedte, terwijl de knoppen
   alleen links staan. Rechts bleef zo'n 110px leeg en briefing en tegels
   begonnen pas daaronder, met de lijn van de briefing 18px lager dan die van de
   tegels.
   Deze laag zet #chips bij de build direct onder de ophaaltijd in de
   rechterkolom, vanaf 1100px op één regel met de tijd: opgeslagen plaatsen
   horen bij het zoeken. Op mobiel blijft de
   volgorde gelijk (zoekbalk, tijd, knoppen). Daarna starten briefing en tegels
   op dezelfde lijn. De runtime vindt #chips op id; geen CSS hangt aan de oude
   plek. */
const CSS=`
html body .mastright>#chips{flex:0 0 100%;width:100%;margin-top:10px!important;align-items:flex-start!important;text-align:left!important}
html body .mastright>#chips .chiprij{justify-content:flex-start!important}
@media(min-width:1100px){
  /* Knoppen links en ophaaltijd rechts op één regel onder de zoekbalk; bij
     veel opgeslagen plaatsen of een smalle kolom loopt de tijd door naar de
     volgende regel. */
  html body .mast>.mastright{flex-direction:row!important;flex-wrap:wrap!important;align-items:center!important;align-content:flex-start!important;column-gap:16px}
  html body .mastright>.tools{flex:0 0 100%!important}
  html body .mastright>#chips{order:1;flex:0 1 auto!important;width:auto!important;margin-top:8px!important}
  html body .mastright>#stamp{order:2;flex:0 1 auto!important;width:auto!important;margin:8px 0 0 auto!important;text-align:right}
  /* De lijn boven briefing en tegels scheidt nu de kop van de inhoud; een
     tweede lijn onder de plaatsnaam 24px erboven is dan dubbel. */
  html body .mast #place{border-bottom:0!important;padding-bottom:0!important}
}
@media(min-width:901px){
  html body #app>.final-top-grid{margin-top:20px!important}
  html body .final-top-left>#brief{margin-top:0!important;padding-top:16px!important}
}
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

const tel=(bron,zoek)=>String(bron).split(zoek).length-1;

function pasToe(html,rel){
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": koplaag staat al in artifact.");
  if(tel(html,CHIPS)!==1)throw new Error(rel+": lege #chips-container niet exact eenmaal gevonden.");
  if(tel(html,STAMP)!==1)throw new Error(rel+": #stamp niet exact eenmaal gevonden.");
  if(!html.includes("</head>"))throw new Error(rel+": headafsluiting ontbreekt.");
  let uit=html.replace(CHIPS,"");
  uit=uit.replace(STAMP,STAMP+"\n      "+CHIPS);
  const stamp=uit.indexOf(STAMP),chips=uit.indexOf(CHIPS),mastright=uit.lastIndexOf('<div class="mastright">',stamp);
  if(mastright<0||chips<stamp)throw new Error(rel+": #chips staat na verplaatsen niet in .mastright onder #stamp.");
  return uit.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
}

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    const html=fs.readFileSync(p,"utf8");
    if(!html.includes(`id="${OWNER_ID}"`))continue;
    fs.writeFileSync(p,pasToe(html,path.relative(OUT,p)),"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerartifact geraakt door koplaag.");
  const cache=vernieuwServiceworkerCache(OUT,"kop-20260925");
  console.log("Koplaag toegepast op "+geraakt+" weerartifacts: opgeslagen plaatsen en Delen onder de zoekbalk, briefing en tegels op één lijn; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,OWNER_ID,CHIPS,STAMP,CSS,htmlBestanden,pasToe,main};
