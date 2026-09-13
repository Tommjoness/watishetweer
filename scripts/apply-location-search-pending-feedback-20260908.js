"use strict";

const fs=require("fs"),path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="/* ===== LOCATION SEARCH PENDING FEEDBACK 20260908 ===== */";
const SECTIE_START="/* ---------- zoeken ---------- */";
const SECTIE_EIND="/* ---------- actuele locatie ---------- */";
const TIMER_OUD='  timer=setTimeout(async()=>{\n    try{';
const TIMER_NIEUW=`  timer=setTimeout(async()=>{\n    ${MARKER}\n    zoekMeldingToon("Plaatsen zoeken…");\n    try{`;
const SUCCES_OUD='      if(generatie!==zoekGeneratie)return;\n      const resultaten=uniekeZoekResultaten(Array.isArray(d.results)?d.results:[]);';
const SUCCES_NIEUW='      if(generatie!==zoekGeneratie)return;\n      zoekMelding.classList.remove("on");zoekMelding.textContent="";\n      const resultaten=uniekeZoekResultaten(Array.isArray(d.results)?d.results:[]);';

function exactEen(bron,oud,nieuw,label){
  const n=String(bron).split(oud).length-1;
  if(n!==1)throw new Error(`${label}: verwacht exact één anker, gevonden ${n}.`);
  return String(bron).replace(oud,nieuw);
}

function pasHtmlToe(html){
  const bron=String(html||"");
  const begin=bron.indexOf(SECTIE_START),eind=bron.indexOf(SECTIE_EIND,begin+SECTIE_START.length);
  if(begin<0||eind<0)return bron;
  const voor=bron.slice(0,begin),na=bron.slice(eind);
  let sectie=bron.slice(begin,eind);
  if(sectie.includes(MARKER))throw new Error("Location-search pending feedback staat al in artifact.");
  sectie=exactEen(sectie,TIMER_OUD,TIMER_NIEUW,"zoek-debounce-start");
  sectie=exactEen(sectie,SUCCES_OUD,SUCCES_NIEUW,"zoek-succes-cleanup");
  return voor+sectie+na;
}

function htmlBestanden(dir){
  const uit=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())uit.push(...htmlBestanden(p));
    else if(e.isFile()&&e.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function main(){
  let n=0;
  for(const p of htmlBestanden(OUT)){
    const oud=fs.readFileSync(p,"utf8"),nieuw=pasHtmlToe(oud);
    if(nieuw===oud)continue;
    fs.writeFileSync(p,nieuw,"utf8");n++;
  }
  if(!n)throw new Error("Geen interactieve weerartifacts gevonden voor location-search pending feedback.");
  const cache=vernieuwServiceworkerCache(OUT,"location-search-pending-feedback-20260908");
  console.log(`Location-search pending feedback toegepast op ${n} weerpagina's; bestaande zoekmelding toont nu de geocoder-wachtstatus; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,MARKER,SECTIE_START,SECTIE_EIND,TIMER_OUD,TIMER_NIEUW,SUCCES_OUD,SUCCES_NIEUW,exactEen,pasHtmlToe,htmlBestanden,main};
