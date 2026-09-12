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
  assert.ok(html.includes('let dichtst=null,afstand=Infinity;'),rel+": nearest-only nu-labelsuppressie ontbreekt");
  assert.ok(html.includes('if(dichtst!==null&&afstand<cw*.6) kandKaart.delete(dichtst);'),rel+": alleen dichtstbijzijnde modeluur mag bij nu verdwijnen");
  assert.ok(!html.includes('if(Math.abs(x(idx)-nuX)<cw*1.05) kandKaart.delete(idx);'),rel+": oude twee-uurs labelsuppressie is nog actief");
  assert.ok(html.includes('const compactDesktop=typeof window!=="undefined"&&window.innerWidth>=1100&&!g.M&&g.n<=25;'),rel+": desktop-only Q4 compactcontract ontbreekt");
  assert.ok(html.includes('const y=pb+(compactDesktop?30:48)'),rel+": compacte regenbracket-offset ontbreekt");
  assert.ok(html.includes('const nieuwH=Math.max(basisH,laatsteBedragY+(compactDesktop?14:25));'),rel+": compacte SVG-onderreserve ontbreekt");
  assert.ok(!html.includes('const pb=g.pt+g.ih,y=pb+48,randFont='),rel+": oude vaste regenoffset is nog actief");
  assert.ok(html.includes('#chart g[data-q4-rain-periods]{transform:none!important}'),rel+": historische -6px transform wordt niet geneutraliseerd");
  assert.ok(html.includes('.chips{margin-top:12px!important}'),rel+": compacte mast/chipspacing ontbreekt");
  assert.ok(html.includes('.brief{margin-top:18px!important;padding-top:18px!important}'),rel+": compacte briefingovergang ontbreekt");
  assert.ok(html.includes('footer{font-size:13px!important;line-height:1.5!important;gap:4px 16px!important}'),rel+": footerleesbaarheid ontbreekt");
  assert.ok(html.includes('body > .seo-plaatsnav{margin-top:10px!important}'),rel+": dunnere zachte plaatsnavigatie-overgang ontbreekt");
  assert.strictEqual(tel(html,CAMS),1,rel+": bestaande CAMS-copy moet exact behouden blijven");
  gezien++;
}
assert.ok(gezien>0,"Geen finale weerartifact met live-screenshot-polish gevonden.");
const cache=verifieerServiceworkerCache(OUT,"live-screenshot-polish-20260912");
assert.ok(/^watishetweer-[0-9a-f]{12}$/.test(cache),"serviceworker-cache hoort bij het gewijzigde artifact");
console.log("Live-screenshot-polish artifactcontrole groen voor "+gezien+" weerartifacts; cache "+cache+".");
