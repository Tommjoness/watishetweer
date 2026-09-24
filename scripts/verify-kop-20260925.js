"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,STYLE_ID,OWNER_ID,CHIPS,STAMP,htmlBestanden}=require("./apply-kop-20260925.js");

const tel=(bron,zoek)=>String(bron).split(zoek).length-1;
let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(`id="${OWNER_ID}"`))continue;
  const rel=path.relative(OUT,p);
  assert.strictEqual(tel(html,`id="${STYLE_ID}"`),1,rel+": kopstylesheet niet exact eenmaal aanwezig");
  assert(html.indexOf(`id="${STYLE_ID}"`)>html.indexOf(`id="${OWNER_ID}"`),rel+": koplaag staat vóór de onderkantlaag");
  assert.strictEqual(tel(html,'id="chips"'),1,rel+": #chips niet exact eenmaal aanwezig");
  const stamp=html.indexOf(STAMP),chips=html.indexOf(CHIPS),mastright=html.lastIndexOf('<div class="mastright">',stamp),mastEinde=html.indexOf('<div id="state"');
  assert(mastright>=0&&stamp>mastright&&chips>stamp&&chips<mastEinde,rel+": #chips staat niet direct onder #stamp in de rechterkolom van de kop");
  gezien++;
}
assert(gezien>0,"geen weerartifacts gecontroleerd");
console.log(`Kop geverifieerd op ${gezien} weerartifacts: opgeslagen plaatsen en Delen onder de zoekbalk.`);
