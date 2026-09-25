"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,STYLE_ID,OWNER_ID,htmlBestanden}=require("./apply-indeling-20260925.js");

const tel=(bron,zoek)=>String(bron).split(zoek).length-1;
let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(`id="${OWNER_ID}"`))continue;
  const rel=path.relative(OUT,p);
  assert.strictEqual(tel(html,`id="${STYLE_ID}"`),1,rel+": indelingsstylesheet niet exact eenmaal aanwezig");
  assert(html.indexOf(`id="${STYLE_ID}"`)>html.indexOf(`id="${OWNER_ID}"`),rel+": indelingslaag staat vóór de kleurlaag");
  gezien++;
}
assert(gezien>0,"geen weerartifacts gecontroleerd");
console.log(`Indeling geverifieerd op ${gezien} weerartifacts.`);
