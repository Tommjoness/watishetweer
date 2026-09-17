"use strict";

const fs=require("fs"),path=require("path");
const OUT=path.join(__dirname,"..","public");
const MARKER="/* ===== BRIEFING STABIELE EERSTE RENDER 20260909 ===== */";
const KNMI_MARKER="/* ===== BRIEFING KNMI EERSTE RENDER 20260917 ===== */";
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
  const knmiMarkerAantal=bron.split(KNMI_MARKER).length-1;
  if(knmiMarkerAantal!==1)throw new Error(`${bestand}: KNMI briefing-stability marker verwacht 1x, gevonden ${knmiMarkerAantal}.`);
  const vereist=[
    'briefEl.style.visibility="hidden";',
    'briefEl.setAttribute("aria-hidden","true");',
    'briefEl.setAttribute("aria-busy","true");',
    'briefEl.setAttribute("data-q1-briefing-pending",String(cacheRenderGeneratie));',
    'bestaandBriefEl.setAttribute("data-q1-briefing-pending",String(generatie));',
    'if(generatie===cacheRenderGeneratie){',
    'briefEl.getAttribute("data-q1-briefing-pending")===String(generatie)',
    'briefEl.removeAttribute("data-q1-briefing-pending");',
    '!briefEl.hasAttribute("data-knmi-briefing-pending")',
    'function knmiBriefingBegin(data){',
    'el.setAttribute("data-knmi-briefing-pending",token);',
    'function knmiBriefingEinde(data,token){',
    'el.removeAttribute("data-knmi-briefing-pending");',
    '!el.hasAttribute("data-q1-briefing-pending")',
    'const dataBijStart=S.d,briefingToken=knmiBriefingBegin(dataBijStart);',
    'knmiBriefingEinde(dataBijStart,briefingToken);'
  ];
  for(const s of vereist)if(!bron.includes(s))throw new Error(`${bestand}: briefing-stability contract mist ${s}`);
  const cachePos=bron.indexOf('briefEl.style.visibility="hidden";');
  const cacheBriefPos=bron.indexOf('if(typeof briefing==="function")briefing();',cachePos);
  const netwerkPos=bron.indexOf('const resultaat=await basisLoad(',cacheBriefPos);
  const q1VrijPos=bron.indexOf('briefEl.removeAttribute("data-q1-briefing-pending");',netwerkPos);
  const knmiCheckPos=bron.indexOf('!briefEl.hasAttribute("data-knmi-briefing-pending")',q1VrijPos);
  if(!(cachePos>=0&&cacheBriefPos>cachePos&&netwerkPos>cacheBriefPos&&q1VrijPos>netwerkPos&&knmiCheckPos>q1VrijPos)){
    throw new Error(`${bestand}: Q1 mag de briefing pas na basisLoad en zonder KNMI-pending vrijgeven.`);
  }
  const knmiStartPos=bron.indexOf('const dataBijStart=S.d,briefingToken=knmiBriefingBegin(dataBijStart);');
  const knmiRequestPos=bron.indexOf('const payload=await j("/api/neerslag?',knmiStartPos);
  const knmiRenderPos=bron.indexOf('hertekenNeerslagdelen();',knmiRequestPos);
  const knmiEindPos=bron.indexOf('knmiBriefingEinde(dataBijStart,briefingToken);',knmiRequestPos);
  if(!(knmiStartPos>=0&&knmiRequestPos>knmiStartPos&&knmiRenderPos>knmiRequestPos&&knmiEindPos>knmiRenderPos)){
    throw new Error(`${bestand}: eerste KNMI-verrijking moet briefing verbergen vóór request en pas na eventuele hertekening vrijgeven.`);
  }
  return true;
}

let n=0;
for(const p of htmlBestanden(OUT)){
  const bron=fs.readFileSync(p,"utf8");
  if(controleer(bron,path.relative(OUT,p)))n++;
}
if(!n)throw new Error("Geen Q1-weerartifacts gevonden voor briefing-stability-verificatie.");
console.log(`Briefing-stability geverifieerd op ${n} weerpagina's: cached briefing én eerste Nederlandse KNMI-verrijking blijven verborgen tot de definitieve eerste briefing klaar is.`);
