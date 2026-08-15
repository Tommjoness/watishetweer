"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
let html=fs.readFileSync(htmlPad,"utf8");

const MARK="<!-- ===== NEDERLANDSE MICROCOPY 20260815 ===== -->";
if(html.includes(MARK))throw new Error("Nederlandse microcopy is al toegepast.");

function vervangAlles(oud,nieuw,label,{vereist=true}={}){
  const aantal=html.split(oud).length-1;
  if(vereist&&aantal<1)throw new Error("Microcopy-anchor ontbreekt: "+label);
  if(aantal)html=html.split(oud).join(nieuw);
  return aantal;
}

/* Deze laatste laag is bewust klein. Windstoten, luchtdruk, zonuren, briefing-
   tijdtaal, Nachtzicht, pollen en bronnen hebben ieder hun eigen runtime-owner.
   Hier blijft alleen compatibiliteitsnormalisatie voor de grote, gedeelde
   neerslagbeleidslaag staan. Daarmee is dit geen tweede semantische eigenaar. */
vervangAlles(" wordt geen neerslag verwacht."," wordt er geen neerslag verwacht.","ontbrekend 'er' bij droge verwachting");
vervangAlles("Neerslag wordt verwacht het komende uur.","Het komende uur wordt neerslag verwacht.","woordvolgorde neerslag komend uur");
vervangAlles("Enkele druppels zijn mogelijk het komende uur.","Het komende uur zijn enkele druppels mogelijk.","woordvolgorde druppels komend uur",{vereist:false});
vervangAlles("Enkele druppels mogelijk het komende uur.","Het komende uur zijn enkele druppels mogelijk.","ontbrekend werkwoord druppels komend uur",{vereist:false});
vervangAlles("Zeer kleine kans op neerslag het komende uur.","Het komende uur is er een zeer kleine kans op neerslag.","zeer kleine kans komend uur");
vervangAlles("Kleine kans op neerslag het komende uur.","Het komende uur is er een kleine kans op neerslag.","kleine kans komend uur");
vervangAlles("Neerslag is mogelijk het komende uur.","Het komende uur is neerslag mogelijk.","mogelijke neerslag komend uur");
vervangAlles("Grote kans op neerslag het komende uur.","Het komende uur is er een grote kans op neerslag.","grote kans komend uur",{vereist:false});
vervangAlles("Zeer grote kans op neerslag het komende uur.","Het komende uur is er een zeer grote kans op neerslag.","zeer grote kans komend uur",{vereist:false});

if((html.match(/<\/body>/g)||[]).length!==1)throw new Error("Exact één </body> vereist voor microcopy-marker.");
html=html.replace("</body>",MARK+"\n</body>");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime gevonden na microcopy-normalisatie.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:nederlandse-microcopy-"+(i+1)}));

fs.writeFileSync(htmlPad,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"nederlandse-microcopy");
console.log("Nederlandse microcopy toegepast: alleen gedeelde neerslagcompatibiliteit genormaliseerd; overige copy blijft bij de eigen UI-owner; cache "+versie+".");
