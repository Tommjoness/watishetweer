"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="<!-- ===== PRIMARY METRIC GRID 20260901 ===== -->";
const PRESSURE_TILE='<div class="stat"><div class="eyebrow">Luchtdruk op zeeniveau</div><div class="sval" id="pres">--</div><div class="ssub" id="pressub">&nbsp;</div></div>';
const PRESSURE_DIAGNOSTIC=`${MARKER}\n<div id="wiw-pressure-diagnostic" hidden aria-hidden="true">${PRESSURE_TILE}</div>`;
const UV_WIDE='<div class="stat breed"><div class="eyebrow">UV-piek vandaag</div><div class="sval" id="uv">--</div><div class="ssub" id="uvsub">&nbsp;</div></div>';
const UV_NORMAL='<div class="stat"><div class="eyebrow">UV-piek vandaag</div><div class="sval" id="uv">--</div><div class="ssub" id="uvsub">&nbsp;</div></div>';
const CLEAR_DAY_OLD='0:["Onbewolkt","zon"]';
const CLEAR_DAY_NEW='0:["Vrijwel onbewolkt","zon"]';
const CLEAR_NIGHT_OLD='const CODESNACHT={0:"Onbewolkt",1:"Overwegend helder",2:"Half bewolkt"};';
const CLEAR_NIGHT_NEW='const CODESNACHT={0:"Vrijwel helder",1:"Overwegend helder",2:"Half bewolkt"};';

function htmlBestanden(dir){
  const uit=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())uit.push(...htmlBestanden(p));
    else if(e.isFile()&&e.name==="index.html")uit.push(p);
  }
  return uit;
}
function exactEen(bron,oud,nieuw,naam){
  const n=bron.split(oud).length-1;
  if(n!==1)throw new Error(`${naam}: verwacht 1 anker, gevonden ${n}`);
  return bron.replace(oud,nieuw);
}
function pasToe(pad){
  let html=fs.readFileSync(pad,"utf8");
  if(!html.includes("WeatherNowFinalGlobalCorrectness")||!html.includes("WeatherNowGlobalLocationHardening"))return false;
  if(html.includes(MARKER))throw new Error("Primaire metriekgridlaag staat al in "+pad);

  html=exactEen(html,PRESSURE_TILE,"","zichtbare luchtdruktegel");
  html=exactEen(html,UV_WIDE,UV_NORMAL,"brede UV-tegel");
  html=exactEen(html,CLEAR_DAY_OLD,CLEAR_DAY_NEW,"dagcopy WMO-code 0");
  html=exactEen(html,CLEAR_NIGHT_OLD,CLEAR_NIGHT_NEW,"nachtcopy WMO-code 0");
  html=exactEen(html,"</body>",PRESSURE_DIAGNOSTIC+"\n</body>","verborgen drukdiagnostiek");

  const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach((bron,i)=>new vm.Script(bron,{filename:path.basename(pad)+":primary-metric-grid-"+(i+1)}));
  fs.writeFileSync(pad,html,"utf8");
  return true;
}

let aantal=0;
for(const pad of htmlBestanden(OUT))if(pasToe(pad))aantal++;
if(!aantal)throw new Error("Geen weerpagina's gevonden voor primaire metriekgridlaag.");
const versie=vernieuwServiceworkerCache(OUT,"primary-metric-grid-20260901");
console.log(`Primaire metriekgrid vereenvoudigd op ${aantal} weerpagina's: 8 zichtbare tegels, UV normaal, luchtdruk verborgen diagnostisch en minder absolute heldercopy; cache ${versie}.`);

module.exports={MARKER,PRESSURE_TILE,PRESSURE_DIAGNOSTIC,UV_WIDE,UV_NORMAL,CLEAR_DAY_OLD,CLEAR_DAY_NEW,CLEAR_NIGHT_OLD,CLEAR_NIGHT_NEW,pasToe};
