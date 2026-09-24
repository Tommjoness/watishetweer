"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,STYLE_ID,OWNER_ID,htmlBestanden}=require("./apply-onderkant-20260925.js");

const tel=(bron,zoek)=>String(bron).split(zoek).length-1;
let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(`id="${OWNER_ID}"`))continue;
  const rel=path.relative(OUT,p);
  assert.strictEqual(tel(html,`id="${STYLE_ID}"`),1,rel+": onderkantstylesheet niet exact eenmaal aanwezig");
  assert(html.indexOf(`id="${STYLE_ID}"`)>html.indexOf(`id="${OWNER_ID}"`),rel+": onderkantlaag staat vóór de leesbaarheidslaag");
  assert(html.includes("html body footer:not(#wiw-onderkant)>span.bron.bron-bronnen{display:flex!important"),rel+": bronnen staan niet als doorlopende regel");
  assert(html.includes("html body .seo-route-context h2{font-family:var(--sans)!important;font-size:11px!important"),rel+": SEO-kop is geen sectielabel");
  gezien++;
}
assert(gezien>0,"geen weerartifacts gecontroleerd");
console.log(`Onderkant geverifieerd op ${gezien} weerartifacts: compacte voet, gebruikte bronnen, SEO-blok in de paginakolom.`);
