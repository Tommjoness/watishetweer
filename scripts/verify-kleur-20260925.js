"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,STYLE_ID,OWNER_ID,htmlBestanden}=require("./apply-kleur-20260925.js");

const tel=(bron,zoek)=>String(bron).split(zoek).length-1;
let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(`id="${OWNER_ID}"`))continue;
  const rel=path.relative(OUT,p);
  assert.strictEqual(tel(html,`id="${STYLE_ID}"`),1,rel+": kleurstylesheet niet exact eenmaal aanwezig");
  assert(html.indexOf(`id="${STYLE_ID}"`)>html.indexOf(`id="${OWNER_ID}"`),rel+": kleurlaag staat vóór de typografielaag");
  assert(!/data-thema="?rood"?\]\{/.test(html),rel+": CSS van het verwijderde rode thema staat nog in het artifact");
  gezien++;
}
assert(gezien>0,"geen weerartifacts gecontroleerd");
console.log(`Kleur geverifieerd op ${gezien} weerartifacts: karmijn alleen voor nu en let op, geen rode-thema-CSS.`);
