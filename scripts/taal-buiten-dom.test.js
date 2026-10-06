"use strict";
/* Teksten die de vertaallaag niet bereikt: CSS-content en het native
   deelmenu/kopieervenster. Die kiezen zelf de taal (audit 6 oktober, F08). */
const assert=require("assert");
const fs=require("fs");
const path=require("path");
const root=path.join(__dirname,"..");

const css=fs.readFileSync(path.join(root,"live-polish.css"),"utf8");
assert(css.includes('content:"Verwachting wordt bijgewerkt…"'),"Nederlandse laadstatus ontbreekt");
assert(/html\[lang\^="en"\] #brief\[data-q1-briefing-pending\]::after,html\[lang\^="en"\] #brief\[data-knmi-briefing-pending\]::after\{content:"Updating the forecast…"\}/.test(css),"Engelse laadstatus ontbreekt voor beide wachtstanden");

const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const begin=html.indexOf("async function deelPlaats(");
assert(begin>0,"deelPlaats niet gevonden");
const deel=html.slice(begin,html.indexOf("\n}\n",begin));
assert(/const engels=\/\^en\\b\/i\.test\(document\.documentElement\.getAttribute\("lang"\)/.test(deel),"deelPlaats kijkt niet naar de gekozen taal");
for(const t of ['"Weather in "','"The weather in "','", by the hour and for 7 days."','"Copy this link:"','"Weer in "','"Het weer in "','"Kopieer deze link:"'])
  assert(deel.includes(t),"deeltekst mist "+t);

console.log("Taal buiten de DOM: laadstatus (CSS) en deelmenu/kopieervenster volgen NL en EN.");
