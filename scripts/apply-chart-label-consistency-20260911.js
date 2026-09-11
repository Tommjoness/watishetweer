"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const OUD="    const eersteBoven = soort[i]!==-1;";
const NIEUW="    const eersteBoven = true; // Temperatuurlabels beginnen consequent boven de lijn.";
const RASTER_OUD="    if(!kandKaart.has(i)) kandKaart.set(i,1);";
const RASTER_NIEUW="    if(n<=24) zet(i,4); else if(!kandKaart.has(i)) kandKaart.set(i,1); // Vast etmaalraster eerst; extrema blijven extra.";
const PLAATSINGSANKER="    let poging=probeerLagen(cx,v,eersteBoven,null);";
const FALLBACKANKER="    if(!eersteBoven) opties.reverse();";

function htmlBestanden(dir){
  const uit=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())uit.push(...htmlBestanden(p));
    else if(ent.isFile()&&ent.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function vervangContract(bron,oud,nieuw,label){
  const oudAantal=bron.split(oud).length-1;
  const nieuwAantal=bron.split(nieuw).length-1;
  if(oudAantal===1&&nieuwAantal===0)return {html:bron.replace(oud,nieuw),geraakt:true};
  if(oudAantal===0&&nieuwAantal===1)return {html:bron,geraakt:false};
  throw new Error(`${label}: onverwacht contract (oud=${oudAantal}, nieuw=${nieuwAantal}).`);
}

function pasHtmlToe(html,label="artifact"){
  const bron=String(html||"");
  const relevant=bron.includes(PLAATSINGSANKER)||bron.includes(OUD)||bron.includes(NIEUW);
  if(!relevant)return {html:bron,relevant:false,geraakt:false,reeds:false};
  if(!bron.includes(FALLBACKANKER))throw new Error(`${label}: grafiekfallback boven/onder ontbreekt.`);

  const zijde=vervangContract(bron,OUD,NIEUW,`${label}: labelzijde`);
  const raster=vervangContract(zijde.html,RASTER_OUD,RASTER_NIEUW,`${label}: etmaalraster`);
  const geraakt=zijde.geraakt||raster.geraakt;
  return {html:raster.html,relevant:true,geraakt,reeds:!geraakt};
}

function main(){
  let relevant=0,geraakt=0,reeds=0;
  for(const p of htmlBestanden(OUT)){
    const oud=fs.readFileSync(p,"utf8");
    const uit=pasHtmlToe(oud,path.relative(OUT,p));
    if(!uit.relevant)continue;
    relevant++;
    if(uit.reeds)reeds++;
    if(!uit.geraakt)continue;
    fs.writeFileSync(p,uit.html,"utf8");
    geraakt++;
  }
  if(!relevant)throw new Error("Geen weergrafiek-artifact gevonden voor temperatuur-labelconsistentie.");
  if(geraakt){
    const cache=vernieuwServiceworkerCache(OUT,"chart-label-consistency-20260911");
    console.log(`Temperatuurlabels aangepast op ${geraakt}/${relevant} weergrafiek-artifacts: boven heeft voorkeur en het vaste etmaalraster blijft beschermd; onder de lijn blijft collision/rand-fallback. Cache ${cache}.`);
  }else{
    console.log(`Temperatuurlabels en etmaalraster waren al consistent op ${reeds}/${relevant} weergrafiek-artifacts.`);
  }
}

if(require.main===module)main();
module.exports={OUT,OUD,NIEUW,RASTER_OUD,RASTER_NIEUW,PLAATSINGSANKER,FALLBACKANKER,htmlBestanden,vervangContract,pasHtmlToe,main};
