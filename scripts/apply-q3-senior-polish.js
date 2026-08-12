"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
const css=fs.readFileSync(path.join(__dirname,"q3-senior-polish.css"),"utf8");
let html=fs.readFileSync(htmlPad,"utf8");

const CSS_MARK="/* ===== CHECKPOINT 75 Q3 CSS ===== */";
const METERS_OWNER_SIG='const basisMeters=meters;';
const metersOwnersVoor=html.split(METERS_OWNER_SIG).length-1;
const CLOUD_OLD='  if(n>=95)return "Vrijwel geheel bewolkt";';
const CLOUD_NEW='  if(n===100)return "Geheel bewolkt";\n  if(n>=95)return "Vrijwel geheel bewolkt";';
const UV_OLD=[
  '    const pu=piek("uv_index"),uvSub=document.getElementById("uvsub");',
  '    if(uvSub&&pu&&num(pu.v)!==null&&pu.v>=0){',
  '      const zichtbaar=Math.round(Math.max(0,pu.v));',
  '      uvSub.textContent=pu.v<0.5?"Nauwelijks UV vandaag.":"Rond "+hhmm(pu.t)+" · "+uvOordeelGetoond(zichtbaar)+".";',
  '    }'
].join("\n");
const UV_NEW=[
  '    const pu=piek("uv_index"),uvSub=document.getElementById("uvsub"),uvVal=document.getElementById("uv");',
  '    const pUv=typeof plaatsTijdDelen==="function"?plaatsTijdDelen():null;',
  '    const datumUv=pUv?pUv.year+"-"+String(pUv.month).padStart(2,"0")+"-"+String(pUv.day).padStart(2,"0"):actueleDatum();',
  '    const nuUv=pUv?datumUv+"T"+String(pUv.hour).padStart(2,"0")+":"+String(pUv.minute).padStart(2,"0"):weatherNowActueleLokaleTijd();',
  '    if(uvSub){',
  '      if(!pu||num(pu.v)===null||pu.v<0){',
  '        if(uvVal)uvVal.textContent="–";',
  '        uvSub.textContent="UV-gegevens voor vandaag niet beschikbaar.";',
  '      }else if(String(pu.t||"").slice(0,10)!==datumUv){',
  '        if(uvVal)uvVal.textContent="–";',
  '        uvSub.textContent="UV-gegevens voor vandaag worden bijgewerkt.";',
  '      }else{',
  '        const zichtbaar=Math.round(Math.max(0,pu.v)),tijd=hhmm(pu.t);',
  '        if(uvVal)uvVal.textContent=zichtbaar;',
  '        if(pu.v<0.5)uvSub.textContent="Nauwelijks UV vandaag.";',
  '        else if(!tijd)uvSub.textContent="UV-piek vandaag · "+uvOordeelGetoond(zichtbaar)+".";',
  '        else uvSub.textContent=(String(pu.t)<=String(nuUv)?"Piek was rond ":"Piek rond ")+tijd+" · "+uvOordeelGetoond(zichtbaar)+".";',
  '      }',
  '    }'
].join("\n");

if(html.includes(CSS_MARK))throw new Error("Checkpoint-75 polish is al toegepast.");
if(metersOwnersVoor<1)throw new Error("Bestaande meters-owner ontbreekt vóór checkpoint 75.");
const cloudNieuwAantal=html.split(CLOUD_NEW).length-1;
const cloudOudAantal=html.split(CLOUD_OLD).length-1;
if(cloudNieuwAantal!==1&&cloudOudAantal!==1)throw new Error("Bewolkingsanker voor checkpoint 75 ontbreekt of is dubbel.");
if((html.split(UV_OLD).length-1)!==1)throw new Error("UV-anker voor checkpoint 75 ontbreekt of is dubbel.");
if((html.match(/<\/style>/g)||[]).length!==1)throw new Error("Exact één stijlblok vereist voor checkpoint 75.");

/* Geen nieuwe runtime-owner: we scherpen de bestaande pure cloud-helper en de
   bestaande senior meters()-owner in-place aan. */
if(cloudNieuwAantal!==1)html=html.replace(CLOUD_OLD,CLOUD_NEW);
html=html.replace(UV_OLD,UV_NEW);
html=html.replace("</style>","\n"+CSS_MARK+"\n"+css+"\n/* ===== EINDE CHECKPOINT 75 Q3 CSS ===== */\n</style>");
const metersOwnersNa=html.split(METERS_OWNER_SIG).length-1;
if(metersOwnersNa!==metersOwnersVoor)throw new Error("Checkpoint 75 heeft het aantal bestaande meters-owners gewijzigd: "+metersOwnersVoor+" → "+metersOwnersNa+".");

for(const vereist of [
  'if(n===100)return "Geheel bewolkt"',
  'Piek was rond ',
  'Piek rond ',
  'UV-gegevens voor vandaag worden bijgewerkt.',
  'const pUv=typeof plaatsTijdDelen',
  'slashed-zero',
  'font-feature-settings:"tnum" 1,"zero" 1',
  'function plaatsTijdDelen()',
  'timeZone:tz',
  'if(dag!==klokKalenderdag)',
  'senior-zoninfo',
  'pollenEenheid',
  'bron-bronnen'
]){
  if(!html.includes(vereist))throw new Error("Checkpoint-75 invariant ontbreekt: "+vereist);
}

/* Syntax van alle uiteindelijke inline runtimeblokken blijft hard gecontroleerd. */
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime gevonden na checkpoint 75.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:q3-"+(i+1)}));
fs.writeFileSync(htmlPad,html,"utf8");

/* index.html is gewijzigd; dezelfde gedeelde app-shellhash wordt opnieuw
   berekend. Dit verandert geen cachebeleid, alleen de eigenaar van het recept. */
const versie=vernieuwServiceworkerCache(OUT,"checkpoint-75");

console.log("Checkpoint 75% in-place toegepast: numerieke leesbaarheid, 100% bewolking en tijdgebonden UV; bestaande meters-owners "+metersOwnersVoor+" ongewijzigd; cache "+versie+".");
