"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,STYLE_ID,OWNER_ID,VOET_CLASS,htmlBestanden}=require("./apply-first-screen-20260924.js");

const tel=(bron,zoek)=>String(bron).split(zoek).length-1;
let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(`id="${OWNER_ID}"`))continue;
  const rel=path.relative(OUT,p);
  assert.strictEqual(tel(html,`id="${STYLE_ID}"`),1,rel+": eerste-schermstylesheet niet exact eenmaal aanwezig");
  assert.strictEqual(tel(html,'id="thema"'),1,rel+": thema-keuze niet exact eenmaal aanwezig");
  const tools=html.indexOf('<div class="tools">'),res=html.indexOf('<div class="results" id="res"'),thema=html.indexOf('id="thema"');
  assert(!(thema>tools&&thema<res),rel+": thema-keuze staat nog in de zoekbalk");
  const mainEinde=html.indexOf("</main>"),voet=html.indexOf(`<div class="${VOET_CLASS}">`);
  assert(voet>mainEinde&&thema>voet&&!/\S/.test(html.slice(mainEinde+7,voet)),rel+": thema-keuze staat niet direct na #app (onder de footer)");
  assert(html.includes("html body .tools>#here::before"),rel+": mobiele icoonknoppen ontbreken");
  assert(html.includes("html body #wiw-hour-title{position:absolute!important"),rel+": dubbele desktopkop Komende uren is niet visueel verborgen");
  assert(!html.includes('"Neerslagverwachting komend uur"'),rel+": te lang tegellabel keert terug");
  gezien++;
}
assert(gezien>0,"geen weerartifacts gecontroleerd");
console.log(`Eerste scherm geverifieerd op ${gezien} weerartifacts: thema-keuze onder de footer, icoonknoppen, compacte desktoptegels.`);
