"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {SPLIT_BRON,SPLIT_PRODUCTIE,pasQ4MobieleRegenlabelsToe}=require("./q4-mobile-rain-label-owner.js");

const bron=fs.readFileSync(path.join(__dirname,"q4-rain-runtime.js"),"utf8");
assert.equal(bron.split(SPLIT_BRON).length-1,1,"Q4-runtime mist exact één brede-periode splitanker");
assert(!bron.includes(SPLIT_PRODUCTIE),"Q4-runtime bevat de mobiele owner al vóór assemblage");

const uit=pasQ4MobieleRegenlabelsToe(bron);
assert.equal(uit.split(SPLIT_PRODUCTIE).length-1,1,"mobiele compacte-rangeregel ontbreekt of is dubbel");
assert(!uit.includes(SPLIT_BRON),"oude mobiele/desktop gedeelde splitregel bleef actief");
for(const invariant of [
  'const compactTekst=tekst.van+"–"+tekst.tot',
  'groep.setAttribute("data-q4-rain-periods","1")',
  'q4Mm(p.som)+" mm"',
  'q4PeriodeTijdvak(g,p)'
])assert(uit.includes(invariant),"regenperiode-invariant onbedoeld geraakt: "+invariant);

assert.throws(()=>pasQ4MobieleRegenlabelsToe(uit),/staat al in de runtime/,
  "owner moet fail-fast zijn bij dubbele assemblage");

console.log("Q4 mobiele regenlabels groen: mobiel gebruikt één compacte klokrange per periode; desktop splitgedrag blijft beschikbaar.");
