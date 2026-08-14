"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const PRODUCT_CONFIG=require("../product-config.js");

const htmlPad=path.join(__dirname,"..","public","index.html");
const html=fs.readFileSync(htmlPad,"utf8");

const bronAantal=html.split(PRODUCT_CONFIG.OPHAALFOUT_BRON).length-1;
const productAantal=html.split(PRODUCT_CONFIG.OPHAALFOUT_PRODUCTIE).length-1;
if(bronAantal!==0)throw new Error("Technische ophaalfouttekst lekt nog in artifact: "+bronAantal);
if(productAantal!==1)throw new Error("Menselijke ophaalfoutsemantiek ontbreekt of is dubbel: "+productAantal);
if(html.includes('"+err.message+"'))throw new Error("Ruwe err.message wordt nog in de product-UI opgebouwd.");
if(!html.includes("Het ophalen duurt te lang. Controleer je verbinding en probeer het opnieuw."))throw new Error("Humane AbortError-melding ontbreekt.");
if(!html.includes("Ophalen mislukt. Controleer je verbinding en probeer het opnieuw."))throw new Error("Humane generieke ophaalfoutmelding ontbreekt.");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime in finale artifact.");
scripts.forEach((code,i)=>new vm.Script(code,{filename:"public/index.html:verify-fetch-error-"+(i+1)}));

console.log("Finale artifact bevat uitsluitend menselijke ophaalfoutmeldingen; technische browserfouten lekken niet naar de UI.");
