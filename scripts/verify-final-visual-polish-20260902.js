"use strict";

const fs=require("fs"),path=require("path"),vm=require("vm");
const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const MARKER="/* ===== FINAL VISUAL POLISH 20260902 ===== */";
const RUNTIME_ID="final-visual-polish-runtime-20260903";
function eis(c,m){if(!c)throw new Error("Final visual polish-verificatie: "+m);}
function htmlBestanden(dir){const uit=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())uit.push(...htmlBestanden(p));else if(e.isFile()&&e.name.endsWith(".html"))uit.push(p);}return uit;}

const weer=htmlBestanden(OUT).filter(p=>fs.readFileSync(p,"utf8").includes("/* ===== FINAL RELEASE HARDENING 20260902 ===== */"));
eis(weer.length>0,"geen finale weerartifacts gevonden");
for(const p of weer){
  const html=fs.readFileSync(p,"utf8"),rel=path.relative(OUT,p);
  eis(html.includes(MARKER),rel+": marker ontbreekt");
  eis(html.includes(`id="${RUNTIME_ID}"`),rel+": finale UX-runtime ontbreekt");
  eis(html.includes('.final-top-grid>.stats .stat .sval{justify-content:center!important'),rel+": flexwaarde in hoofdtegel is niet werkelijk gecentreerd");
  eis(html.includes('html{scrollbar-width:thin;scrollbar-color:var(--ink-45) var(--paper)}'),rel+": pagina-scrollbar mist thematische styling");
  eis(html.includes('.wiw-hour-table-scroll{scrollbar-width:thin;scrollbar-color:var(--ink-45) transparent;scrollbar-gutter:stable}'),rel+": uurtabel-scrollbar mist rustige styling");
  eis(html.includes('#nights .row.night{grid-template-columns:112px 72px minmax(220px,1fr) 112px minmax(300px,360px)!important'),rel+": desktop Nachtzicht-grid ontbreekt");
  eis(html.includes('#nights .row.night .nmeta.wide{display:flex;flex-direction:column;align-items:center;justify-content:center'),rel+": Beste zichtperiode is niet als gecentreerd contentblok opgebouwd");
  eis(html.includes('#nights .row.night .nachtadvies{text-align:left}'),rel+": lange Nachtzicht-uitleg is niet leesbaar links uitgelijnd");
  eis(html.includes('.wiw-hour-table-scroll{max-height:none!important;overflow-y:visible!important'),rel+": mobiele uurtabel is nog een geneste verticale scroller");
  eis(html.includes('.wiw-hour-mobile-hidden{display:none!important}'),rel+": mobiele urenpreview ontbreekt");
  eis(html.includes('padding-top:calc(14px + env(safe-area-inset-top))'),rel+": mobiele top-safe-area ontbreekt");
  eis(html.includes('#minibar{top:env(safe-area-inset-top)!important'),rel+": minibar respecteert de top-safe-area niet");
  eis(html.includes('.sheet{padding-left:16px!important;padding-right:16px!important}'),rel+": compacte mobiele sheet-padding ontbreekt");
  eis(html.includes('.tools #ververs,.tools #thema{color:var(--ink-45);opacity:.72'),rel+": secundaire headeracties missen hiërarchie");
  eis(html.includes('.tools #here{color:var(--ink);border-color:var(--ink);font-weight:600}'),rel+": primaire locatieactie mist nadruk");
  eis(html.includes('kop.textContent="Zichtscore"'),rel+": Nachtzicht-label is niet semantisch aangescherpt");
  eis(html.includes('sub.textContent="Goed zicht."'),rel+": redundante zicht-helpertekst is niet aangescherpt");
  eis(html.includes('if(knop.textContent!==label)knop.textContent=label'),rel+": mobiele urenruntime kan onnodige observer-mutaties veroorzaken");
  eis(!html.includes('html[data-thema="rood"]{--ink:#F27667'),rel+": verwijderde rode productstand is opnieuw geïntroduceerd");
  eis((html.split(MARKER).length-1)===1,rel+": marker staat niet exact één keer");
  eis((html.split(`id="${RUNTIME_ID}"`).length-1)===1,rel+": UX-runtime staat niet exact één keer");
  const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach((bron,i)=>new vm.Script(bron,{filename:rel+":final-visual-polish-"+(i+1)}));
}

const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,"package.json"),"utf8"));
eis(pkg.scripts.test.includes("apply-final-visual-polish-20260902.js")&&pkg.scripts.test.includes("browser-final-visual-polish-20260902.test.js"),"testscript is niet volledig bedraad");
eis(pkg.scripts.postbuild.includes("apply-final-visual-polish-20260902.js")&&pkg.scripts.postbuild.includes("verify-final-visual-polish-20260902.js"),"postbuild is niet volledig bedraad");
console.log(`Final visual polish artifact groen op ${weer.length} weerpagina's: desktopbalans behouden; mobile urenpreview, safe areas, headerhiërarchie en Nachtzicht-semantiek geborgd.`);
