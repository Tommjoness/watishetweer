"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");
const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-live-screenshot-polish-20260912";
const CAMS="Pollenwaarden zijn een verwachting van CAMS; de werkelijke blootstelling kan lokaal verschillen.";

function htmlBestanden(dir){
  const uit=[];
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,item.name);
    if(item.isDirectory())uit.push(...htmlBestanden(p));
    else if(item.isFile()&&item.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}
function tel(bron,zoek){return String(bron).split(zoek).length-1;}

let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(CAMS))continue;
  const rel=path.relative(OUT,p);
  assert.strictEqual(tel(html,`id="${STYLE_ID}"`),1,rel+": follow-up stylesheet niet exact eenmaal aanwezig");
  assert.ok(html.includes('#chart g[data-q4-rain-periods]{transform:none!important}'),rel+": historische -6px regen-transform wordt niet geneutraliseerd");
  assert.ok(html.includes('.chips{margin-top:12px!important}'),rel+": compacte mast/chipspacing ontbreekt");
  assert.ok(html.includes('.brief{margin-top:18px!important;padding-top:18px!important}'),rel+": compacte briefingovergang ontbreekt");
  assert.ok(html.includes('footer{font-size:13px!important;line-height:1.5!important;gap:4px 16px!important}'),rel+": footerleesbaarheid ontbreekt");
  assert.ok(html.includes('body > .seo-plaatsnav{margin-top:10px!important}'),rel+": dunnere zachte plaatsnavigatie-overgang ontbreekt");
  assert.strictEqual(tel(html,CAMS),1,rel+": bestaande CAMS-copy moet exact behouden blijven");
  assert.ok(html.includes('#aq{')&&html.includes('padding-inline:18px'),rel+": bestaande AQI-layout uit vorige finale polish ontbreekt");
  gezien++;
}
assert.ok(gezien>0,"Geen finale weerartifact met live-screenshot-polish gevonden.");
const cache=verifieerServiceworkerCache(OUT,"live-screenshot-polish-20260912");
assert.ok(/^watishetweer-[0-9a-f]{12}$/.test(cache),"serviceworker-cache hoort bij het gewijzigde artifact");
console.log("Late live-screenshot-polish artifactcontrole groen voor "+gezien+" weerartifacts; AQI/CAMS behouden; cache "+cache+".");
