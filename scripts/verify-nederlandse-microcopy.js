"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const ROOT=path.join(__dirname,"..");
const htmlPad=path.join(ROOT,"public","index.html");
const html=fs.readFileSync(htmlPad,"utf8");
const applyBron=fs.readFileSync(path.join(ROOT,"scripts","apply-nederlandse-microcopy.js"),"utf8");
const MARK="<!-- ===== NEDERLANDSE MICROCOPY 20260815 ===== -->";

if((html.split(MARK).length-1)!==1)throw new Error("Nederlandse microcopy-marker ontbreekt of is dubbel.");

/* De compatibilitylaag blijft eigenaar van uitsluitend de gedeelde neerslagzin. */
for(const tekst of [
  "De komende twee uur wordt er geen neerslag verwacht.",
  "Het komende uur wordt neerslag verwacht.",
  "Het komende uur is er een kleine kans op neerslag."
]){
  if(!html.includes(tekst))throw new Error("Gecorrigeerde neerslagcopy ontbreekt: "+tekst);
}
for(const tekst of [
  "De komende twee uur wordt geen neerslag verwacht.",
  "Neerslag wordt verwacht het komende uur.",
  "Kleine kans op neerslag het komende uur."
]){
  if(html.includes(tekst))throw new Error("Verouderde neerslagcopy staat nog in het finale artifact: "+tekst);
}

/* De overige taal hoort nu aantoonbaar bij de inhoudelijke runtime-owner. */
for(const eigenaar of [
  "function uiWindstootTekst(pg,nu,dag,vak){",
  "function uiLuchtdrukTekst(tekst){",
  "function uiBriefingTijdtaal(html,nuLokaal,huidigeTemperatuur){",
  "function normaliseerNachtDagdata(data,nuLokaal){",
  "function corrigeerNachtVensterBron(tekst,horizonDagen,score,opties={}){",
  "function formatteerMaanTekst(tekst){",
  "function pollenKop(tekst){"
]){
  if(!html.includes(eigenaar))throw new Error("Presentatie-owner ontbreekt uit artifact: "+eigenaar);
}

/* De nachtbriefing moet temperatuurgedreven blijven. Een klok-only herschrijving
   kan bij locaties als Kandy een al bereikt minimum ten onrechte als toekomstige
   afkoeling presenteren. Bewaak daarom zowel de actuele-temperatuurinput als de
   neutrale formulering voor een reeds bereikt minimum. */
for(const invariant of [
  "const huidige=uiGetal(huidigeTemperatuur);",
  "doel>=huidige-0.75",
  "De minimumtemperatuur vannacht ligt rond ",
  "Later vannacht koelt het af naar "
]){
  if(!html.includes(invariant))throw new Error("Temperatuurgedreven nachtbriefing mist invariant: "+invariant);
}

/* Voorkom dat de late compatibilitylaag opnieuw een tweede eigenaar wordt voor
   wind, druk, zon, Nachtzicht, pollen of footer. */
for(const verboden of [
  "const WIND_OUD=",
  "const DRUK_OUD=",
  "const MAAN_BASIS_OUD=",
  'vervangAlles("Gem. zicht ',
  'vervangAlles("Geen gunstig kijkvenster',
  'vervangAlles("Een aantal zonuren vandaag',
  'vervangAlles("Pollen gras',
  'vervangAlles("Pollen bijvoet'
]){
  if(applyBron.includes(verboden))throw new Error("Late microcopylaag claimt opnieuw een inhoudelijke UI-owner: "+verboden);
}

if(html.includes("Beste modeluren")||html.includes("Relatief gunstigste modeluren"))throw new Error("Nachtzicht bevat nog modeljargon in het finale artifact.");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime gevonden voor microcopy-verificatie.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:verify-nederlandse-microcopy-"+(i+1)}));

console.log("Nederlandse microcopy geverifieerd: neerslagcompatibiliteit centraal, nachtbriefing temperatuurgedreven en overige taal bij de eigen UI-owner.");