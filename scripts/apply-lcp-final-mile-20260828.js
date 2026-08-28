"use strict";

const fs=require("fs");
const path=require("path");

const bestand=path.join(__dirname,"..","public","index.html");
if(!fs.existsSync(bestand))throw new Error("public/index.html ontbreekt; voer build eerst uit.");
let html=fs.readFileSync(bestand,"utf8");

const PRECONNECT='<link rel="preconnect" href="https://api.open-meteo.com" crossorigin>';
if(!html.includes(PRECONNECT)){
  const anker='<link rel="apple-touch-icon" href="icon-192.png">';
  if(!html.includes(anker))throw new Error("Apple-touch-icon anker ontbreekt voor forecast-preconnect.");
  html=html.replace(anker,anker+"\n"+PRECONNECT);
}

const marker="/* ===== LCP FINAL MILE 20260828 ===== */";
if(!html.includes(marker)){
  const tekenAnker="function tekenAlles(){";
  if(!html.includes(tekenAnker))throw new Error("tekenAlles() ontbreekt; LCP-splitsing kan niet veilig worden toegepast.");
  const helper=`${marker}\nlet nietKritiekeRenderToken=0;\nfunction planNietKritiekeWeergave(startIdx){\n  const token=++nietKritiekeRenderToken;\n  const geldig=()=>token===nietKritiekeRenderToken;\n  const volgendFrame=fn=>{\n    if(!geldig())return;\n    if(typeof requestAnimationFrame===\"function\")requestAnimationFrame(()=>{if(geldig())fn();});\n    else setTimeout(()=>{if(geldig())fn();},16);\n  };\n  const stap4=()=>{lucht();nuTimerStart();klokTimerStart();};\n  const stap3=()=>{nachten();volgendFrame(stap4);};\n  const stap2=()=>{dagen();volgendFrame(stap3);};\n  const stap1=()=>{etmaal(startIdx,S.bereik);nowcast();volgendFrame(stap2);};\n  /* Twee frames geven de browser één echte paintkans nadat #app zichtbaar is.\n     Daarna worden onder-de-vouwmodules over losse frames verdeeld, zodat de\n     briefing niet meer achter één lange initiële render-taak hoeft te wachten. */\n  if(typeof requestAnimationFrame===\"function\")requestAnimationFrame(()=>requestAnimationFrame(()=>{if(geldig())stap1();}));\n  else setTimeout(()=>{if(geldig())stap1();},0);\n}\n\n`;
  html=html.replace(tekenAnker,helper+tekenAnker);
}

const oud=/meters\(\);briefing\(\);etmaal\(startIdx,S\.bereik\);nowcast\(\);dagen\(\);nachten\(\);lucht\(\);stempel\(\);\s*nuTimerStart\(\);\s*klokTimerStart\(\);/;
if(oud.test(html)){
  html=html.replace(oud,"meters();briefing();stempel();\n  planNietKritiekeWeergave(startIdx);");
}

if(!html.includes(marker))throw new Error("LCP-marker ontbreekt na patch.");
if(oud.test(html))throw new Error("Oude monolithische tekenAlles-renderroute is blijven staan.");
if((html.match(/rel=\"preconnect\" href=\"https:\/\/api\.open-meteo\.com\"/g)||[]).length!==1)throw new Error("Forecast-preconnect moet exact één keer aanwezig zijn.");

fs.writeFileSync(bestand,html);
console.log("LCP final-mile toegepast: forecast-preconnect en gefaseerde onder-de-vouwrendering.");
