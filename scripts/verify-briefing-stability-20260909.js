"use strict";

const fs=require("fs"),path=require("path");
const OUT=path.join(__dirname,"..","public");
const MARKER="/* ===== BRIEFING STABIELE EERSTE RENDER 20260909 ===== */";
const Q1_OWNER="let cacheRenderGeneratie=0;";

function htmlBestanden(dir){
  const uit=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())uit.push(...htmlBestanden(p));
    else if(e.isFile()&&e.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function controleer(bron,bestand){
  if(!bron.includes(Q1_OWNER))return false;
  const markerAantal=bron.split(MARKER).length-1;
  if(markerAantal!==1)throw new Error(`${bestand}: briefing-stability marker verwacht 1x, gevonden ${markerAantal}.`);
  const vereist=[
    'briefEl.style.visibility="hidden";',
    'briefEl.setAttribute("aria-hidden","true");',
    'briefEl.setAttribute("aria-busy","true");',
    'briefEl.setAttribute("data-q1-briefing-pending",String(cacheRenderGeneratie));',
    'bestaandBriefEl.setAttribute("data-q1-briefing-pending",String(generatie));',
    'if(generatie===cacheRenderGeneratie){',
    'briefEl.getAttribute("data-q1-briefing-pending")===String(generatie)',
    'briefEl.style.visibility="";',
    'briefEl.removeAttribute("aria-hidden");',
    'briefEl.removeAttribute("aria-busy");',
    'briefEl.removeAttribute("data-q1-briefing-pending");'
  ];
  for(const s of vereist)if(!bron.includes(s))throw new Error(`${bestand}: briefing-stability contract mist ${s}`);
  const cachePos=bron.indexOf('briefEl.style.visibility="hidden";');
  const cacheBriefPos=bron.indexOf('if(typeof briefing==="function")briefing();',cachePos);
  const netwerkPos=bron.indexOf('const resultaat=await basisLoad(',cacheBriefPos);
  const vrijPos=bron.indexOf('briefEl.style.visibility="";',netwerkPos);
  if(!(cachePos>=0&&cacheBriefPos>cachePos&&netwerkPos>cacheBriefPos&&vrijPos>netwerkPos)){
    throw new Error(`${bestand}: briefing moet verborgen zijn vóór cached briefing en pas ná basisLoad worden vrijgegeven.`);
  }
  return true;
}

let n=0;
for(const p of htmlBestanden(OUT)){
  const bron=fs.readFileSync(p,"utf8");
  if(controleer(bron,path.relative(OUT,p)))n++;
}
if(!n)throw new Error("Geen Q1-weerartifacts gevonden voor briefing-stability-verificatie.");
console.log(`Briefing-stability geverifieerd op ${n} weerpagina's: cached briefing is visueel/a11y voorlopig en alleen de nieuwste netwerkronde geeft hem vrij.`);
