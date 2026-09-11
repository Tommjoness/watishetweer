"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const OUD="    const eersteBoven = soort[i]!==-1;";
const NIEUW="    const eersteBoven = true; // Temperatuurlabels beginnen consequent boven de lijn.";
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

function pasHtmlToe(html,label="artifact"){
  const bron=String(html||"");
  const oudAantal=bron.split(OUD).length-1;
  const nieuwAantal=bron.split(NIEUW).length-1;
  const relevant=bron.includes(PLAATSINGSANKER)||oudAantal>0||nieuwAantal>0;
  if(!relevant)return {html:bron,relevant:false,geraakt:false,reeds:false};
  if(!bron.includes(FALLBACKANKER))throw new Error(`${label}: grafiekfallback boven/onder ontbreekt.`);
  if(oudAantal===1&&nieuwAantal===0){
    return {html:bron.replace(OUD,NIEUW),relevant:true,geraakt:true,reeds:false};
  }
  if(oudAantal===0&&nieuwAantal===1){
    return {html:bron,relevant:true,geraakt:false,reeds:true};
  }
  throw new Error(`${label}: onverwacht labelplaatsingscontract (oud=${oudAantal}, nieuw=${nieuwAantal}).`);
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
    console.log(`Temperatuurlabels aangepast op ${geraakt}/${relevant} weergrafiek-artifacts; onder de lijn blijft alleen collision/rand-fallback. Cache ${cache}.`);
  }else{
    console.log(`Temperatuurlabels waren al consistent op ${reeds}/${relevant} weergrafiek-artifacts.`);
  }
}

if(require.main===module)main();
module.exports={OUT,OUD,NIEUW,PLAATSINGSANKER,FALLBACKANKER,htmlBestanden,pasHtmlToe,main};
