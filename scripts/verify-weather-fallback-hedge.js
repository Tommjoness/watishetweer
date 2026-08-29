"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {BRON,PRODUCTIE}=require("./apply-weather-fallback-hedge.js");

const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
const aantal=(tekst)=>html.split(tekst).length-1;

if(aantal(BRON)!==0)throw new Error("Oud sequentieel weerfallbackblok staat nog in artifact.");
if(aantal(PRODUCTIE)!==1)throw new Error("Hedged weerfallback ontbreekt of staat dubbel: "+aantal(PRODUCTIE));
for(const invariant of [
  "const WEER_HEDGE_MS=5000;",
  "const WEER_FALLBACK_TIMEOUT_MS=7000;",
  "const volledigeBelofte=j(f,{timeoutMs:10000,signal:weerController.signal});",
  "fallbackBelofte=j(fmin,{timeoutMs:WEER_FALLBACK_TIMEOUT_MS,signal:weerController.signal})",
  "hedgeTimer=setTimeout(()=>resolve({soort:\"traag\"}),WEER_HEDGE_MS);",
  "if(mijnBeurt!==laadTeller) return;",
  "volledigeBelofte.then(geslaagd,mislukt);",
  "fallback.then(geslaagd,mislukt);"
]){
  if(!html.includes(invariant))throw new Error("Weerfallback-invariant ontbreekt: "+invariant);
}

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime in definitief artifact.");
scripts.forEach((code,i)=>new vm.Script(code,{filename:"public/index.html:verify-weather-fallback-"+(i+1)}));
console.log("Weather fallback artifact: 5s hedge, 10s volledige forecastcap, 7s fallbackcap, stale-load guards en eerste-successemantiek aanwezig.");
