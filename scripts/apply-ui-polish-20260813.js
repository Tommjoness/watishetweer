"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
let html=fs.readFileSync(htmlPad,"utf8");
const runtime=fs.readFileSync(path.join(__dirname,"ui-polish-20260813-runtime.js"),"utf8");
const RUNTIME_MARK="/* ===== UI POLISH RUNTIME 20260813 ===== */";
const CSS_MARK="/* ===== UI POLISH CSS 20260813 ===== */";

if(html.includes(RUNTIME_MARK)||html.includes(CSS_MARK))throw new Error("UI-polish is al toegepast.");
if(!runtime.includes(RUNTIME_MARK))throw new Error("UI-polish runtime mist versie-marker.");

const css=`
${CSS_MARK}
/* Waarschuwingen zijn belangrijk, maar een gewone advisory hoeft niet dezelfde
   visuele urgentie te krijgen als een rode waarschuwing. Alleen niveau rood
   houdt daarom de carmine-accentkleur; de overige niveaus blijven rustig. */
#waarschuwingen>.msg{font-size:12.5px;color:var(--ink-45);padding:7px 0}
.waarsch{border-left:1px solid var(--rule);padding:8px 0 8px 12px;margin-top:var(--s2)}
.waarsch h3{font-family:var(--sans);font-weight:500;font-size:14px;line-height:1.35;margin:0 0 3px;color:var(--ink)}
.waarsch p{margin:0;font-size:13px;line-height:1.45;color:var(--ink-70)}
.waarsch[data-ui-severity="rood"]{border-left:3px solid var(--carmine)}
.waarsch[data-ui-severity="rood"] h3{color:var(--carmine)}
.waarsch-details{margin-top:6px;font-size:12px;color:var(--ink-45)}
.waarsch-details summary{display:inline;cursor:pointer;color:var(--ink-45);box-shadow:inset 0 -1px 0 var(--rule)}
.waarsch-details summary:hover{color:var(--ink)}
.waarsch-details p{margin-top:7px;font-size:12px;color:var(--ink-45);max-width:92ch}
.row.day.kop .bar{text-align:center}
`;

const HEAD_EIND="</head>";
if(html.split(HEAD_EIND).length-1!==1)throw new Error("Exact één head-einde vereist voor UI-polish.");
html=html.replace(HEAD_EIND,"<style>"+css+"</style>\n"+HEAD_EIND);

const START="/* ---------- start ---------- */";
const aantal=html.split(START).length-1;
if(aantal!==1)throw new Error("Algemene startmarker ontbreekt of is dubbel: "+aantal);
html=html.replace(START,runtime+"\n"+START);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime gevonden na UI-polish.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:ui-polish-"+(i+1)}));
fs.writeFileSync(htmlPad,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"ui-polish-20260813");
console.log("UI-polish toegepast: rustige waarschuwingen, natuurlijke windtekst, bereik-kop, opgeschoonde neerslagpresentatie en daglichtbewuste zontekst; cache "+versie+".");
