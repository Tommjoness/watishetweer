"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
let html=fs.readFileSync(htmlPad,"utf8");

const OUD="S.land=normLand(oud.land)||S.land;";
const NIEUW="S.land=normLand(oud.land);";
const aantal=html.split(OUD).length-1;
if(aantal!==1)throw new Error("Cachefallback-landanker ontbreekt of is dubbel: "+aantal);
if(html.includes(NIEUW))throw new Error("Cachefallback-landcorrectie staat al in artifact.");

/* Bij een mislukte locatiewissel herstelt de basisloader data, label en
   coordinaten uit de laatste briefing. De landidentiteit moet bij precies
   hetzelfde cacheobject horen. */
html=html.replace(OUD,NIEUW);

/* De gedeelde plaatsnaam is net als de landcode externe URL-invoer. Deze
   afzonderlijke runtimelaag draait na de bestaande wereldwijde locatiehardening
   maar vóór de startup-router en bepaalt het label opnieuw uit de al streng
   gevalideerde coördinaten. */
const START="/* ---------- start ---------- */";
const BEGIN="/* ===== GEDEELDE URL PLAATSIDENTITEIT ===== */";
const EINDE="/* ===== EINDE GEDEELDE URL PLAATSIDENTITEIT ===== */";
const startAantal=html.split(START).length-1;
if(startAantal!==1)throw new Error("Startanker voor gedeelde plaatsidentiteit ontbreekt of is dubbel: "+startAantal);
if(html.includes(BEGIN)||html.includes(EINDE))throw new Error("Gedeelde plaatsidentiteitslaag staat al in artifact.");
const plaatsLaag=fs.readFileSync(path.join(__dirname,"shared-url-place-identity.js"),"utf8");
html=html.replace(START,BEGIN+"\n"+plaatsLaag+"\n"+EINDE+"\n\n"+START);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime na locatie-identiteitscorrecties.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:location-identity-"+(i+1)}));

fs.writeFileSync(htmlPad,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"location-identity");
console.log("Locatie-identiteitscorrecties toegepast: cachefallback-land en gedeelde plaatsnaam zijn intern consistent; cache "+versie+".");
