"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
let html=fs.readFileSync(htmlPad,"utf8");

/* Compatibiliteitsnaam: cachefallback-landcontext wordt sinds #114 door
   product-config.js + de base-build bezeten. Deze overgebleven postbuildstap
   injecteert uitsluitend de afzonderlijke shared-URL-plaatsidentiteitslaag. */
const START="/* ---------- start ---------- */";
const BEGIN="/* ===== GEDEELDE URL PLAATSIDENTITEIT ===== */";
const EINDE="/* ===== EINDE GEDEELDE URL PLAATSIDENTITEIT ===== */";
const startAantal=html.split(START).length-1;
if(startAantal!==1)throw new Error("Startanker voor gedeelde plaatsidentiteit ontbreekt of is dubbel: "+startAantal);
if(html.includes(BEGIN)||html.includes(EINDE))throw new Error("Gedeelde plaatsidentiteitslaag staat al in artifact.");
const plaatsLaag=fs.readFileSync(path.join(__dirname,"shared-url-place-identity.js"),"utf8");
html=html.replace(START,BEGIN+"\n"+plaatsLaag+"\n"+EINDE+"\n\n"+START);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime na gedeelde plaatsidentiteit.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:shared-url-place-identity-"+(i+1)}));

fs.writeFileSync(htmlPad,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"shared-url-place-identity");
console.log("Gedeelde URL-plaatsidentiteit toegepast; cachefallback-landcontext komt uit de base-build; cache "+versie+".");
