"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");
const OUT=path.join(__dirname,"..","public"),START="/* ---------- start ---------- */";
const MARKER="/* ===== FINAL DESKTOP UI 20260902 ===== */";
const PRESSURE_OLD=`function herstelVerborgenDruk(){
  const details=document.getElementById("wiw-more-measurements"),pres=document.getElementById("pres"),diag=document.getElementById("wiw-pressure-diagnostic"),stat=pres&&pres.closest(".stat");
  if(stat&&diag&&!diag.contains(stat))diag.appendChild(stat);
  if(details)details.remove();
  const betekenis=stat&&stat.querySelector(".wiw-pressure-meaning");if(betekenis)betekenis.remove();
}`;
const PRESSURE_NEW=`function herstelVerborgenDruk(){
  const details=document.getElementById("wiw-more-measurements"),pres=document.getElementById("pres"),stat=pres&&pres.closest(".stat");
  let diag=document.getElementById("wiw-pressure-diagnostic");
  if(stat&&!diag){
    diag=document.createElement("div");diag.id="wiw-pressure-diagnostic";diag.hidden=true;diag.setAttribute("aria-hidden","true");
    const ouder=(details&&details.parentNode)||(stat&&stat.parentNode)||document.getElementById("app");
    if(ouder)ouder.insertBefore(diag,details&&details.parentNode===ouder?details:null);
  }
  if(stat&&diag&&!diag.contains(stat))diag.appendChild(stat);
  const veiligVerplaatst=!!(stat&&diag&&diag.contains(stat));
  if(details&&veiligVerplaatst)details.remove();
  else if(details){details.hidden=true;details.setAttribute("aria-hidden","true");}
  const betekenis=stat&&stat.querySelector(".wiw-pressure-meaning");if(betekenis)betekenis.remove();
}`;
function herstelDrukOwnerRuntime(bron){const n=String(bron).split(PRESSURE_OLD).length-1;if(n!==1)throw new Error("Finale desktop-UI drukowneranker verwacht exact één keer; gevonden "+n);return String(bron).replace(PRESSURE_OLD,PRESSURE_NEW);}
const RUNTIME=herstelDrukOwnerRuntime(fs.readFileSync(path.join(__dirname,"final-desktop-ui-runtime-20260902.js"),"utf8"));
function htmlBestanden(dir){const uit=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())uit.push(...htmlBestanden(p));else if(e.isFile()&&e.name.endsWith(".html"))uit.push(p);}return uit;}
function weerBestand(html){return html.includes("/* ===== FINAL AUDIT 20260901 ===== */")&&html.includes("WeatherNowFinalGlobalCorrectness");}
function pasToe(pad){let html=fs.readFileSync(pad,"utf8");if(!weerBestand(html))return false;if(html.includes(MARKER))throw new Error("Finale desktop-UI staat al in "+pad);const n=html.split(START).length-1;if(n!==1)throw new Error("Startupmarker ontbreekt of is dubbel in "+pad+": "+n);html=html.replace(START,MARKER+"\n"+RUNTIME+"\n"+START);const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);scripts.forEach((bron,i)=>new vm.Script(bron,{filename:path.basename(pad)+":final-desktop-ui-"+(i+1)}));fs.writeFileSync(pad,html,"utf8");return true;}
function main(){let n=0;for(const p of htmlBestanden(OUT))if(pasToe(p))n++;if(!n)throw new Error("Geen finale weerpagina's gevonden voor desktop-UI-laag.");const versie=vernieuwServiceworkerCache(OUT,"final-desktop-ui-20260902");console.log(`Finale desktop-UI toegepast op ${n} weerpagina's; luchtdruk zichtbaar verwijderd met behouden DOM-owner, 24-uurs- en neerslaglayout gebalanceerd, korte copy/footer gecentreerd en responsive gedrag geborgd; cache ${versie}.`);}
if(require.main===module)main();
module.exports={OUT,START,MARKER,RUNTIME,PRESSURE_OLD,PRESSURE_NEW,herstelDrukOwnerRuntime,weerBestand,pasToe,main};
