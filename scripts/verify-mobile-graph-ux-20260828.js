"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");

for(const vereist of [
  "/* ===== MOBILE GRAPH UX 20260828 ===== */",
  "/* ===== MOBILE GRAPH UX 20260828 CSS ===== */",
  "WeatherNowMobileGraphUX20260828",
  "data-mobile-hour-axis",
  "kiesUurLabelIndices",
  "kans · hoeveelheid onzeker",
  "Bronnen voor deze weergave",
  "#suntimes{",
  "#nights .nacht-meer::after",
  "return Array.isArray(perioden)?perioden.slice():[];"
])if(!html.includes(vereist))throw new Error("Mobile-graph-UX ontbreekt in artifact: "+vereist);

if((html.split("const basisNachten=nachten;").length-1)!==1)throw new Error("Nachtzicht moet exact één presentatie-owner houden.");
if(html.includes("mobile-chart-return")||html.includes("mobile-rain-return")||html.includes("mobile-days-return"))throw new Error("Mobile-graph-UX mag geen dashboardsecties herordenen.");
if(!/grid-template-columns:minmax\(0,1fr\)!important/.test(html))throw new Error("Mobiele zoninformatie is niet hard op een leesbare enkele kolom gezet.");
if(!/\.nacht-meer\[aria-expanded="true"\]::after\{content:"⌃"\}/.test(html))throw new Error("Nachtzicht mist duidelijke open/dicht-affordance.");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime om mobile-graph-UX te compileren.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:verify-mobile-graph-ux-"+(i+1)}));

console.log("Mobile-graph-UX verifier groen: uurasfallback, volledige regenperiodecontext, eerlijke uurtegel, locatiebewuste bronnen, leesbare zoninformatie en Nachtzicht-affordance aanwezig zonder tweede Nachtzicht-owner.");
