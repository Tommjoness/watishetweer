"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const PAD=path.join(OUT,"index.html");
const CSS=fs.readFileSync(path.join(__dirname,"mobile-state-ux-20260826.css"),"utf8");
const JS=fs.readFileSync(path.join(__dirname,"mobile-state-ux-20260826.js"),"utf8");
const CSS_MARK="/* ===== MOBILE STATE UX 20260826 CSS ===== */";
const JS_MARK="/* ===== MOBILE STATE UX 20260826 ===== */";
const START="/* ---------- start ---------- */";
const HEAD_EIND="</head>";

let html=fs.readFileSync(PAD,"utf8");
if(html.includes(CSS_MARK)||html.includes(JS_MARK))throw new Error("Mobiele state-UX-laag staat al in de artifact.");
if((html.split(HEAD_EIND).length-1)!==1)throw new Error("Exact één head-eindmarker vereist voor mobiele state-UX.");
if((html.split(START).length-1)!==1)throw new Error("Startmarker ontbreekt of is dubbel voor mobiele state-UX.");
if(!html.includes("const ruimBotsendeAslabelsOp=()=>{"))throw new Error("Mobiele grafiek-collisionlaag ontbreekt vóór state-UX-herstel.");
if(!html.includes("function weatherNowDagenNeerslagUitleg(){"))throw new Error("Finale weekuitleg-owner ontbreekt vóór daggebonden state-UX-presentatie.");
if(!html.includes("const basisNachten=nachten;"))throw new Error("Canonieke Nachtzicht-presentatie-owner ontbreekt vóór compacte detailpresentatie.");

/* Deze laag draait laat in de postbuild, wanneer eerdere stappen meerdere style-
   blokken mogen hebben toegevoegd. Voeg daarom één eigen expliciet styleblok toe
   vlak vóór </head>, in plaats van te veronderstellen dat er nog exact één bestaat. */
html=html.replace(HEAD_EIND,"<style>\n"+CSS_MARK+"\n"+CSS+"\n/* ===== EINDE MOBILE STATE UX 20260826 CSS ===== */\n</style>\n"+HEAD_EIND);
html=html.replace(START,JS_MARK+"\n"+JS+"\n/* ===== EINDE MOBILE STATE UX 20260826 ===== */\n\n"+START);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime na mobiele state-UX.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:mobile-state-ux-"+(i+1)}));

for(const vereist of [
  "WeatherNowMobileStateUX","grafiekHerstelNodig","document.fonts.ready",
  "Komende 24 uur","Komende 48 uur","Deze kalenderdag per uur",
  "dagNeerslagNuance","dag-neerslagnotitie","hoogste neerslagkans in één uur",
  "aria-pressed","aria-describedby","nacht-meta-details","senior-verstopt"
])if(!html.includes(vereist))throw new Error("Mobiele state-UX invariant ontbreekt: "+vereist);

fs.writeFileSync(PAD,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"mobile-state-ux-20260826");
console.log("Mobiele state-UX toegepast: eerste uuras herstelt na fontload, grafiekmodus is expliciet, weekneerslagnuance is aan de juiste dag gekoppeld, contextbalk verdwijnt na rust en Nachtzicht-details blijven compact; cache "+versie+".");
