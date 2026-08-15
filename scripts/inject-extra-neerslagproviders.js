"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const htmlPad=path.join(ROOT,"public","index.html");
const bronPad=path.join(__dirname,"extra-neerslagproviders.js");
const START="/* ---------- start ---------- */";
const BEGIN="/* ===== EXTRA NEERSLAGPROVIDERS ===== */";
const EINDE="/* ===== EINDE EXTRA NEERSLAGPROVIDERS ===== */";

let html=fs.readFileSync(htmlPad,"utf8");
const extra=fs.readFileSync(bronPad,"utf8");
if((html.split(START).length-1)!==1)throw new Error("Startmarker ontbreekt of is dubbel bij extra neerslagproviders.");
if(html.includes(BEGIN)||html.includes(EINDE))throw new Error("Extra neerslagproviders zijn al geïnjecteerd.");

html=html.replace(START,BEGIN+"\n"+extra+"\n"+EINDE+"\n\n"+START);
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline script gevonden na providerinjectie.");
scripts.forEach((s,i)=>new vm.Script(s,{filename:"public/index.html:extra-neerslag-"+(i+1)}));
if(!html.includes("WeatherNowExtraNeerslagproviders"))throw new Error("Extra providerclient ontbreekt uit buildartifact.");
if(!html.includes("land=\"+encodeURIComponent(land)"))throw new Error("Expliciete provider-landcode ontbreekt uit buildartifact.");

fs.writeFileSync(htmlPad,html,"utf8");
const versie=vernieuwServiceworkerCache(path.join(ROOT,"public"),"extra-neerslagproviders");
console.log("Extra neerslagproviders geïnjecteerd en cache vernieuwd: "+versie+".");
