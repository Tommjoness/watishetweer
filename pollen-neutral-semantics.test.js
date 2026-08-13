"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const s=require("./senior-semantiek-20260810.js");

assert.deepEqual(s.pollenPresentatieGetoond(true),{tekst:"Verwacht voor dit uur",kleur:"ink"});
assert.deepEqual(s.pollenPresentatieGetoond(false),{tekst:"Geen pollen verwacht voor dit uur",kleur:"ink45"});
assert.deepEqual(s.pollenPresentatieGetoond(null),{tekst:"onbekend",kleur:"ink45"});

const bron=fs.readFileSync(path.join(__dirname,"senior-semantiek-20260810.js"),"utf8");
const runtime=bron.slice(bron.indexOf("const basisLucht=lucht;"));
assert(runtime.includes("pollenPresentatieGetoond(true)"),"positieve pollenconcentratie gebruikt neutrale uursemantiek");
assert(runtime.includes("pollenPresentatieGetoond(false)"),"nulconcentratie gebruikt neutrale uursemantiek");
assert(!runtime.includes("pollenOordeelGetoond("),"productieruntime mag de legacy universele ernstschaal niet meer aanroepen");
assert(runtime.includes("Geen noemenswaardige concentraties"),"nulstatus wordt alleen gericht vanuit de bestaande basisweergave vervangen");

console.log("Pollen-semantiek: productie gebruikt concentratie zonder universele laag/matig/hoog-schaal.");
