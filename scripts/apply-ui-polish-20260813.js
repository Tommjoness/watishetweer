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

const css=`\n${CSS_MARK}\n/* Waarschuwingen zijn belangrijk, maar een gewone advisory hoeft niet dezelfde\n   visuele urgentie te krijgen als een rode waarschuwing. Alleen niveau rood\n   houdt daarom de carmine-accentkleur; de overige niveaus blijven rustig. */\n#waarschuwingen>.msg{font-size:12.5px;color:var(--ink-45);padding:7px 0}\n.waarsch{border-left:1px solid var(--rule);padding:8px 0 8px 12px;margin-top:var(--s2)}\n.waarsch h3{font-family:var(--sans);font-weight:500;font-size:14px;line-height:1.35;margin:0 0 3px;color:var(--ink)}\n.waarsch p{margin:0;font-size:13px;line-height:1.45;color:var(--ink-70)}\n.waarsch[data-ui-severity=\"rood\"]{border-left:3px solid var(--carmine)}\n.waarsch[data-ui-severity=\"rood\"] h3{color:var(--carmine)}\n.waarsch-details{margin-top:6px;font-size:12px;color:var(--ink-45)}\n.waarsch-details summary{display:inline;cursor:pointer;color:var(--ink-45);box-shadow:inset 0 -1px 0 var(--rule)}\n.waarsch-details summary:hover{color:var(--ink)}\n.waarsch-details p{margin-top:7px;font-size:12px;color:var(--ink-45);max-width:92ch}\n.row.day.kop .bar{text-align:center}\n`;

if((html.match(/<\/style>/g)||[]).length!==1)throw new Error("Exact één stijlblok vereist voor UI-polish.");
html=html.replace("</style>",css+"</style>");

const START="/* ---------- start ---------- */";
const aantal=html.split(START).length-1;
if(aantal!==1)throw new Error("Algemene startmarker ontbreekt of is dubbel: "+aantal);
html=html.replace(START,runtime+"\n"+START);

const scripts=[...html.matchAll(/<script(?![^>]*\\ssrc=)[^>]*>([\\s\\S]*?)<\\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime gevonden na UI-polish.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:ui-polish-"+(i+1)}));
fs.writeFileSync(htmlPad,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"ui-polish-20260813");
console.log("UI-polish toegepast: rustige waarschuwingen, natuurlijke windtekst, bereik-kop, opgeschoonde neerslagpresentatie en daglichtbewuste zontekst; cache "+versie+".");
