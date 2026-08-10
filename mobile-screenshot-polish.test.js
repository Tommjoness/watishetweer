"use strict";

const assert=require("assert");
const p=require("./mobile-screenshot-polish.js");

const afnemend=p.maanFaseUitBeschrijving("afnemende sikkel, 7 procent verlicht");
const wassend=p.maanFaseUitBeschrijving("wassende sikkel, 7 procent verlicht");
assert(afnemend>0.75&&afnemend<1,"afnemende sikkel ligt aan het einde van de cyclus");
assert(wassend>0&&wassend<0.25,"wassende sikkel ligt aan het begin van de cyclus");
assert(Math.abs((1-afnemend)-wassend)<0.0001,"wassend en afnemend blijven elkaars spiegelbeeld");
assert.equal(p.maanFaseUitBeschrijving("nieuwe maan, 0 procent verlicht"),0);
assert.equal(p.maanFaseUitBeschrijving("volle maan, 100 procent verlicht"),0.5);
assert.equal(p.maanFaseUitBeschrijving("geen fase"),null);

const nieuw=p.maanFaseSvgV2(0,14);
const vol=p.maanFaseSvgV2(0.5,14);
const eerste=p.maanFaseSvgV2(0.25,14);
const laatste=p.maanFaseSvgV2(0.75,14);
assert(nieuw.includes("maan-schaduw-vol"),"nieuwe maan is een donkere schijf, geen leeg rondje");
assert(!vol.includes("maan-schaduw-vol"),"volle maan is niet dezelfde donkere schijf als nieuwe maan");
assert.notEqual(nieuw,vol,"nieuwe en volle maan zijn visueel verschillend");
assert.notEqual(eerste,laatste,"eerste en laatste kwartier staan aan een andere zijde");
for(const svg of [nieuw,vol,eerste,laatste]){
  assert(svg.includes("maan-fase-svg-v2"));
  assert(!/[🌑🌒🌓🌔🌕🌖🌗🌘]/u.test(svg));
}

console.log("Mobiele screenshot-polish: maanfase-regressies geslaagd.");
