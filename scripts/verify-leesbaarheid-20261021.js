"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,htmlBestanden,gebundeldeWeerpagina}=require("./apply-kleur-20261012.js");
const {STYLE_ID}=require("./apply-leesbaarheid-20261021.js");
const KLEUR_ID=require("./apply-kleur-20261012.js").STYLE_ID;

/* De leesbaarheidslaag staat precies één keer in iedere gebundelde weerpagina, na de kleurlaag en
   vóór de voetlaag (die daarna als laatste stijllaag volgt, zie verify-voet.js), en geen enkele regel
   zet betekenisdragende tekst onder 12px. */
let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!gebundeldeWeerpagina(html))continue;
  const rel=path.relative(OUT,p);
  assert.equal(html.split(`id="${STYLE_ID}"`).length-1,1,rel+": leesbaarheidslaag niet exact eenmaal aanwezig");
  assert(html.indexOf(`id="${STYLE_ID}"`)>html.indexOf(`id="${KLEUR_ID}"`),rel+": leesbaarheidslaag staat niet na de kleurlaag");
  assert(!html.includes('id="wiw-voet"'),rel+": voetlaag staat al in de pagina; de leesbaarheidslaag hoort er vóór");
  const blok=html.slice(html.indexOf(`id="${STYLE_ID}"`),html.indexOf("</style>",html.indexOf(`id="${STYLE_ID}"`)));
  const maten=[...blok.matchAll(/font-size:([\d.]+)px/g)].map(m=>Number(m[1]));
  assert(maten.length>=8&&maten.every(m=>m>=12),rel+": leesbaarheidslaag bevat een maat onder 12px ("+maten.join(",")+")");
  /* Typografie-ronde 29 oktober 2026: de rolmaten staan als tokens (--wiw-t-*), per schermklasse één keer; ook die zijn betekenisdragend. */
  const tokens=[...blok.matchAll(/--wiw-t-[a-z]+:([\d.]+)px/g)].map(m=>Number(m[1]));
  assert(tokens.length>=30&&tokens.every(m=>m>=12),rel+": rolmaten (--wiw-t-*) ontbreken of staan onder 12px ("+tokens.join(",")+")");
  assert(!/--wiw-t-kop:(?!18px|20px)/.test(blok),rel+": sectiekop heeft een onverwachte maat");
  gezien++;
}
assert(gezien>=100,"te weinig weerpagina's met de leesbaarheidslaag: "+gezien);
console.log(`Leesbaarheidslaag geverifieerd op ${gezien} weerpagina's: één keer, na de kleurlaag en vóór de voetlaag, geen maat onder 12px en alle rolmaten (--wiw-t-*) minstens 12px.`);
