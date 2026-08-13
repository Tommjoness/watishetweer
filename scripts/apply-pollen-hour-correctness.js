"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
let html=fs.readFileSync(htmlPad,"utf8");

const MARK="/* ===== POLLEN-UUR CORRECTHEID 20260813 ===== */";
if(html.includes(MARK))throw new Error("Pollen-uurcorrectie is al toegepast.");

function vervangEen(bron,doel,label){
  const aantal=html.split(bron).length-1;
  if(aantal!==1)throw new Error(label+" ontbreekt of is dubbel: "+aantal);
  html=html.replace(bron,doel);
}

/* CAMS hourly en de forecast-current kunnen bij een vertraagde/partiële update
   tijdelijk geen identiek lokaal uur bevatten. Index 0 is dan geen geldige
   fallback: dat is het eerste uur van de CAMS-kalenderdag en kan dus uren van
   'nu' afwijken. Bewaar de mismatch als null; arraytoegang levert dan geen
   meetwaarde op en de renderer kan expliciet fail-closed communiceren. */
vervangEen(
  "    if(i<0)i=0;",
  "    if(i<0)i=null;",
  "onveilige pollen-uurfallback"
);

vervangEen(
  '(gemeten?"Geen noemenswaardige concentraties":"Geen pollendata voor deze locatie")',
  '(gemeten?"Geen noemenswaardige concentraties":i===null?"Pollendata voor het huidige uur niet beschikbaar":"Geen pollendata voor deze locatie")',
  "pollen-mismatchtekst"
);

/* Pollenwaarden zijn floating-point concentraties. Een positieve waarde onder
   0,5 werd door Math.round zichtbaar 0 korrels/m³, terwijl dezelfde rij juist
   alleen bestaat wanneer de ruwe waarde >0 is. Toon sub-1 daarom zonder
   schijnprecisie als <1 en laat vanaf 1 de bestaande afronding staan. De eenheid
   volgt het zichtbare getal. */
vervangEen(
  '${Math.round(o.v)}<s>korrels/m³</s>',
  '${o.v<1?"&lt;1":Math.round(o.v)}<s>${o.v<1||Math.round(o.v)===1?"korrel/m³":"korrels/m³"}</s>',
  "positieve sub-1 pollenpresentatie"
);

html=html.replace("</style>","\n"+MARK+"\n</style>");
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime na pollen-uurcorrectie.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:pollen-hour-"+(i+1)}));
fs.writeFileSync(htmlPad,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"pollen-hour");
console.log("Pollen-correctheid toegepast: tijdreeksmismatch faalt gesloten en positieve sub-1 concentraties blijven zichtbaar positief; cache "+versie+".");
