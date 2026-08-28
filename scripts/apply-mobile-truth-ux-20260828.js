"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const PAD=path.join(OUT,"index.html");
const CSS=fs.readFileSync(path.join(__dirname,"mobile-truth-ux-20260828.css"),"utf8");
const GRAPH_CSS=fs.readFileSync(path.join(__dirname,"mobile-graph-ux-20260828.css"),"utf8");
let JS=fs.readFileSync(path.join(__dirname,"mobile-truth-ux-20260828.js"),"utf8");
const GRAPH_JS=fs.readFileSync(path.join(__dirname,"mobile-graph-ux-20260828.js"),"utf8");
const START="/* ---------- start ---------- */";
const CSS_MARK="/* ===== MOBILE TRUTH UX 20260828 CSS ===== */";
const JS_MARK="/* ===== MOBILE TRUTH UX 20260828 ===== */";
const GRAPH_CSS_MARK="/* ===== MOBILE GRAPH UX 20260828 CSS ===== */";
const GRAPH_JS_MARK="/* ===== MOBILE GRAPH UX 20260828 ===== */";
const NACHT_OWNER_ANCHOR='  verbeterNachtzicht(renderData,nu,actief);\n  werkNachtzichtCompactBij();';
const NACHT_OWNER_NIEUW='  verbeterNachtzicht(renderData,nu,actief);\n  if(globalThis.WeatherNowMobileTruthUX20260828&&typeof globalThis.WeatherNowMobileTruthUX20260828.herstelNachtlabels==="function")globalThis.WeatherNowMobileTruthUX20260828.herstelNachtlabels();\n  werkNachtzichtCompactBij();';
const NACHT_WRAPPER='if(typeof nachten==="function"){\n  const basisNachten=nachten;nachten=function(){const r=basisNachten.apply(this,arguments);herstelNachtlabels();return r;};\n}\n';

let html=fs.readFileSync(PAD,"utf8");
if(html.includes(CSS_MARK)||html.includes(JS_MARK)||html.includes(GRAPH_CSS_MARK)||html.includes(GRAPH_JS_MARK))throw new Error("Mobiele truth/grafiek-UX staat al in de artifact.");
if(!html.includes("/* ===== STAFF AUDIT 20260826 ===== */"))throw new Error("Staff-audit moet vóór mobile-truth-UX zijn geassembleerd.");
if(!html.includes("WeatherNowMobileStateUX"))throw new Error("Mobiele state-UX ontbreekt vóór mobile-truth-UX.");
if(!html.includes("Q4 REGENPERIODEN 20260811"))throw new Error("Q4-regenperioden ontbreken vóór mobile-truth-UX.");
if((html.split(START).length-1)!==1)throw new Error("Startmarker ontbreekt of is dubbel.");
if((html.split(NACHT_OWNER_ANCHOR).length-1)!==1)throw new Error("Bestaande geconsolideerde Nachtzicht-owner ontbreekt of is dubbel.");
if((JS.split(NACHT_WRAPPER).length-1)!==1)throw new Error("Te pensioneren mobile-truth Nachtzicht-wrapper ontbreekt of is dubbel.");

/* Nachtzicht heeft al één geconsolideerde presentatie-owner. Voeg de nieuwe
   kalendergrenslabelcorrectie daar in via de expliciet geëxporteerde API. */
html=html.replace(NACHT_OWNER_ANCHOR,NACHT_OWNER_NIEUW);
JS=JS.replace(NACHT_WRAPPER,"");

/* De grafiekcontextlaag wordt in dezelfde late mobiele applystap geassembleerd.
   Hij volgt de bestaande truth-runtime en kan daardoor uitsluitend ontbrekende
   zichtbare context herstellen, zonder een extra postbuildvolgorde te creëren. */
html=html.replace("</head>",`<style>\n${CSS_MARK}\n${CSS}\n/* ===== EINDE MOBILE TRUTH UX 20260828 CSS ===== */\n${GRAPH_CSS_MARK}\n${GRAPH_CSS}\n/* ===== EINDE MOBILE GRAPH UX 20260828 CSS ===== */\n</style>\n</head>`);
html=html.replace(START,`${JS_MARK}\n${JS}\n/* ===== EINDE MOBILE TRUTH UX 20260828 ===== */\n\n${GRAPH_JS_MARK}\n${GRAPH_JS}\n/* ===== EINDE MOBILE GRAPH UX 20260828 ===== */\n\n${START}`);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline scripts na mobile-truth/grafiek-UX.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:mobile-truth-ux-"+(i+1)}));

for(const vereist of [
  "WeatherNowMobileTruthUX20260828",
  "WeatherNowMobileGraphUX20260828",
  "kans · verwachte hoeveelheid",
  "kans · hoeveelheid onzeker",
  "Uitleg meetwaarden",
  "regenperiodenGecorrigeerd",
  "corrigeerLopendModeluur",
  "Actieve nacht tot zonsopkomst",
  "WeatherNowMobileTruthUX20260828.herstelNachtlabels",
  "data-mobile-hour-axis",
  "Bronnen voor deze weergave",
  "#nights .nacht-meer::after"
])if(!html.includes(vereist))throw new Error("Mobiele truth/grafiek-UX invariant ontbreekt: "+vereist);
if((html.split("const basisNachten=nachten;").length-1)!==1)throw new Error("Nachtzicht moet na mobiele assemblage exact één presentatie-owner houden.");
if(html.includes("mobile-chart-return")||html.includes("mobile-rain-return")||html.includes("mobile-days-return"))throw new Error("Mobiele UX mag bestaande dashboardsecties niet verplaatsen.");
if(html.includes("Temperatuur boven, neerslagperioden onder"))throw new Error("Mobiele UX mag de canonieke Q4-grafiekhint niet overschrijven.");

fs.writeFileSync(PAD,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"mobile-truth-graph-ux-20260828");
console.log("Mobiele truth/grafiek-UX toegepast: lopend modeluur, eerlijke uurtegel, harde uurasfallback, volledige regenperiodecontext, locatiebewuste bronnen, duidelijke Nachtzicht-bediening en compactere mobiele hiërarchie; cache "+versie+".");
