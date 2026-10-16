"use strict";

/* Verslag 16 okt, onderdeel 7: "Maan blijft onder de horizon" om 23:43 hoort bij de
   resterende nacht, niet bij de hele avond. De lopende nacht zegt nu welk venster
   bedoeld is; andere nachten behouden hun bestaande zin. */

const assert=require("assert"),fs=require("fs"),path=require("path");
const p=require("./mobile-screenshot-polish.js");
const {maakVertaler}=require("../taal/vertaalkern.js");
const en=maakVertaler(require("../taal/en.js"));

assert.equal(p.formatteerMaanTekst("maan blijft de rest van de nacht onder de horizon"),"De rest van de nacht blijft de maan onder de horizon.");
assert.equal(p.formatteerMaanTekst("maan blijft de rest van de nacht boven de horizon"),"De rest van de nacht blijft de maan boven de horizon.");
assert.equal(p.formatteerMaanTekst("maan blijft onder de horizon"),"Maan blijft onder de horizon.","andere nachten houden hun zin");
assert.equal(p.formatteerMaanTekst("maan blijft boven de horizon"),"Maan blijft boven de horizon.");

assert.equal(en.vertaal("De rest van de nacht blijft de maan onder de horizon."),"The moon stays below the horizon for the rest of the night.");
assert.equal(en.vertaal("De rest van de nacht blijft de maan boven de horizon."),"The moon stays above the horizon for the rest of the night.");
assert.equal(en.vertaal("de rest van de nacht onder de horizon"),"below the horizon for the rest of the night");
assert.equal(en.vertaal("de rest van de nacht boven de horizon"),"above the horizon for the rest of the night");

const lees=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
assert(/Number\.isFinite\(vanafMs\)\?"de rest van de nacht "/.test(lees("senior-correctness-v2.js")),"app: de lopende nacht (vanaf nu) zegt 'de rest van de nacht'");
assert(/rest: Number\.isFinite\(vanafMs\)/.test(lees("scripts/nachtzicht-kern.js")),"pagina-kern geeft door of het de rest van de nacht is");
assert(/m\.rest \? "de rest van de nacht " : "de hele nacht "/.test(lees("scripts/nachtzicht-runtime.js")),"pagina toont 'de rest van de nacht' voor de lopende nacht");

console.log("Maan rest van de nacht groen: lopende nacht noemt het venster in app en pagina's, andere nachten ongewijzigd, Engels klopt.");
