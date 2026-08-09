"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const crypto=require("crypto");
const ROOT=__dirname,OUT=path.join(ROOT,"public");
const NIET_PUBLICEREN=new Set([
  ".git",".github","api","lib","node_modules","public","scripts",
  "build-weather.js","interpretatie-engine.js","interpretatie-engine.test.js",
  "run.js","run-built-matrix.js","kern.js","data.js","package.json","package-lock.json","vercel.json"
]);
function intern(n){return NIET_PUBLICEREN.has(n)||n.endsWith(".test.js");}
function kopieer(bron,doel){
  const st=fs.statSync(bron);
  if(st.isDirectory()){
    fs.mkdirSync(doel,{recursive:true});
    for(const n of fs.readdirSync(bron))kopieer(path.join(bron,n),path.join(doel,n));
  }else{fs.mkdirSync(path.dirname(doel),{recursive:true});fs.copyFileSync(bron,doel);}
}
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
for(const n of fs.readdirSync(ROOT)){if(!intern(n))kopieer(path.join(ROOT,n),path.join(OUT,n));}
let html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
const engine=fs.readFileSync(path.join(ROOT,"interpretatie-engine.js"),"utf8");
const start="/* ---------- start ---------- */";
if((html.match(/\/\* ---------- start ---------- \*\//g)||[]).length!==1)throw new Error("Startmarker ontbreekt of is dubbel.");
if(html.includes("CENTRALE INTERPRETATIE-ENGINE"))throw new Error("Bron-index bevat de engine al.");
html=html.replace(start,"/* ===== CENTRALE INTERPRETATIE-ENGINE ===== */\n"+engine+"\n/* ===== EINDE CENTRALE INTERPRETATIE-ENGINE ===== */\n\n"+start);
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline script gevonden.");
scripts.forEach((s,i)=>new vm.Script(s,{filename:"public/index.html:inline-"+(i+1)}));
const vereist=[
  "WeatherNowInterpretatie","weatherNowActueleLokaleTijd","plaatsTijdDelen","weatherNowZoneOffset",
  "const eind=Math.min(i+25,h.time.length);","const punten=S.dag==null&&n===24?25:n;",
  "hoeveelheid onzeker","daily.weather_code&&daily.weather_code[dagIndex]","117.000001",
  "c.visibility!=null?c.visibility","weatherNowUurWaardeOp(\"pressure_msl\"","zoekGeneratie",
  "klokKalenderdag","Neerslagkans binnenkort","item.precipitation*item.fractie",
  "luchtBelofte","niveauIsOfficieel===false"
];
for(const x of vereist)if(!html.includes(x))throw new Error("Canonieke broninvariant ontbreekt: "+x);
fs.writeFileSync(path.join(OUT,"index.html"),html,"utf8");
const versie="weerbriefing-"+crypto.createHash("sha256").update(html).digest("hex").slice(0,12);
const swp=path.join(OUT,"sw.js");
if(fs.existsSync(swp)){
  let sw=fs.readFileSync(swp,"utf8").replace(/weerbriefing-(?:v\d+|[0-9a-f]{12})/g,versie);
  if(!sw.includes(versie))throw new Error("Serviceworker-cacheversie niet toegepast.");
  fs.writeFileSync(swp,sw,"utf8");
}
for(const n of fs.readdirSync(OUT))if(intern(n))throw new Error("Intern bestand publiek gebouwd: "+n);
console.log("WeatherNow-build geslaagd: canonieke bron, deterministische assemblage, cache "+versie+".");
