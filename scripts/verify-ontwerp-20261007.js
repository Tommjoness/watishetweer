"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,STYLE_ID,OWNER_ID,htmlBestanden}=require("./apply-ontwerp-20261007.js");

const tel=(bron,zoek)=>String(bron).split(zoek).length-1;
let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(`id="${OWNER_ID}"`))continue;
  const rel=path.relative(OUT,p);
  assert.strictEqual(tel(html,`id="${STYLE_ID}"`),1,rel+": ontwerpstylesheet niet exact eenmaal aanwezig");
  assert(html.indexOf(`id="${STYLE_ID}"`)>html.indexOf(`id="${OWNER_ID}"`),rel+": ontwerplaag staat vóór de desktoplaag");
  assert(html.includes("background:var(--temp-verloop,var(--ink))!important"),rel+": temperatuurverloop op de dagbalk ontbreekt");
  assert(html.includes("#nights .row.night:not(.kop) .sbar{"),rel+": zichtscorebalk geldt niet alleen voor nachtrijen");
  gezien++;
}
assert(gezien>0,"geen weerartifacts gecontroleerd");
console.log(`Ontwerplaag 7 oktober geverifieerd op ${gezien} weerartifacts.`);
