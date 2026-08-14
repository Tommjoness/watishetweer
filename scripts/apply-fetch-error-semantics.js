"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const PRODUCT_CONFIG=require("../product-config.js");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
let html=fs.readFileSync(htmlPad,"utf8");

const bron=PRODUCT_CONFIG.OPHAALFOUT_BRON;
const productie=PRODUCT_CONFIG.OPHAALFOUT_PRODUCTIE;
const bronAantal=html.split(bron).length-1;
const productAantal=html.split(productie).length-1;
if(bronAantal!==1)throw new Error("Technische ophaalfoutregel ontbreekt of is dubbel: "+bronAantal);
if(productAantal!==0)throw new Error("Menselijke ophaalfoutregel staat al in artifact: "+productAantal);

/* De fetch-/providerketen en timeouts blijven exact ongewijzigd. Alleen de
   user-visible fouttekst wordt gestabiliseerd, zodat browser-specifieke
   foutmeldingen zoals WebKit's 'Fetch is aborted' nooit in de UI lekken. */
html=html.replace(bron,productie);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime na ophaalfoutcorrectie.");
scripts.forEach((code,i)=>new vm.Script(code,{filename:"public/index.html:fetch-error-"+(i+1)}));

fs.writeFileSync(htmlPad,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"fetch-error-semantics");
console.log("Menselijke ophaalfoutsemantiek toegepast zonder wijziging aan provider-, retry- of timeoutlogica; cache "+versie+".");
