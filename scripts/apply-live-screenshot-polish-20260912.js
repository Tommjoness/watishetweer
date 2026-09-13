"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-live-screenshot-polish-20260912";
const OWNER_ID="wiw-final-ui-polish-20260912";

/* Deze laag draait bewust ná platform-output-cleanup en mag daarom uitsluitend
   finale HTML/CSS-presentatie raken. Grafiekruntime en Q4-geometrie worden vóór
   delivery-cleanup door apply-live-chart-layout-fix-20260912.js aangepast. */
const CSS=`
@media(min-width:1100px){
  /* De echte Q4-layout bezit nu zelf de compacte hoogte. Neutraliseer uitsluitend
     de historische visuele -6px-transform zodat geometrie en pixels weer één
     bron van waarheid hebben. */
  #chart g[data-q4-rain-periods]{transform:none!important}

  /* Bovenaan iets minder lucht, zonder de rustige masthead te comprimeren. */
  .chips{margin-top:12px!important}
  .brief{margin-top:18px!important;padding-top:18px!important}

  /* De bron/disclaimerregels waren op grote desktop kleiner dan de rest van de
     informatieve microcopy. Gebruik een expliciete 20px regelhoogte en iets
     specifiekere selector zodat oudere footer-shorthands dit niet terugdrukken. */
  html body footer:nth-of-type(n){font-size:13px!important;line-height:20px!important;gap:4px 16px!important}
  html body footer:nth-of-type(n) .bron,html body footer:nth-of-type(n) .bron b,html body footer:nth-of-type(n) details,html body footer:nth-of-type(n) details summary,html body footer:nth-of-type(n) a{line-height:20px!important}

  /* Behoud de zachte overgang, maar maak de resterende lichte strook subtieler. */
  body > .seo-plaatsnav{margin-top:10px!important}
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

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    let html=fs.readFileSync(p,"utf8");
    if(!html.includes(`id="${OWNER_ID}"`))continue;
    const rel=path.relative(OUT,p);
    if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": live-screenshot-polish staat al in artifact.");
    if(!html.includes('id="chart"')||!html.includes('id="aq"')||!html.includes("</head>"))throw new Error(rel+": verwachte UI-hooks ontbreken.");
    html=html.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
    fs.writeFileSync(p,html,"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerartifact geraakt door live-screenshot-polish.");
  const cache=vernieuwServiceworkerCache(OUT,"live-screenshot-polish-20260912");
  console.log("Late live-screenshot CSS-polish toegepast op "+geraakt+" weerartifacts; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,OWNER_ID,CSS,htmlBestanden,main};
