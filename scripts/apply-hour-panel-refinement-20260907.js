"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="/* ===== HOUR PANEL REFINEMENT 20260907 ===== */";
const UREN_OUD="const MAX_DESKTOP_UREN=10;";
const UREN_NIEUW="const MAX_DESKTOP_UREN=12;";
const MM_OUD='mm.textContent=num(r.hoeveelheid)===0&&(num(r.kans)===null||num(r.kans)<=0)?"–":formatMm(r.hoeveelheid)||"–";';
const MM_NIEUW='mm.textContent=formatMm(r.hoeveelheid)||"–";';

function tel(bron,zoek){return String(bron).split(zoek).length-1;}
function htmlBestanden(dir){
  const uit=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())uit.push(...htmlBestanden(p));
    else if(ent.isFile()&&ent.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}
function vervangEen(bron,oud,nieuw,label){
  const oudN=tel(bron,oud),nieuwN=tel(bron,nieuw);
  if(oudN===1&&nieuwN===0)return bron.replace(oud,nieuw);
  if(oudN===0&&nieuwN===1)return bron;
  throw new Error(`${label}: verwacht precies één oude of nieuwe variant; oud=${oudN}, nieuw=${nieuwN}.`);
}
function pasTekstAan(html,label="artifact"){
  let bron=String(html||"");
  if(!bron.includes("WeatherNowFinalDesktopUI20260902"))return {html:bron,geraakt:false};
  bron=vervangEen(bron,UREN_OUD,UREN_NIEUW,`${label} desktopuren`);
  bron=vervangEen(bron,MM_OUD,MM_NIEUW,`${label} neerslagnul`);
  if(!bron.includes(MARKER)){
    const anker='const MARKER="final-desktop-ui-20260902";';
    if(tel(bron,anker)!==1)throw new Error(`${label}: runtime-marker ontbreekt of is dubbel.`);
    bron=bron.replace(anker,`${MARKER}\n${anker}`);
  }
  return {html:bron,geraakt:true};
}
function main(){
  let geraakt=0,geschreven=0;
  for(const p of htmlBestanden(OUT)){
    const voor=fs.readFileSync(p,"utf8"),r=pasTekstAan(voor,path.relative(OUT,p));
    if(!r.geraakt)continue;
    geraakt++;
    if(r.html!==voor){fs.writeFileSync(p,r.html,"utf8");geschreven++;}
  }
  if(!geraakt)throw new Error("Geen WeatherNow-artifacts gevonden voor uurpaneelrefinement.");
  const cache=vernieuwServiceworkerCache(OUT,"hour-panel-refinement-20260907");
  console.log(`Uurpaneelrefinement toegepast op ${geraakt} weerartifacts (${geschreven} gewijzigd): maximaal 12 passende desktopuren en numerieke 0 mm blijft zichtbaar; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,MARKER,UREN_OUD,UREN_NIEUW,MM_OUD,MM_NIEUW,tel,htmlBestanden,vervangEen,pasTekstAan,main};
