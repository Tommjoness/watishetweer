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
   hetzelfde cacheobject horen. Als een legacy-cache nog geen landcode heeft,
   is 'onbekend' veiliger dan de landcode van de mislukte nieuwe locatie: de
   waarschuwingserver kan het land dan opnieuw uit de herstelde coordinaten
   bepalen. */
html=html.replace(OUD,NIEUW);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime na cachefallback-landcorrectie.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:cache-fallback-country-"+(i+1)}));

fs.writeFileSync(htmlPad,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"cache-fallback-country");
console.log("Cachefallback-landcorrectie toegepast: herstelde briefing neemt nooit de landcode van een mislukte nieuwe locatie over; cache "+versie+".");
