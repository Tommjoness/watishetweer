"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {LOCATIES}=require("./seo-locations.config.js");
const {MARKER,NAV_MARKER}=require("./desktop-final-polish-20260831.js");

const OUT=path.join(__dirname,"..","public");
const doelen=[
  {pad:path.join(OUT,"index.html"),label:"homepage"},
  ...LOCATIES.map(loc=>({pad:path.join(OUT,"weer",loc.slug,"index.html"),label:loc.slug}))
];

for(const doel of doelen){
  assert(fs.existsSync(doel.pad),doel.label+": artifact ontbreekt");
  const html=fs.readFileSync(doel.pad,"utf8");
  assert.equal(html.split('id="'+MARKER+'"').length-1,1,doel.label+": desktop-polishmarker ontbreekt of is dubbel");
  assert.equal(html.split(NAV_MARKER).length-1,1,doel.label+": plaatsnavigatie ontbreekt of is dubbel");
  assert(html.includes("#nc{width:min(960px,100%);margin-right:auto}"),doel.label+": compacte neerslagbreedte ontbreekt");
  assert(html.includes("#days{max-width:1000px}"),doel.label+": compacte weekbreedte ontbreekt");
  assert(html.includes("grid-template-columns:92px 24px minmax(260px,1fr) 62px 46px 104px 44px 54px"),doel.label+": weekkolommen zijn niet compact vastgelegd");
  assert(html.includes("#nights{max-width:1000px}"),doel.label+": compacte Nachtzicht-breedte ontbreekt");
  assert(html.includes("grid-template-columns:88px 52px minmax(190px,1fr) 82px minmax(230px,260px)"),doel.label+": Nachtzicht-kolommen zijn niet compact vastgelegd");
  assert(html.includes(".seo-plaatsnav{\n    box-sizing:border-box;"),doel.label+": geïntegreerde plaatsnavigatie ontbreekt");
  assert(html.includes("margin:0 auto;"),doel.label+": plaatsnavigatie blijft los van het hoofdvlak");
  assert(html.includes("border-top:0;"),doel.label+": plaatsnavigatie sluit niet aan op het hoofdvlak");
  assert(html.includes("background:var(--sheet)"),doel.label+": plaatsnavigatie mist het hoofdvlak-oppervlak");
}

console.log("Desktop-final-polish geverifieerd op "+doelen.length+" weerpagina's.");
