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

let html=fs.readFileSync(PAD,"utf8");
if(html.includes(CSS_MARK)||html.includes(JS_MARK))throw new Error("Mobiele state-UX-laag staat al in de artifact.");
if((html.match(/<\/style>/g)||[]).length!==1)throw new Error("Exact één stijlblok vereist voor mobiele state-UX.");
if((html.split(START).length-1)!==1)throw new Error("Startmarker ontbreekt of is dubbel voor mobiele state-UX.");
if(!html.includes("const ruimBotsendeAslabelsOp=()=>{"))throw new Error("Mobiele grafiek-collisionlaag ontbreekt vóór state-UX-herstel.");
if(!html.includes("function weatherNowDagenNeerslagUitleg(){"))throw new Error("Finale weekuitleg-owner ontbreekt vóór compacte state-UX-presentatie.");
if(!html.includes("const basisNachten=nachten;"))throw new Error("Canonieke Nachtzicht-presentatie-owner ontbreekt vóór compacte detailpresentatie.");

html=html.replace("</style>","\n"+CSS_MARK+"\n"+CSS+"\n/* ===== EINDE MOBILE STATE UX 20260826 CSS ===== */\n</style>");
html=html.replace(START,JS_MARK+"\n"+JS+"\n/* ===== EINDE MOBILE STATE UX 20260826 ===== */\n\n"+START);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime na mobiele state-UX.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:mobile-state-ux-"+(i+1)}));

for(const vereist of [
  "WeatherNowMobileStateUX","grafiekHerstelNodig","document.fonts.ready",
  "Komende 24 uur","Komende 48 uur","Deze kalenderdag per uur",
  "dagenneerslaguitleg-compact","nacht-meta-details","senior-verstopt"
])if(!html.includes(vereist))throw new Error("Mobiele state-UX invariant ontbreekt: "+vereist);

fs.writeFileSync(PAD,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"mobile-state-ux-20260826");
console.log("Mobiele state-UX toegepast: eerste uuras herstelt na fontload, grafiekmodus is expliciet, contextbalk verdwijnt na rust en secundaire uitleg is compact; cache "+versie+".");
