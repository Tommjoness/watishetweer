"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,STYLE_ID,OWNER_ID,htmlBestanden}=require("./apply-nachtzicht-20260925.js");

const tel=(bron,zoek)=>String(bron).split(zoek).length-1;
let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(`id="${OWNER_ID}"`))continue;
  const rel=path.relative(OUT,p);
  assert.strictEqual(tel(html,`id="${STYLE_ID}"`),1,rel+": nachtzichtstylesheet niet exact eenmaal aanwezig");
  assert(html.indexOf(`id="${STYLE_ID}"`)>html.indexOf(`id="${OWNER_ID}"`),rel+": nachtzichtlaag staat vóór de koplaag");
  assert(html.includes("#nights .row.night:not(.kop):not([hidden]):not(#wiw-nacht){display:grid!important"),rel+": verborgen extra nachten zijn niet uitgesloten van de compacte rij");
  gezien++;
}
assert(gezien>0,"geen weerartifacts gecontroleerd");
console.log(`Nachtzicht geverifieerd op ${gezien} weerartifacts: twee regels per nacht op mobiel.`);
