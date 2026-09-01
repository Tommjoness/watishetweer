"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {MARKER,GLOBAL_MARKER,corrigeerBriefingTransportTekst}=require("./apply-final-briefing-grammar-20260901.js");
const policy=require("./final-global-correctness-20260901.js");

const OUT=path.join(__dirname,"..","public");
function htmls(dir){
  const uit=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())uit.push(...htmls(p));
    else if(e.isFile()&&e.name==="index.html")uit.push(p);
  }
  return uit;
}

assert.equal(policy.corrigeerGradenTekst("1 graden"),"1 graad");
assert.equal(policy.corrigeerGradenTekst("-1 graden"),"-1 graad");
assert.equal(policy.corrigeerGradenTekst("0 graden en 2 graden"),"0 graden en 2 graden");
assert.equal(corrigeerBriefingTransportTekst("1\u00a0graden",policy.corrigeerGradenTekst),"1\u00a0graad");
assert.equal(corrigeerBriefingTransportTekst("-1\u00a0graden",policy.corrigeerGradenTekst),"-1\u00a0graad");
assert.equal(corrigeerBriefingTransportTekst("6\u00a0graden",policy.corrigeerGradenTekst),"6\u00a0graden");

let aantal=0;
for(const p of htmls(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(GLOBAL_MARKER))continue;
  aantal++;
  const rel=path.relative(OUT,p)||"index.html";
  assert.equal(html.split(MARKER).length-1,1,rel+": briefinggrammaticamarker ontbreekt of is dubbel");
  assert(html.includes("const basisBriefingGrammar=briefing;"),rel+": finale briefingwrapper ontbreekt");
  assert(html.includes("corrigeerBriefingTransportTekst(oud,G.corrigeerGradenTekst)"),rel+": centrale grammatica-policy en NBSP-adapter worden niet samen gebruikt");
  assert(html.includes("briefing=function(){const r=basisBriefingGrammar.apply(this,arguments);corrigeerBriefingGrammatica();return r;};"),rel+": iedere briefingrender wordt niet gecorrigeerd");
  const globalPos=html.indexOf(GLOBAL_MARKER),grammarPos=html.indexOf(MARKER),startPos=html.indexOf("/* ---------- start ---------- */");
  assert(globalPos>=0&&grammarPos>globalPos&&startPos>grammarPos,rel+": finale briefinggrammatica staat niet na global-correctness en vóór startup");
  const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach((bron,i)=>new vm.Script(bron,{filename:rel+":verify-final-briefing-grammar-"+(i+1)}));
}
if(!aantal)throw new Error("Geen final-global weerpagina's gevonden voor briefinggrammaticaverificatie.");
console.log("Finale briefinggrammatica geverifieerd op "+aantal+" weerpagina's: gewone spatie en NBSP, 1/-1 graad, iedere briefingrender en runtimevolgorde geborgd.");