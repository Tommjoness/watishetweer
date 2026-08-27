"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const PAD=path.join(OUT,"index.html");
const CSS=fs.readFileSync(path.join(__dirname,"mobile-truth-ux-20260828.css"),"utf8");
const JS=fs.readFileSync(path.join(__dirname,"mobile-truth-ux-20260828.js"),"utf8");
const START="/* ---------- start ---------- */";
const CSS_MARK="/* ===== MOBILE TRUTH UX 20260828 CSS ===== */";
const JS_MARK="/* ===== MOBILE TRUTH UX 20260828 ===== */";

let html=fs.readFileSync(PAD,"utf8");
if(html.includes(CSS_MARK)||html.includes(JS_MARK))throw new Error("Mobile-truth-UX staat al in de artifact.");
if(!html.includes("/* ===== STAFF AUDIT 20260826 ===== */"))throw new Error("Staff-audit moet vóór mobile-truth-UX zijn geassembleerd.");
if(!html.includes("WeatherNowMobileStateUX"))throw new Error("Mobiele state-UX ontbreekt vóór mobile-truth-UX.");
if(!html.includes("Q4 REGENPERIODEN 20260811"))throw new Error("Q4-regenperioden ontbreken vóór mobile-truth-UX.");
if((html.split(START).length-1)!==1)throw new Error("Startmarker ontbreekt of is dubbel.");

html=html.replace("</head>",`<style>\n${CSS_MARK}\n${CSS}\n/* ===== EINDE MOBILE TRUTH UX 20260828 CSS ===== */\n</style>\n</head>`);
html=html.replace(START,`${JS_MARK}\n${JS}\n/* ===== EINDE MOBILE TRUTH UX 20260828 ===== */\n\n${START}`);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline scripts na mobile-truth-UX.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:mobile-truth-ux-"+(i+1)}));

for(const vereist of [
  "WeatherNowMobileTruthUX20260828",
  "kans · verwachte hoeveelheid",
  "Uitleg meetwaarden",
  "mobile-priority-rain",
  "regenperiodenGecorrigeerd",
  "corrigeerLopendModeluur",
  "Temperatuur boven, neerslagperioden onder",
  "Actieve nacht tot zonsopkomst"
])if(!html.includes(vereist))throw new Error("Mobile-truth-UX invariant ontbreekt: "+vereist);

fs.writeFileSync(PAD,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"mobile-truth-ux-20260828");
console.log("Mobile-truth-UX toegepast: lopend modeluur, neerslagduiding, nachtlabels, mobiele volgorde, compact meetraster en grafiekbotsingen; cache "+versie+".");
