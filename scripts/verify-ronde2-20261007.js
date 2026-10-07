"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,STYLE_ID,htmlBestanden,heeftDonker}=require("./apply-ronde2-20261007.js");

const tel=(bron,zoek)=>String(bron).split(zoek).length-1;
let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!heeftDonker(html))continue;
  const rel=path.relative(OUT,p);
  assert.strictEqual(tel(html,`id="${STYLE_ID}"`),1,rel+": ronde-2-laag niet exact eenmaal aanwezig");
  /* De nieuwe donkere kleuren winnen alleen als de laag na iedere andere
     definitie van de donkere themavariabelen staat. */
  const laag=html.indexOf(`id="${STYLE_ID}"`);
  const re=/html\[data-thema="?donker"?\]\{--paper:/gi;let m,laatste=-1;
  const einde=html.indexOf("</style>",laag);
  while((m=re.exec(html))){
    if(m.index<laag)laatste=m.index;
    else if(m.index>einde)assert.fail(rel+": donkere themavariabelen na de ronde-2-laag");
  }
  assert(laatste>=0,rel+": geen eigen donker thema vóór de laag");
  gezien++;
}
assert(gezien>=170,"te weinig pagina's gecontroleerd: "+gezien);
console.log(`Ronde-2-laag geverifieerd op ${gezien} pagina's: donkere kleuren staan als laatste.`);
