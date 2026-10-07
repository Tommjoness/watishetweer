"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-ontwerp-20261007";
const OWNER_ID="wiw-desktop-premium-20260929";

/* Ontwerpronde 7 oktober (akkoord eigenaar op voor/na-screenshots):
   1. Zeven dagen: de min-maxbalk is een afgeronde balk van 6px op een zacht
      spoor, in kleur van de minimum- naar de maximumtemperatuur (het verloop
      zet de dagrenderer als --temp-verloop op de balk). Alle dagen houden
      dezelfde schaal.
   2. De maantjes in Nachtzicht hebben dezelfde kleuren als de getekende maan op
      /maan/ (lichte sikkel, donkere schaduw) en zijn 18px.
   3. Weericonen bij Zeven dagen en naast de huidige temperatuur zijn groter en
      iets steviger getekend.
   4. De zichtscorebalkjes in Nachtzicht zijn 5px hoog en afgerond, op een
      zichtbaar spoor; ook een score van 0 is als lege balk herkenbaar. De
      kopregel heeft geen balk.
   5. De temperatuurcijfers in de grafiek staan in de gewone letter (Instrument
      Sans, tabelcijfers) in plaats van de sierletter. */
const CSS=`
#days .row.day:not(.kop) .bar{height:6px!important;border-radius:3px!important;background:var(--rule)!important;position:relative!important;overflow:visible!important}
#days .row.day:not(.kop) .bar i{height:6px!important;border-radius:3px!important;top:0!important;background:var(--temp-verloop,var(--ink))!important}
.maan-fase-svg-v2 .maan-schaduw{fill:#3a4541!important;stroke:rgba(127,127,127,.55)!important}
.maan-fase-svg-v2 .maan-licht{fill:#f2ede1!important}
.maanbij .maan-fase-svg-v2,#moonlab .maan-fase-svg-v2{width:18px!important;height:18px!important;vertical-align:-4px!important}
#days .dico svg.ico{width:26px!important;height:26px!important}
#days .dico svg.ico *,#nowicon svg.ico *{stroke-width:1.45!important}
#nowicon svg.ico{width:58px!important;height:58px!important}
#nights .row.night:not(.kop) .sbar{height:5px!important;border-radius:3px!important;background:var(--rule)!important;overflow:hidden!important}
#nights .row.night:not(.kop) .sbar i{height:5px!important;border-radius:3px!important;display:block!important}
#chart text[font-family^="Bodoni"]{font-family:"Instrument Sans","Instrument Sans Fallback",system-ui,sans-serif!important;font-variant-numeric:tabular-nums;font-weight:500}
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
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": ontwerplaag staat al in artifact.");
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
  if(!geraakt)throw new Error("Geen weerartifact geraakt door de ontwerplaag.");
  const cache=vernieuwServiceworkerCache(OUT,"ontwerp-20261007");
  console.log("Ontwerplaag 7 oktober toegepast op "+geraakt+" weerartifacts: temperatuurbalken, maantjes, iconen, zichtscorebalkjes en grafiekcijfers; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,OWNER_ID,CSS,htmlBestanden,pasToe,main};
