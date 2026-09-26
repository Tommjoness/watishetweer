"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,STYLE_ID,OWNER_ID,HUB_STYLE_ID,HUB_RUNTIME,htmlBestanden}=require("./apply-samenhang-20260926.js");

const tel=(bron,zoek)=>String(bron).split(zoek).length-1;
let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(`id="${OWNER_ID}"`))continue;
  const rel=path.relative(OUT,p);
  assert.strictEqual(tel(html,`id="${STYLE_ID}"`),1,rel+": samenhangstylesheet niet exact eenmaal aanwezig");
  assert(html.indexOf(`id="${STYLE_ID}"`)>html.indexOf(`id="${OWNER_ID}"`),rel+": samenhanglaag staat vóór de indelingslaag");
  gezien++;
}
assert(gezien>0,"geen weerartifacts gecontroleerd");
const hub=fs.readFileSync(path.join(OUT,"weer","index.html"),"utf8");
assert.strictEqual(tel(hub,`id="${HUB_STYLE_ID}"`),1,"plaatsindex: samenhangstylesheet niet exact eenmaal aanwezig");
assert(!hub.includes('class="wiw-theme-switch"'),"plaatsindex: oude aan/uit-schakelaar staat er nog");
for(const k of ["licht","auto","donker"])assert.strictEqual(tel(hub,`data-keuze="${k}"`),1,"plaatsindex: weergavekeuze "+k+" ontbreekt");
assert(hub.indexOf('class="terug-boven"')<hub.indexOf("<h1>Weer per plaats</h1>"),"plaatsindex: terug-link staat niet bovenaan");
assert(hub.includes('id="hub-zoek"')&&hub.includes('id="hub-leeg"'),"plaatsindex: zoekveld ontbreekt");
assert.strictEqual(fs.readFileSync(path.join(OUT,"theme-hub.js"),"utf8"),HUB_RUNTIME,"theme-hub.js is niet de samenhangruntime");
console.log(`Samenhang geverifieerd op ${gezien} weerartifacts en de plaatsindex.`);
