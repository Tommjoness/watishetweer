"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-nachtzicht-20260925";
const OWNER_ID="wiw-kop-20260925";

/* Nachtzicht op mobiel. Een nacht besloeg vier regels (118px): nacht, score,
   balk en bewolking; dan het oordeel; dan de beste periode; dan een aparte
   regel "Zicht en maan". Deze laag maakt er twee regels van (74px):
   - regel 1: nacht, score, balk en bewolking in vaste kolommen, zodat de
     scores van alle nachten onder elkaar staan;
   - regel 2: oordeel en beste periode naast elkaar, rechts een uitklappijl van
     44px. De samenvatting houdt haar tekst "Zicht en maan" als toegankelijke
     naam; de details klappen onder de tekst open en de pijl verspringt niet.
   Verborgen extra nachten ([hidden]) blijven verborgen. Desktop blijft de
   bestaande tabel. */
const CSS=`
@media(max-width:900px){
  html body #nights .row.night:not(.kop):not([hidden]):not(#wiw-nacht){display:grid!important;grid-template-columns:64px 44px minmax(36px,1fr) minmax(44px,auto)!important;column-gap:10px!important;row-gap:0!important;align-items:center!important;padding-top:10px!important;padding-bottom:0!important;min-height:0!important}
  html body #nights .row.night.kop:not(#wiw-nacht){grid-template-columns:64px 44px minmax(36px,1fr) minmax(44px,auto)!important;column-gap:10px!important}
  html body #nights .row.night:not(.kop):not(#wiw-nacht)>.dname{grid-row:1!important;grid-column:1!important}
  html body #nights .row.night:not(.kop):not(#wiw-nacht)>.score{grid-row:1!important;grid-column:2!important}
  html body #nights .row.night:not(.kop):not(#wiw-nacht)>.sbar{grid-row:1!important;grid-column:3!important;width:auto!important;min-width:0!important}
  html body #nights .row.night:not(.kop):not(#wiw-nacht)>.nmeta:not(.wide){grid-row:1!important;grid-column:4!important;justify-self:end!important;text-align:right!important}
  /* Tweede regel: oordeel en beste periode naast elkaar; de uitklapper staat
     rechtsboven en de inhoud klapt onder de tekst open */
  html body #nights .row.night:not(.kop):not(#wiw-nacht)>.nmeta.wide{display:grid!important;position:relative!important;grid-row:2!important;grid-column:1/-1!important;grid-template-columns:auto minmax(0,1fr)!important;column-gap:10px!important;align-items:start!important;width:auto!important;min-height:44px!important;margin:0!important;padding:0 44px 0 0!important}
  html body #nights .row.night:not(.kop):not(#wiw-nacht) .nachtadvies{grid-row:1!important;grid-column:1!important;width:auto!important;margin:0!important;padding:12px 0 0!important;line-height:20px!important;white-space:nowrap}
  html body #nights .row.night:not(.kop):not(#wiw-nacht) .nachtvenster{grid-row:1!important;grid-column:2!important;width:auto!important;margin:0!important;padding:14px 0 12px!important;line-height:1.35!important}
  html body #nights .row.night:not(.kop):not(#wiw-nacht) details.nacht-meta-details{grid-row:2!important;grid-column:1/-1!important;position:static!important;width:auto!important;margin:0!important;padding:0!important;display:block!important;min-height:0!important;border:0!important}
  html body #nights .row.night:not(.kop):not(#wiw-nacht) details.nacht-meta-details>summary{position:absolute!important;top:0!important;right:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:44px!important;min-width:44px!important;height:44px!important;margin:0!important;padding:0!important;font-size:0!important;border:0!important;box-shadow:none!important;text-decoration:none!important;list-style:none}
  html body #nights .row.night:not(.kop):not(#wiw-nacht) details.nacht-meta-details>summary::after{content:"⌄"!important;font-size:18px!important;line-height:1!important;color:var(--ink-70);display:inline-block!important;transform:none}
  html body #nights .row.night:not(.kop):not(#wiw-nacht) details.nacht-meta-details[open]>summary::after{transform:rotate(180deg)!important}
  html body #nights .row.night:not(.kop):not(#wiw-nacht) details.nacht-meta-details>.nachtmaan,html body #nights .row.night:not(.kop):not(#wiw-nacht) details.nacht-meta-details>.nachtmaan *{text-align:left!important}
  html body #nights .row.night:not(.kop):not(#wiw-nacht) details.nacht-meta-details>.nachtmaan{display:block!important;padding:0 0 10px!important}
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

function pasToe(html,rel){
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": nachtzichtlaag staat al in artifact.");
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
  if(!geraakt)throw new Error("Geen weerartifact geraakt door nachtzichtlaag.");
  const cache=vernieuwServiceworkerCache(OUT,"nachtzicht-20260925");
  console.log("Nachtzichtlaag toegepast op "+geraakt+" weerartifacts: mobiel twee regels per nacht met uitklapper; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,OWNER_ID,CSS,htmlBestanden,pasToe,main};
