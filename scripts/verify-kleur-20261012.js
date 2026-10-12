"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,STYLE_ID,htmlBestanden}=require("./apply-kleur-20261012.js");

/* Draait na platform-output-cleanup: de runtime zit dan in de gedeelde
   app-bundle, de CSS in de pagina. */
const tel=(bron,zoek)=>String(bron).split(zoek).length-1;
let gezien=0;
const bundels=new Set();
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(`id="${STYLE_ID}"`))continue;
  const rel=path.relative(OUT,p);
  assert.strictEqual(tel(html,`id="${STYLE_ID}"`),1,rel+": kleurlaag niet exact eenmaal aanwezig");
  for(const regel of ["svg stop[data-temp-stop]",".stats .wiw-meter","svg.ico .ico-zon",".hero[data-lucht]","--temp-verloop-donker"])
    assert(html.includes(regel),rel+": kleurregel ontbreekt: "+regel);
  const m=html.match(/<script src="\/(app-[0-9a-f]{12}\.min\.js)"/);
  assert(m,rel+": app-bundle ontbreekt");
  bundels.add(m[1]);
  gezien++;
}
assert(gezien>=100,"te weinig weerpagina's met de kleurlaag: "+gezien);
for(const b of bundels){
  const js=fs.readFileSync(path.join(OUT,b),"utf8");
  for(const nodig of ["WeatherNowKleur20261012","TEMP_SCHAAL","data-temp-stop","ico-zon","data-weer"])
    assert(js.includes(nodig),b+": kleurruntime mist "+nodig);
}
console.log(`Kleurlaag geverifieerd op ${gezien} weerpagina's en ${bundels.size} app-bundle(s).`);
