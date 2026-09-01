"use strict";

const fs=require("fs");
const path=require("path");
const OUT=path.join(__dirname,"..","public");
const MARKER="<!-- ===== PRIMARY METRIC GRID 20260901 ===== -->";

function htmlBestanden(dir){
  const uit=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())uit.push(...htmlBestanden(p));
    else if(e.isFile()&&e.name==="index.html")uit.push(p);
  }
  return uit;
}
function hoofdgrid(html){
  const start=html.indexOf('<div class="stats">');
  const eind=html.indexOf('<div class="dashrow dashrow-chart">',start);
  if(start<0||eind<0||eind<=start)throw new Error("Primair metriekgrid kon niet worden afgebakend.");
  return html.slice(start,eind);
}

let aantal=0;
for(const pad of htmlBestanden(OUT)){
  const html=fs.readFileSync(pad,"utf8");
  if(!html.includes("WeatherNowFinalGlobalCorrectness")||!html.includes("WeatherNowGlobalLocationHardening"))continue;
  aantal++;
  const rel=path.relative(OUT,pad)||"index.html",grid=hoofdgrid(html);
  const tegels=(grid.match(/<div class="stat(?: [^"]*)?">/g)||[]).length;
  const eisen=[
    [html.includes(MARKER),"metriekgridmarker"],
    [tegels===8,`exact acht zichtbare hoofdtegels (gevonden ${tegels})`],
    [!grid.includes('id="pres"'),"geen luchtdruk in zichtbaar hoofdgrid"],
    [html.includes('<div id="wiw-pressure-diagnostic" hidden aria-hidden="true">'),"verborgen interne drukdiagnostiek"],
    [html.includes('<div class="stat"><div class="eyebrow">UV-piek vandaag</div><div class="sval" id="uv">'),"UV is een normale rastertegel"],
    [!html.includes('<div class="stat breed"><div class="eyebrow">UV-piek vandaag</div>'),"UV beslaat geen volle rij"],
    [html.includes('0:["Vrijwel onbewolkt","zon"]'),"minder absolute heldercopy overdag"],
    [html.includes('const CODESNACHT={0:"Vrijwel helder",1:"Overwegend helder",2:"Half bewolkt"};'),"minder absolute heldercopy 's nachts"]
  ];
  for(const [ok,naam] of eisen)if(!ok)throw new Error(rel+": ontbreekt: "+naam);
}
if(!aantal)throw new Error("Geen weerpagina's gevonden voor primaire metriekgridverificatie.");
console.log(`Primaire metriekgrid geverifieerd op ${aantal} weerpagina's: 8 zichtbare tegels, geen zichtbare luchtdruk, UV in raster en genuanceerde heldercopy.`);
