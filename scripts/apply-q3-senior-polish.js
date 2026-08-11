"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const crypto=require("crypto");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
const css=fs.readFileSync(path.join(__dirname,"q3-senior-polish.css"),"utf8");
let html=fs.readFileSync(htmlPad,"utf8");

const CSS_MARK="/* ===== CHECKPOINT 75 Q3 CSS ===== */";
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
  '    const nuUv=weatherNowActueleLokaleTijd(),datumUv=actueleDatum();',
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
if((html.split(CLOUD_OLD).length-1)!==1)throw new Error("Bewolkingsanker voor checkpoint 75 ontbreekt of is dubbel.");
if((html.split(UV_OLD).length-1)!==1)throw new Error("UV-anker voor checkpoint 75 ontbreekt of is dubbel.");
if((html.match(/<\/style>/g)||[]).length!==1)throw new Error("Exact één stijlblok vereist voor checkpoint 75.");

/* Geen nieuwe runtime-owner: we scherpen de bestaande pure cloud-helper en de
   bestaande senior meters()-owner in-place aan. */
html=html.replace(CLOUD_OLD,CLOUD_NEW);
html=html.replace(UV_OLD,UV_NEW);
html=html.replace("</style>","\n"+CSS_MARK+"\n"+css+"\n/* ===== EINDE CHECKPOINT 75 Q3 CSS ===== */\n</style>");

for(const vereist of [
  'if(n===100)return "Geheel bewolkt"',
  'Piek was rond ',
  'Piek rond ',
  'UV-gegevens voor vandaag worden bijgewerkt.',
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

/* index.html is gewijzigd; de serviceworker-hash moet exact dezelfde shell opnieuw
   vertegenwoordigen. Geen handmatige cacheversie en geen cache-bypass. */
const CACHE_BRONNEN=[
  "index.html","manifest.json","icon-192.png","icon-512.png","icon-maskable-512.png",
  "bodoni-moda-latin-400-normal.woff2","bodoni-moda-latin-500-normal.woff2",
  "instrument-sans-latin-400-normal.woff2","instrument-sans-latin-500-normal.woff2",
  "instrument-sans-latin-600-normal.woff2","dm-mono-latin-400-normal.woff2","dm-mono-latin-500-normal.woff2"
];
const hash=crypto.createHash("sha256");
for(const naam of CACHE_BRONNEN){
  const p=path.join(OUT,naam);
  if(!fs.existsSync(p))throw new Error("App-shellbestand ontbreekt voor checkpoint-75 cachehash: "+naam);
  hash.update(naam+"\0");hash.update(fs.readFileSync(p));hash.update("\0");
}
const versie="watishetweer-"+hash.digest("hex").slice(0,12);
const swPad=path.join(OUT,"sw.js");
let sw=fs.readFileSync(swPad,"utf8");
if(!(sw.match(/watishetweer-[0-9a-f]{12}/g)||[]).length)throw new Error("Geen serviceworker-cachehash gevonden.");
sw=sw.replace(/watishetweer-[0-9a-f]{12}/g,versie);
if(!sw.includes(versie))throw new Error("Checkpoint-75 cachehash niet toegepast.");
fs.writeFileSync(swPad,sw,"utf8");

console.log("Checkpoint 75% in-place toegepast: numerieke leesbaarheid, 100% bewolking en tijdgebonden UV; cache "+versie+".");
