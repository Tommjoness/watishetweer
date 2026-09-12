"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");
const {MARK,GRAFIEK_OUD,GRAFIEK_NIEUW,POLLEN_TRUE_OUD,POLLEN_TRUE_NIEUW,POLLEN_FALSE_OUD,POLLEN_FALSE_NIEUW,htmlBestanden}=require("./apply-mobile-chart-pollen-polish-20260912.js");

const OUT=path.join(__dirname,"..","public");
const ZICHTBARE_MARK="/* ===== MOBILE GRAFIEK + POLLEN POLISH 20260912 ===== */";
if(!MARK.startsWith("<!--")||!MARK.endsWith("-->"))throw new Error("Mobile/pollen-polishmarker moet een onzichtbare HTML-comment zijn.");
let geraakt=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(MARK))continue;
  geraakt++;
  const rel=path.relative(OUT,p);
  if(html.includes(ZICHTBARE_MARK))throw new Error(rel+": zichtbare CSS-commentmarker staat als paginatekst in artifact.");
  if(html.includes(GRAFIEK_OUD))throw new Error(rel+": mobiele zes-uurslabelselectie staat nog in artifact.");
  if(!html.includes(GRAFIEK_NIEUW))throw new Error(rel+": mobiele drie-uurslabelselectie ontbreekt.");
  if(html.includes(POLLEN_TRUE_OUD)||html.includes(POLLEN_FALSE_OUD))throw new Error(rel+": technische pollen-modelcopy staat nog in artifact.");
  if(!html.includes(POLLEN_TRUE_NIEUW)||!html.includes(POLLEN_FALSE_NIEUW))throw new Error(rel+": natuurlijke basispollencopy ontbreekt.");
  for(const tekst of ["Weinig pollen verwacht voor dit uur.","Veel pollen verwacht voor dit uur."]){
    if(!html.includes(tekst))throw new Error(rel+": pollen hoeveelheidscopy ontbreekt: "+tekst);
  }
  if(!html.includes('concentratie!==null&&concentratie<10')||!html.includes('concentratie!==null&&concentratie>=200'))
    throw new Error(rel+": pollenpresentatie mist de brede concentratiebanden.");
  const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  if(!scripts.length)throw new Error(rel+": geen inline runtime voor syntaxcontrole.");
  scripts.forEach((code,i)=>new vm.Script(code,{filename:rel+":verify-mobile-pollen-"+(i+1)}));
}
if(!geraakt)throw new Error("Geen artifact met mobile/pollen-polishmarker gevonden.");
const cache=verifieerServiceworkerCache(OUT,"mobile-chart-pollen-polish");
console.log("Mobile/pollen-polish geverifieerd op "+geraakt+" weerartifacts: marker blijft onzichtbaar, drie-uurs mobiele temperatuurreferenties, collision-owner intact en natuurlijke geen/weinig/wel/veel-pollencopy; cache "+cache+".");
