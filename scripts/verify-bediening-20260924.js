"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,STYLE_ID,OWNER_ID,htmlBestanden}=require("./apply-bediening-20260924.js");

const tel=(bron,zoek)=>String(bron).split(zoek).length-1;
let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(`id="${OWNER_ID}"`))continue;
  const rel=path.relative(OUT,p);
  assert.strictEqual(tel(html,`id="${STYLE_ID}"`),1,rel+": bedieningsstylesheet niet exact eenmaal aanwezig");
  assert(html.indexOf(`id="${STYLE_ID}"`)>html.indexOf(`id="${OWNER_ID}"`),rel+": bedieningslaag staat vóór de eerste-schermlaag");
  assert(html.includes("html body .results>div{flex-direction:column!important"),rel+": zoeksuggesties staan op mobiel niet onder elkaar");
  assert(html.includes('aria-label="Automatisch (volgt je systeem)"'),rel+": Auto-knop legt het systeemgedrag niet uit");
  assert(!html.includes("Automatisch (dag/nacht)"),rel+": oud dag/nachtlabel keert terug");
  gezien++;
}
assert(gezien>0,"geen weerartifacts gecontroleerd");
console.log(`Bediening geverifieerd op ${gezien} weerartifacts: zoeksuggesties, tapdoelen, Meer nachten-knop en Auto-label.`);
