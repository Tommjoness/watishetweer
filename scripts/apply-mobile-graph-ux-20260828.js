"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const PAD=path.join(OUT,"index.html");
const CSS=fs.readFileSync(path.join(__dirname,"mobile-graph-ux-20260828.css"),"utf8");
const JS=fs.readFileSync(path.join(__dirname,"mobile-graph-ux-20260828.js"),"utf8");
const START="/* ---------- start ---------- */";
const CSS_MARK="/* ===== MOBILE GRAPH UX 20260828 CSS ===== */";
const JS_MARK="/* ===== MOBILE GRAPH UX 20260828 ===== */";

let html=fs.readFileSync(PAD,"utf8");
if(html.includes(CSS_MARK)||html.includes(JS_MARK))throw new Error("Mobile-graph-UX staat al in de artifact.");
if(!html.includes("/* ===== MOBILE TRUTH UX 20260828 ===== */"))throw new Error("Mobile-truth-UX moet vóór mobile-graph-UX zijn geassembleerd.");
if(!html.includes("Q4 REGENPERIODEN 20260811"))throw new Error("Q4-regenperioden ontbreken vóór mobile-graph-UX.");
if(!html.includes("WeatherNowMobileStateUX"))throw new Error("Mobiele first-render state-UX ontbreekt vóór mobile-graph-UX.");
if((html.split(START).length-1)!==1)throw new Error("Startmarker ontbreekt of is dubbel.");

html=html.replace("</head>",`<style>\n${CSS_MARK}\n${CSS}\n/* ===== EINDE MOBILE GRAPH UX 20260828 CSS ===== */\n</style>\n</head>`);
html=html.replace(START,`${JS_MARK}\n${JS}\n/* ===== EINDE MOBILE GRAPH UX 20260828 ===== */\n\n${START}`);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline scripts na mobile-graph-UX.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:mobile-graph-ux-"+(i+1)}));
for(const vereist of [
  "WeatherNowMobileGraphUX20260828",
  "data-mobile-hour-axis",
  "kans · hoeveelheid onzeker",
  "Bronnen voor deze weergave",
  "MeteoAlarm",
  "National Weather Service",
  "#nights .nacht-meer::after"
])if(!html.includes(vereist))throw new Error("Mobile-graph-UX invariant ontbreekt: "+vereist);
if((html.split("const basisNachten=nachten;").length-1)!==1)throw new Error("Mobile-graph-UX mag geen tweede Nachtzicht-owner introduceren.");

fs.writeFileSync(PAD,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"mobile-graph-ux-20260828");
console.log("Mobile-graph-UX toegepast: mobiele uuras heeft een harde contextfallback, iedere regenbracket houdt labels, neerslagsemantiek en bronlijst zijn locatiebewust en zon/nacht/topritme is compacter; cache "+versie+".");
