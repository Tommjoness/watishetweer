"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,STYLE_ID,OWNER_ID,htmlBestanden}=require("./apply-leesbaarheid-20260924.js");

const tel=(bron,zoek)=>String(bron).split(zoek).length-1;
let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(`id="${OWNER_ID}"`))continue;
  const rel=path.relative(OUT,p);
  assert.strictEqual(tel(html,`id="${STYLE_ID}"`),1,rel+": leesbaarheidsstylesheet niet exact eenmaal aanwezig");
  assert(html.indexOf(`id="${STYLE_ID}"`)>html.indexOf(`id="${OWNER_ID}"`),rel+": leesbaarheidslaag staat vóór de bedieningslaag");
  assert(html.includes('html[data-thema="donker"]{--accent-night:#2B4A74}'),rel+": nachtband blijft in donker onzichtbaar");
  gezien++;
}
assert(gezien>0,"geen weerartifacts gecontroleerd");
console.log(`Leesbaarheid geverifieerd op ${gezien} weerartifacts.`);
