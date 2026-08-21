"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const ROOT=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(ROOT,"public","index.html"),"utf8");
const aantal=tekst=>html.split(tekst).length-1;

for(const verouderd of [
  "/* ===== UI POLISH RUNTIME 20260813 ===== */",
  "WeatherNowUiPolish20260813",
  "uiRegenperiodeDagprefix"
]){
  if(html.includes(verouderd))throw new Error("Historische UI-polishruntime staat nog in definitief artifact: "+verouderd);
}

if(aantal("/* ===== UI POLISH CSS 20260813 ===== */")!==1)
  throw new Error("Statische UI-polish CSS moet exact één keer aanwezig blijven.");
if(aantal('<main id="app" style="display:none">')!==1)
  throw new Error("Main-landmark ontbreekt of is dubbel na runtime-retirement.");
if(!html.includes("footer a,footer details summary{display:inline-flex;align-items:center;min-height:44px"))
  throw new Error("Mobiele footer-hitbox ontbreekt na runtime-retirement.");
if(!html.includes("/* ===== Q4 REGENPERIODEN 20260811 ===== */"))
  throw new Error("Q4-regenperiode-owner ontbreekt na runtime-retirement.");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline WeatherNow-runtime gevonden.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:runtime-retirement-"+(i+1)}));

console.log("UI-polish runtime-retirement geverifieerd: geen historische runtime/API, statische CSS/accessibility en Q4-owner intact.");
