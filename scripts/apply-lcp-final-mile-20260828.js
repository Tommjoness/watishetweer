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
  const helper=`${marker}\nlet nietKritiekeRenderToken=0;\nlet mobieleLuchtRenderUitgesteld=false;\nconst luchtVoorLcp=lucht;\nlucht=function(){\n  if(mobieleLuchtRenderUitgesteld)return;\n  return luchtVoorLcp.apply(this,arguments);\n};\nfunction mobieleLcpSplitsing(){\n  return typeof matchMedia===\"function\"&&matchMedia(\"(max-width: 900px)\").matches;\n}\nfunction planNietKritiekeWeergave(startIdx){\n  const token=++nietKritiekeRenderToken;\n  mobieleLuchtRenderUitgesteld=true;\n  const geldig=()=>token===nietKritiekeRenderToken;\n  const volgendFrame=fn=>{\n    if(!geldig())return;\n    if(typeof requestAnimationFrame===\"function\")requestAnimationFrame(()=>{if(geldig())fn();});\n    else setTimeout(()=>{if(geldig())fn();},16);\n  };\n  const stap4=()=>{\n    mobieleLuchtRenderUitgesteld=false;\n    lucht();nuTimerStart();klokTimerStart();\n  };\n  const stap3=()=>{nachten();volgendFrame(stap4);};\n  const stap2=()=>{dagen();volgendFrame(stap3);};\n  const stap1=()=>{etmaal(startIdx,S.bereik);nowcast();volgendFrame(stap2);};\n  /* Alleen de mobiele PageSpeed-route wordt opgesplitst. Desktop behoudt de\n     bewezen directe rendersemantiek. Twee frames geven mobiel een echte\n     paintkans voor de briefing voordat onder-de-vouwmodules renderen.\n     Luchtkwaliteit kan via zijn eigen async response eerder klaar zijn; die\n     presentatie blijft daarom tot stap 4 geblokkeerd zodat de framevolgorde\n     ook in WebKit deterministisch blijft. */\n  if(typeof requestAnimationFrame===\"function\")requestAnimationFrame(()=>requestAnimationFrame(()=>{if(geldig())stap1();}));\n  else setTimeout(()=>{if(geldig())stap1();},0);\n}\nfunction renderNietKritiekeWeergave(startIdx){\n  if(mobieleLcpSplitsing()){planNietKritiekeWeergave(startIdx);return;}\n  nietKritiekeRenderToken++;\n  mobieleLuchtRenderUitgesteld=false;\n  etmaal(startIdx,S.bereik);nowcast();dagen();nachten();lucht();nuTimerStart();klokTimerStart();\n}\n\n`;
  html=html.replace(tekenAnker,helper+tekenAnker);
}

const oud=/meters\(\);briefing\(\);etmaal\(startIdx,S\.bereik\);nowcast\(\);dagen\(\);nachten\(\);lucht\(\);stempel\(\);\s*nuTimerStart\(\);\s*klokTimerStart\(\);/;
if(oud.test(html)){
  html=html.replace(oud,"meters();briefing();stempel();\n  renderNietKritiekeWeergave(startIdx);");
}

if(!html.includes(marker))throw new Error("LCP-marker ontbreekt na patch.");
if(oud.test(html))throw new Error("Oude monolithische tekenAlles-renderroute is blijven staan.");
if((html.match(/rel=\"preconnect\" href=\"https:\/\/api\.open-meteo\.com\"/g)||[]).length!==1)throw new Error("Forecast-preconnect moet exact één keer aanwezig zijn.");

fs.writeFileSync(bestand,html);
console.log("LCP final-mile toegepast: forecast-preconnect, mobiele frame-splitsing en direct desktoprenderpad.");