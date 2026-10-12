"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const START="/* ---------- start ---------- */";
const MARKER="/* ===== KLEUR 20261012 ===== */";
const STYLE_ID="wiw-kleur-20261012";
const CSS=fs.readFileSync(path.join(__dirname,"kleur-20261012.css"),"utf8");
const RUNTIME=fs.readFileSync(path.join(__dirname,"kleur-20261012.js"),"utf8");

/* Kleurronde (akkoord eigenaar 12 oktober): metertjes in de tegels en de
   accentkleuren van iconen, grafiek en dagbalken.
   De temperatuurschaal en de iconklassen staan in de app zelf, het
   temperatuurvlak in de grafiekrenderer; deze stap voegt in twee fasen toe:
   - "runtime": de tegelruntime, vóór platform-output-cleanup (daarna is de
     runtime uit de HTML gehaald en gebundeld);
   - "stijl": de gedeelde CSS, als laatste stijllaag na de ontwerprondes, zodat
     geen latere laag de kleuren overschrijft. */
function htmlBestanden(dir){
  const uit=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())uit.push(...htmlBestanden(p));
    else if(e.isFile()&&e.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}
const weerBestand=html=>html.includes("/* ===== FINAL AUDIT 20260901 ===== */")&&html.includes("WeatherNowFinalGlobalCorrectness");

function pasRuntimeToe(html,rel){
  if(html.includes(MARKER))throw new Error(rel+": kleurruntime staat al in artifact.");
  const n=html.split(START).length-1;
  if(n!==1)throw new Error(rel+": startmarker ontbreekt of is dubbel: "+n);
  const uit=html.replace(START,MARKER+"\n"+RUNTIME+"\n"+START);
  [...uit.matchAll(/<script(?![^>]*\ssrc=)(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g)]
    .forEach((m,i)=>new vm.Script(m[1],{filename:rel+":kleur-"+(i+1)}));
  return uit;
}

/* Na de bundeling herkent een weerpagina zich aan de gedeelde app-bundle. */
const gebundeldeWeerpagina=html=>/<script src="\/app-[0-9a-f]{12}\.min\.js"/.test(html);
function pasStijlToe(html,rel){
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": kleurstijl staat al in artifact.");
  if(!html.includes("</head>"))throw new Error(rel+": headafsluiting ontbreekt.");
  return html.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
}

function main(fase){
  if(fase!=="runtime"&&fase!=="stijl")throw new Error("Gebruik: apply-kleur-20261012.js runtime|stijl");
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    const html=fs.readFileSync(p,"utf8"),rel=path.relative(OUT,p);
    if(fase==="runtime"){if(!weerBestand(html))continue;fs.writeFileSync(p,pasRuntimeToe(html,rel),"utf8");}
    else{if(!gebundeldeWeerpagina(html))continue;fs.writeFileSync(p,pasStijlToe(html,rel),"utf8");}
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerpagina geraakt door de kleurlaag ("+fase+").");
  if(fase==="runtime"){console.log("Kleurruntime toegevoegd aan "+geraakt+" weerpagina's (metertjes).");return {geraakt};}
  const cache=vernieuwServiceworkerCache(OUT,"kleur-20261012");
  console.log("Kleurstijl toegepast op "+geraakt+" weerpagina's: metertjes, iconaccenten, grafiekvlak en dagbalken; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main(process.argv[2]);
module.exports={OUT,START,MARKER,STYLE_ID,CSS,RUNTIME,htmlBestanden,weerBestand,gebundeldeWeerpagina,pasRuntimeToe,pasStijlToe,main};
