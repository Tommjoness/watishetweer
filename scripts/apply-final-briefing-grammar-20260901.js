"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const START="/* ---------- start ---------- */";
const GLOBAL_MARKER="/* ===== FINAL GLOBAL CORRECTNESS 20260901 ===== */";
const MARKER="/* ===== FINAL BRIEFING GRAMMAR 20260901 ===== */";

/* Deze laag draait bewust ná unified-weather-truth en final-global. De briefing-
   owners blijven verantwoordelijk voor inhoud, horizon en plateau-semantiek.
   Alleen de Nederlandse enkelvoudsvorm van zichtbare temperaturen wordt hier
   na iedere daadwerkelijke briefingrender genormaliseerd via de centrale pure
   correctheidsfunctie. Daarmee kan een latere/asynchrone briefingrender de
   grammatica niet opnieuw terugzetten naar '1 graden' of '-1 graden'. */
const RUNTIME=`
${MARKER}
(function(){
"use strict";
const G=globalThis.WeatherNowFinalGlobalCorrectness;
if(!G||typeof G.corrigeerGradenTekst!=="function"||typeof briefing!=="function")return;
const basisBriefingGrammar=briefing;
function corrigeerBriefingGrammatica(){
  const el=document.getElementById("brief");if(!el)return;
  if(typeof document.createTreeWalker==="function"){
    const showText=typeof NodeFilter!=="undefined"?NodeFilter.SHOW_TEXT:4,walker=document.createTreeWalker(el,showText);let n;
    while((n=walker.nextNode())){const oud=n.nodeValue||"",nieuw=G.corrigeerGradenTekst(oud);if(nieuw!==oud)n.nodeValue=nieuw;}
  }else{
    const loop=node=>{for(const n of Array.from(node&&node.childNodes||[])){if(n.nodeType===3){const oud=n.nodeValue||"",nieuw=G.corrigeerGradenTekst(oud);if(nieuw!==oud)n.nodeValue=nieuw;}else loop(n);}};loop(el);
  }
  el.querySelectorAll("[aria-label],[title]").forEach(node=>{for(const a of ["aria-label","title"]){if(!node.hasAttribute(a))continue;const oud=node.getAttribute(a)||"",nieuw=G.corrigeerGradenTekst(oud);if(nieuw!==oud)node.setAttribute(a,nieuw);}});
}
briefing=function(){const r=basisBriefingGrammar.apply(this,arguments);corrigeerBriefingGrammatica();return r;};
corrigeerBriefingGrammatica();
})();
`;

function weerHtmlBestanden(dir){
  const uit=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())uit.push(...weerHtmlBestanden(p));
    else if(e.isFile()&&e.name==="index.html")uit.push(p);
  }
  return uit;
}
function pasToe(pad){
  let html=fs.readFileSync(pad,"utf8");
  if(!html.includes(GLOBAL_MARKER))return false;
  if(html.includes(MARKER))throw new Error("Finale briefinggrammatica staat al in "+pad);
  if((html.split(START).length-1)!==1)throw new Error("Startupmarker ontbreekt of is dubbel in "+pad);
  html=html.replace(START,RUNTIME+"\n"+START);
  const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach((bron,i)=>new vm.Script(bron,{filename:path.basename(pad)+":final-briefing-grammar-"+(i+1)}));
  fs.writeFileSync(pad,html,"utf8");
  return true;
}

function voerUit(){
  let aantal=0;
  for(const p of weerHtmlBestanden(OUT))if(pasToe(p))aantal++;
  if(!aantal)throw new Error("Geen final-global weerpagina's gevonden voor briefinggrammatica.");
  const versie=vernieuwServiceworkerCache(OUT,"final-briefing-grammar-20260901");
  console.log("Finale briefinggrammatica toegepast op "+aantal+" weerpagina's; cache "+versie+".");
}

if(require.main===module)voerUit();
module.exports={START,GLOBAL_MARKER,MARKER,RUNTIME,pasToe,voerUit};