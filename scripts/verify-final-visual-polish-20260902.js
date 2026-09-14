"use strict";

const fs=require("fs"),path=require("path"),vm=require("vm");
const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const MARKER="/* ===== FINAL VISUAL POLISH 20260902 ===== */";
const RUNTIME_ID="final-visual-polish-runtime-20260903";
function eis(c,m){if(!c)throw new Error("Final visual polish-verificatie: "+m);}
function htmlBestanden(dir){const uit=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())uit.push(...htmlBestanden(p));else if(e.isFile()&&e.name.endsWith(".html"))uit.push(p);}return uit;}
function rgb(hex){const m=/^#([0-9a-f]{6})$/i.exec(String(hex||""));if(!m)return null;const n=parseInt(m[1],16);return [(n>>16)&255,(n>>8)&255,n&255];}
function lineair(v){v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);}
function luminantie(k){return .2126*lineair(k[0])+.7152*lineair(k[1])+.0722*lineair(k[2]);}
function meng(voor,achter,a){return voor.map((v,i)=>v*a+achter[i]*(1-a));}
function contrast(a,b){const l1=luminantie(a),l2=luminantie(b),hoog=Math.max(l1,l2),laag=Math.min(l1,l2);return (hoog+.05)/(laag+.05);}
function laatsteHex(bron,re,label){let m,waarde=null;re.lastIndex=0;while((m=re.exec(bron)))waarde=m[1];eis(waarde,label+" ontbreekt");return waarde;}

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
  eis(html.includes('.tools #ververs,.tools #thema{color:var(--ink-45);opacity:.92'),rel+": secundaire headeracties missen de AA-contrastcorrectie");
  eis(html.includes('.tools #ververs:hover,.tools #ververs:focus-visible,.tools #thema:hover,.tools #thema:focus-visible{color:var(--ink);opacity:1}'),rel+": hover/focuscontrast van headeracties is geraakt");
  eis(/button:disabled\s*\{[^}]*cursor\s*:\s*default/i.test(html),rel+": disabled-knopgedrag is niet meer aanwezig");
  eis(html.includes('.tools #here{color:var(--ink);border-color:var(--rule);font-weight:600}'),rel+": primaire locatieactie mist tekstnadruk of subtiele divider");

  const opacityMatch=/\.tools #ververs,\.tools #thema\{[^}]*opacity:(0?\.\d+|1(?:\.0+)?)/.exec(html);
  eis(opacityMatch,rel+": refresh-opacity niet uitleesbaar");
  const opacity=Number(opacityMatch[1]);
  const lichtVoor=rgb(laatsteHex(html,/:root\s*\{[^}]*--ink-45\s*:\s*(#[0-9a-f]{6})/ig,rel+": lichte --ink-45"));
  const lichtAchter=rgb(laatsteHex(html,/:root\s*\{[^}]*--sheet\s*:\s*(#[0-9a-f]{6})/ig,rel+": lichte --sheet"));
  const donkerVoor=rgb(laatsteHex(html,/html\[data-thema=["']donker["']\]\s*\{[^}]*--ink-45\s*:\s*(#[0-9a-f]{6})/ig,rel+": donkere --ink-45"));
  const donkerAchter=rgb(laatsteHex(html,/html\[data-thema=["']donker["']\]\s*\{[^}]*--sheet\s*:\s*(#[0-9a-f]{6})/ig,rel+": donkere --sheet"));
  const lichtContrast=contrast(meng(lichtVoor,lichtAchter,opacity),lichtAchter);
  const donkerContrast=contrast(meng(donkerVoor,donkerAchter,opacity),donkerAchter);
  eis(lichtContrast>=4.5,rel+`: Ververs light contrast ${lichtContrast.toFixed(2)}:1 is lager dan 4.5:1`);
  eis(donkerContrast>=4.5,rel+`: Ververs dark contrast ${donkerContrast.toFixed(2)}:1 is lager dan 4.5:1`);

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
console.log(`Final visual polish artifact groen op ${weer.length} weerpagina's: desktopbalans behouden; Ververs AA-contrast in licht/donker, mobile urenpreview, safe areas, headerhiërarchie en Nachtzicht-semantiek geborgd.`);
