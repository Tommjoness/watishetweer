"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,htmlBestanden,gebundeldeWeerpagina}=require("./apply-kleur-20261012.js");
const {STYLE_ID,BALK_CLASS}=require("./apply-bovenbalk-20261118.js");
const VOET_STYLE_ID=require("./apply-voet.js").STYLE_ID;

/* Bovenbalk (18 november): op iedere gebundelde weerpagina staat de
   weergavekeuze precies één keer, in de balk boven de kop en buiten #app; de
   oude Weergave-regel onder de footer is weg; Nachtzicht heeft één anker en de
   voetlaag blijft de laatste stijllaag. */
let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!gebundeldeWeerpagina(html))continue;
  const rel=path.relative(OUT,p);
  const tel=s=>html.split(s).length-1;
  assert.equal(tel(`id="${STYLE_ID}"`),1,rel+": bovenbalklaag niet exact eenmaal aanwezig");
  assert.equal(tel(`<div class="${BALK_CLASS}">`),1,rel+": bovenbalk niet exact eenmaal aanwezig");
  assert.equal(tel('id="thema"'),1,rel+": #thema niet exact eenmaal aanwezig");
  assert.equal(tel('class="wiw-weergave-voet"'),0,rel+": oude Weergave-regel onder de footer staat er nog");
  assert.equal(tel('id="nachtzicht"'),1,rel+": anker #nachtzicht niet exact eenmaal aanwezig");
  assert(html.includes('<div class="chartkop nachtkop" id="nachtzicht">'),rel+": anker staat niet op de kop van Nachtzicht");
  const balk=html.indexOf(`<div class="${BALK_CLASS}">`),thema=html.indexOf('id="thema"'),mast=html.indexOf('<div class="mast" role="banner">'),app=html.indexOf('<main id="app"'),sheet=html.indexOf('<div class="sheet"');
  assert(sheet>=0&&sheet<balk&&balk<thema&&thema<mast&&mast<app,rel+": volgorde sheet > bovenbalk > #thema > kop > #app klopt niet");
  assert(html.slice(balk,mast).includes('<a class="wiw-snel-nachtzicht" href="#nachtzicht">'),rel+": Nachtzicht-link ontbreekt in de bovenbalk");
  const kop=html.slice(0,html.indexOf("</head>"));
  const stijlen=[...kop.matchAll(/<style([^>]*)>/g)].map(m=>m[1]);
  assert(stijlen.pop().includes(`id="${VOET_STYLE_ID}"`),rel+": voetlaag is niet meer de laatste stijllaag");
  assert(stijlen.pop().includes(`id="${STYLE_ID}"`),rel+": bovenbalklaag staat niet direct vóór de voetlaag");
  gezien++;
}
assert(gezien>=100,"te weinig weerpagina's met de bovenbalk: "+gezien);
console.log(`Bovenbalk geverifieerd op ${gezien} weerpagina's: weergavekeuze en Nachtzicht boven de kop, buiten #app; geen Weergave-regel meer onder de footer.`);
