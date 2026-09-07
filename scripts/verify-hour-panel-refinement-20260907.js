"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {OUT,MARKER,UREN_OUD,UREN_NIEUW,MM_OUD,MM_NIEUW,htmlBestanden}=require("./apply-hour-panel-refinement-20260907.js");

function eis(ok,msg){if(!ok)throw new Error(msg);}
let geraakt=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes("WeatherNowFinalDesktopUI20260902"))continue;
  geraakt++;
  const rel=path.relative(OUT,p);
  eis(html.includes(MARKER),`${rel}: uurpaneelrefinement-marker ontbreekt`);
  eis(html.includes(UREN_NIEUW)&&!html.includes(UREN_OUD),`${rel}: desktoplimiet is niet exact 12 uur`);
  eis(html.includes(MM_NIEUW)&&!html.includes(MM_OUD),`${rel}: numerieke 0 mm wordt nog als ontbrekende waarde behandeld`);
  const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach((bron,i)=>new vm.Script(bron,{filename:`${rel}:hour-panel-${i+1}`}));
}
eis(geraakt>0,"Geen WeatherNow-artifacts gevonden om uurpaneelrefinement te verifiëren.");
console.log(`Uurpaneelrefinement geverifieerd op ${geraakt} weerartifacts: maximaal 12 desktopuren, 0 mm blijft 0 mm en ontbrekende waarden blijven een streep.`);
