"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");
const {pasQ4MobieleRegenlabelsToe}=require("./q4-mobile-rain-label-owner.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
let html=fs.readFileSync(htmlPad,"utf8");
let runtime=fs.readFileSync(path.join(__dirname,"q4-rain-runtime.js"),"utf8");
const MARK="/* ===== Q4 REGENPERIODEN 20260811 ===== */";
if(html.includes(MARK))throw new Error("Q4-regenperioden is al toegepast.");
if(!runtime.includes(MARK))throw new Error("Q4-runtime mist zijn versie-marker.");
runtime=pasQ4MobieleRegenlabelsToe(runtime);

function vervangExact(van,naar,label){
  const n=html.split(van).length-1;
  if(n!==1)throw new Error(label+" ontbreekt of is dubbel: "+n);
  html=html.replace(van,naar);
}

/* Dag-neerslagtaal heeft één canonieke eigenaar in neerslagkans-policy-v3.js.
   Q4 doet daar geen postbuild-stringpatch meer overheen. Daarmee kan de browser-
   E2E de uiteindelijke dagtekst bewaken zonder een tweede verborgen eigenaar. */

/* De grafiekhint heeft vanaf Q4 één expliciete runtime-owner in
   q4-rain-runtime.js. Geen tekstuele vervanging meer: die was statisch groen
   terwijl de browser nog de historische functie uitvoerde. */
vervangExact('Klik op een dag om die verwachting in de grafiek te laden.','Kies een dag om die verwachting in de grafiek te bekijken.',"neutrale daghint");
/* De base-build maakt de windstootwaarde al tijdscope-correct. Q4 bezit alleen
   de statische kaartkop in het uiteindelijke artifact en moet daarom dezelfde
   uursemantiek gebruiken, zodat er ook vóór/naast een render geen oude 'rond nu'-
   terminologie kan terugkomen. */
vervangExact('<div class="eyebrow">Windstoten</div>','<div class="eyebrow">Windstoot dit uur</div>',"tijdscope-correcte windstootkop");

/* De kwartiergrafiek heeft de effectieve, overlappende 15-minutenhoeveelheid al
   in P staan. De historische renderer tekende echter iedere positieve waarde en
   rondde het label daarna op één decimaal af. Daardoor werd bijvoorbeeld 0,04 mm
   als een echte staaf met '0,0' zichtbaar. Maak de renderer zelf eigenaar van de
   centrale meetbaarheidsgrens; geen post-render DOM-filter en geen tweede index-
   mapping. Deze exacte vervangingen falen hard zodra de bronvorm verandert. */
vervangExact(
  '  const M=(typeof window!=="undefined"&&window.innerWidth)?window.innerWidth<760:false;\n  const mx=Math.max(0.5,...P),W=M?380:900,pl=M?26:44,pr=M?8:20,iw=W-pl-pr,',
  '  const M=(typeof window!=="undefined"&&window.innerWidth)?window.innerWidth<760:false;\n  const meetbaarMm=globalThis.WeatherNowInterpretatie&&globalThis.WeatherNowInterpretatie.INTERPRETATIE_CONFIG\n    &&Number.isFinite(Number(globalThis.WeatherNowInterpretatie.INTERPRETATIE_CONFIG.meetbaarMm))\n      ?Number(globalThis.WeatherNowInterpretatie.INTERPRETATIE_CONFIG.meetbaarMm):NEERSLAG_DREMPEL_MM;\n  const mx=Math.max(0.5,...P),W=M?380:900,pl=M?26:44,pr=M?8:20,iw=W-pl-pr,',
  "kwartiergrafiek gebruikt centrale meetbaarheidsgrens"
);
vervangExact('    if(waarde>0) out+=`<rect','    if(waarde>=meetbaarMm) out+=`<rect',"kwartierstaaf alleen bij meetbare neerslag");
vervangExact('    if(waarde>0){\n      /* Het cijfer stond altijd zes pixels boven de balk.','    if(waarde>=meetbaarMm){\n      /* Het cijfer stond altijd zes pixels boven de balk.',"kwartierlabel alleen bij meetbare neerslag");

/* Q4 moet voor ELKE startup-route actief zijn: gedeelde URL, laatst gebruikte
   plaats, opgeslagen keuze en eerste bezoek. De eerdere implementatie hing de
   runtime vóór de Amsterdam-call uit alleen het eerste-bezoekpad. Daardoor kon
   een gedeelde URL de hele Q4-wrapper overslaan. Alle eerdere buildlagen zijn op
   dit assemblagemoment al vóór START geïnjecteerd, dus Q4 hoort direct daarna en
   vóór de startup-router zelf. */
const START="/* ---------- start ---------- */";
const startAantal=html.split(START).length-1;
if(startAantal!==1)throw new Error("Algemene startmarker ontbreekt of is dubbel: "+startAantal);
html=html.replace(START,runtime+"\n"+START);

/* Desktop Nachtzicht: minder loze scorebalk, meer ruimte voor de uitleg. Mobiel
   behoudt zijn bestaande afzonderlijke gridregels. */
const css=`\n${MARK}\n@media(min-width:1100px){\n  .night{grid-template-columns:104px 52px minmax(140px,.72fr) 92px minmax(260px,1fr);gap:14px}\n}\n`;
if((html.match(/<\/style>/g)||[]).length!==1)throw new Error("Exact één stijlblok vereist voor Q4.");
html=html.replace("</style>",css+"</style>");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime gevonden na Q4.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:q4-"+(i+1)}));
fs.writeFileSync(htmlPad,html,"utf8");

/* index.html veranderde; dezelfde gedeelde app-shellhash wordt opnieuw
   berekend. Dit verandert geen cachebeleid, alleen de eigenaar van het recept. */
const versie=vernieuwServiceworkerCache(OUT,"Q4");

console.log("Q4 toegepast: losse neerslagstaven weg, intervalperioden + totaal/piek, meetbare kwartierneerslag, compacte mobiele tijdvaklabels, runtime-neutrale grafiekhint, tijdscope-correcte windstootkop en ruimere Nachtzicht-uitleg; cache "+versie+".");
