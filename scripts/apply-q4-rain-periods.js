"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const crypto=require("crypto");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
let html=fs.readFileSync(htmlPad,"utf8");
const runtime=fs.readFileSync(path.join(__dirname,"q4-rain-runtime.js"),"utf8");
const MARK="/* ===== Q4 REGENPERIODEN 20260811 ===== */";
if(html.includes(MARK))throw new Error("Q4-regenperioden is al toegepast.");
if(!runtime.includes(MARK))throw new Error("Q4-runtime mist zijn versie-marker.");

function vervangExact(van,naar,label){
  const n=html.split(van).length-1;
  if(n!==1)throw new Error(label+" ontbreekt of is dubbel: "+n);
  html=html.replace(van,naar);
}
function vervangBinnen(beginMark,eindMark,van,naar,label){
  const begin=html.indexOf(beginMark),eind=html.indexOf(eindMark,begin+beginMark.length);
  if(begin<0||eind<=begin)throw new Error(label+": afgebakende laag ontbreekt of is ongeldig.");
  const tweedeBegin=html.indexOf(beginMark,begin+beginMark.length);
  if(tweedeBegin>=0)throw new Error(label+": afgebakende laag komt dubbel voor.");
  const segment=html.slice(begin,eind);
  const n=segment.split(van).length-1;
  if(n!==1)throw new Error(label+" ontbreekt of is dubbel binnen eigenaarlaag: "+n);
  html=html.slice(0,begin)+segment.replace(van,naar)+html.slice(eind);
}

/* Dagverwachtingen zijn samenvattingen, geen metingen op de minuut. Dezelfde
   brontekst staat door de bestaande buildlagen meer dan één keer in de totale
   artifact, maar alleen SENIOR CORRECTHEIDSLAAG is eigenaar van de uiteindelijke
   dagformulering. Daarom wijzigen we bewust uitsluitend die afgebakende laag. */
vervangBinnen(
  "/* ===== SENIOR CORRECTHEIDSLAAG ===== */",
  "/* ===== EINDE SENIOR CORRECTHEIDSLAAG ===== */",
  '  const tijd=a.eersteTijd?" rond "+a.eersteTijd:"";',
  '  const tijd=a.eersteTijd?(()=>{const uur=Number(String(a.eersteTijd).slice(0,2));return Number.isFinite(uur)?(uur<6?" in de nacht":uur<12?" in de ochtend":uur<18?" in de middag":" in de avond"):"";})():"";',
  "dagverwachting zonder schijnprecisie"
);
vervangExact('el2.textContent="Houd de grafiek vast voor details.";','el2.textContent="Selecteer een punt in de grafiek voor details.";',"neutrale grafiekhint");
vervangExact('Klik op een dag om die verwachting in de grafiek te laden.','Kies een dag om die verwachting in de grafiek te bekijken.',"neutrale daghint");
vervangExact('<div class="eyebrow">Windstoten</div>','<div class="eyebrow">Windstoten nu</div>',"ondubbelzinnige windstootkop");

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

/* index.html veranderde; de serviceworker-hash moet weer exact de nieuwe shell
   vertegenwoordigen. */
const CACHE_BRONNEN=[
  "index.html","manifest.json","icon-192.png","icon-512.png","icon-maskable-512.png",
  "bodoni-moda-latin-400-normal.woff2","bodoni-moda-latin-500-normal.woff2",
  "instrument-sans-latin-400-normal.woff2","instrument-sans-latin-500-normal.woff2",
  "instrument-sans-latin-600-normal.woff2","dm-mono-latin-400-normal.woff2","dm-mono-latin-500-normal.woff2"
];
const hash=crypto.createHash("sha256");
for(const naam of CACHE_BRONNEN){
  const p=path.join(OUT,naam);if(!fs.existsSync(p))throw new Error("App-shellbestand ontbreekt voor Q4-cachehash: "+naam);
  hash.update(naam+"\0");hash.update(fs.readFileSync(p));hash.update("\0");
}
const versie="watishetweer-"+hash.digest("hex").slice(0,12);
const swPad=path.join(OUT,"sw.js");let sw=fs.readFileSync(swPad,"utf8");
if(!(sw.match(/watishetweer-[0-9a-f]{12}/g)||[]).length)throw new Error("Geen serviceworker-cachehash voor Q4 gevonden.");
sw=sw.replace(/watishetweer-[0-9a-f]{12}/g,versie);fs.writeFileSync(swPad,sw,"utf8");

console.log("Q4 toegepast: losse neerslagstaven weg, intervalperioden + totaal/piek, gecentreerde kanslabels, grovere dagtijd, neutrale hints en ruimere Nachtzicht-uitleg; cache "+versie+".");
