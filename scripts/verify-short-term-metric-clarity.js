"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const PAD=path.join(__dirname,"..","public","index.html");
const html=fs.readFileSync(PAD,"utf8");

for(const vereist of [
  "/* ===== SHORT TERM METRIC CLARITY 20260831 ===== */",
  'gustKop.textContent="Max. windstoot dit uur"',
  "Verwachte hoogste windstoot tussen ",
  '"Neerslagverwachting komend uur"',
  '"Neerslagkans komend uur"',
  '"Verwachte neerslag komend uur"',
  '"kans · verwacht totaal"',
  ".mobile-neerslag-sleutel{"
]){
  if(!html.includes(vereist))throw new Error("Kortetermijn-metric invariant ontbreekt: "+vereist);
}
if(!/\.mobile-neerslag-sleutel\{[\s\S]*?display:block/.test(html))throw new Error("Kans/hoeveelheidsleutel is op desktop nog verborgen.");
if(!html.includes('if(kans!==null&&mm!==null)'))throw new Error("Bare-Neerslag fallback gebruikt beschikbare kans/hoeveelheid niet.");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime om te verifiëren.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:verify-short-term-metric-clarity-"+(i+1)}));

console.log("Finale kortetermijnmetingen groen: uurmaximum windstoot en kans/verwachte hoeveelheid neerslag zijn expliciet op mobiel en desktop.");
