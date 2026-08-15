"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const htmlPad=path.join(__dirname,"..","public","index.html");
const html=fs.readFileSync(htmlPad,"utf8");
const MARK="<!-- ===== NEDERLANDSE MICROCOPY 20260815 ===== -->";

if((html.split(MARK).length-1)!==1)throw new Error("Nederlandse microcopy-marker ontbreekt of is dubbel.");

const vereist=[
  "De komende twee uur wordt er geen neerslag verwacht.",
  "Het komende uur wordt neerslag verwacht.",
  "Het komende uur is er een kleine kans op neerslag.",
  "Volgens de verwachting kwam de sterkste windstoot vandaag rond ${tijdvak} uit op ${waarde} km/u.",
  "De luchtdruk is in de afgelopen drie uur licht ",
  "Vandaag zijn er enkele uren zon.",
  "Gemiddeld zicht: ",
  "Geen gunstig kijkvenster: ",
  "de maan komt op om ",
  "de maan gaat onder om ",
  "de maan blijft onder de horizon",
  "Beste periode: "
];
for(const tekst of vereist){
  if(!html.includes(tekst))throw new Error("Gecorrigeerde microcopy ontbreekt: "+tekst);
}

const verboden=[
  "De komende twee uur wordt geen neerslag verwacht.",
  "Neerslag wordt verwacht het komende uur.",
  "Kleine kans op neerslag het komende uur.",
  "Eerder vandaag lag de hoogste verwachte windstoot",
  "Gisteren lag de hoogste verwachte windstoot",
  "Licht gestegen in de afgelopen drie uur.",
  "Licht gedaald in de afgelopen drie uur.",
  "Een aantal zonuren vandaag",
  "Gem. zicht ",
  "Geen gunstig kijkvenster door ",
  "Relatief gunstigste modeluren ",
  "Beste modeluren "
];
for(const tekst of verboden){
  if(html.includes(tekst))throw new Error("Verouderde microcopy staat nog in het finale artifact: "+tekst);
}

/* Ook de finale inline runtime moet na de tekstnormalisatie syntactisch geldig
   blijven. Dit vangt met name wijzigingen in template literals en Nachtzicht op. */
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime gevonden voor microcopy-verificatie.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:verify-nederlandse-microcopy-"+(i+1)}));

console.log("Nederlandse microcopy geverifieerd: oude formuleringen afwezig, nieuwe grammatica aanwezig en runtime syntactisch geldig.");
