"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
let html=fs.readFileSync(htmlPad,"utf8");

const MARK="/* ===== KLEINE KANS TEGEL CONSISTENTIE 20260815 ===== */";
if(html.includes(MARK))throw new Error("Kleine-kans-consistentie is al toegepast.");

/* Q1 is ouder dan het huidige centrale kansbeleid en beschouwde pas vanaf 30%
   een toekomstige kans als relevant voor de prominente neerslagtegel. Sinds het
   gedeelde beleid 10–29% expliciet als 'kleine kans' classificeert, kan 12% daar
   niet tegelijk als 'Droog' worden weergegeven. Wijzig uitsluitend deze ene
   prominentiegrens in het definitieve artifact; 1–9% blijft zeer klein en wordt
   niet onnodig prominent. De exacte match faalt gesloten bij bronwijzigingen. */
const OUD='  return (k!==null&&k>=30)||(mm!==null&&mm>=MM_MEETBAAR);';
const NIEUW='  '+MARK+'\n  return (k!==null&&k>=10)||(mm!==null&&mm>=MM_MEETBAAR);';
const aantal=html.split(OUD).length-1;
if(aantal!==1)throw new Error("Q1-prominentiegrens ontbreekt of is dubbel: "+aantal);
html=html.replace(OUD,NIEUW);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime na kleine-kans-correctie.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:small-chance-"+(i+1)}));

fs.writeFileSync(htmlPad,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"small-chance-consistency");
console.log("Kleine-kans-consistentie toegepast: 10–29% blijft zichtbaar als kleine kans; cache "+versie+".");
