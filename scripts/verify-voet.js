"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,htmlBestanden,gebundeldeWeerpagina}=require("./apply-kleur-20261012.js");
const {STYLE_ID}=require("./apply-voet.js");

/* De voetlaag staat precies één keer in iedere gebundelde weerpagina, als laatste
   stijlblok vóór </head>, met de inhoud van voet.css. */
let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!gebundeldeWeerpagina(html))continue;
  const rel=path.relative(OUT,p);
  assert.equal(html.split(`id="${STYLE_ID}"`).length-1,1,rel+": voetlaag niet exact eenmaal aanwezig");
  const kop=html.slice(0,html.indexOf("</head>"));
  const laatste=[...kop.matchAll(/<style([^>]*)>/g)].pop();
  assert(laatste&&laatste[1].includes(`id="${STYLE_ID}"`),rel+": voetlaag is niet de laatste stijllaag");
  assert(html.includes("span.bron.seizoen-link.voet-later{display:none!important}"),rel+": mobiele regel voor verre seizoenslinks ontbreekt");
  gezien++;
}
assert(gezien>=100,"te weinig weerpagina's met de voetlaag: "+gezien);
console.log(`Voetlaag geverifieerd op ${gezien} weerpagina's: één keer, als laatste stijllaag.`);
