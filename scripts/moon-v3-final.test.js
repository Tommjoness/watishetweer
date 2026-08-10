"use strict";
const assert=require("assert");
const m=require("./moon-v3-final.js");

const af=m.faseUitBeschrijving("afnemende sikkel, 6 procent verlicht");
const wa=m.faseUitBeschrijving("wassende sikkel, 6 procent verlicht");
assert(af>.75&&af<1);
assert(wa>0&&wa<.25);
assert(Math.abs((1-af)-wa)<.0001);
assert.equal(m.faseUitBeschrijving("nieuwe maan, 0 procent verlicht"),0);
assert.equal(m.faseUitBeschrijving("volle maan, 100 procent verlicht"),.5);

const dun=m.svgV3(af,14),vol=m.svgV3(.5,14),nieuw=m.svgV3(0,14);
assert(dun.includes("maan-fase-svg-v3"));
assert(dun.includes("maan-licht"));
assert(dun.includes("maan-schaduw-v3"));
assert.notEqual(dun,vol);
assert.notEqual(vol,nieuw);
assert(!/[🌑🌒🌓🌔🌕🌖🌗🌘]/u.test(dun));
console.log("Maanfase V3: regressies geslaagd.");
