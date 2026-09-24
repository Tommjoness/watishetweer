"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-bediening-20260924";
const OWNER_ID="wiw-first-screen-20260924";

/* Bediening. Presentatie van bestaande knoppen en links; gedrag en data blijven
   bij hun eigen lagen.
   - Zoeksuggesties: op mobiel stond de regio direct achter de naam
     ("UtrechtNederland"), omdat de optie daar een flexrij is. Naam en regio
     staan nu onder elkaar, zoals op desktop.
   - Tapdoelen: op een touchscherm minstens 44px ("Zicht en maan", Delen,
     kruimelpad en plaatsen in de buurt waren 18 tot 38px). Met een muis
     minstens 24px (WCAG 2.5.8) voor footer- en plaatslinks.
   - "Meer nachten bekijken" leek op desktop een sectiekop; het is een knop en
     ziet er nu ook zo uit. */
const CSS=`
@media(max-width:900px){
  html body .results>div{flex-direction:column!important;align-items:flex-start!important;justify-content:center!important;row-gap:1px}
  html body #chips #chipdeel{min-width:44px;justify-content:center}
  html body #nights .nacht-meta-details>summary{display:inline-flex;align-items:center;min-height:44px}
  html body .seo-breadcrumb a,html body .seo-route-nearby-links a{display:inline-flex;align-items:center;min-height:44px}
}
@media(min-width:901px){
  html body footer a,html body .seo-breadcrumb a,html body .seo-route-nearby-links a,html body .seo-plaatsnav-links a{display:inline-flex;align-items:center;min-height:24px}
  html body #nights .nacht-meer{display:inline-flex!important;width:auto!important;min-height:36px;margin:12px 0 0!important;padding:0 14px!important;border:1px solid var(--rule)!important;color:var(--ink)!important;font-size:13px!important;letter-spacing:0!important;text-transform:none!important;cursor:pointer}
  html body #nights .nacht-meer:hover,html body #nights .nacht-meer:focus-visible{border-color:var(--ink-45)!important}
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
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": bedieningslaag staat al in artifact.");
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
  if(!geraakt)throw new Error("Geen weerartifact geraakt door bedieningslaag.");
  const cache=vernieuwServiceworkerCache(OUT,"bediening-20260924");
  console.log("Bedieningslaag toegepast op "+geraakt+" weerartifacts: zoeksuggesties onder elkaar, tapdoelen 44px/24px, Meer nachten als knop; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,OWNER_ID,CSS,htmlBestanden,pasToe,main};
