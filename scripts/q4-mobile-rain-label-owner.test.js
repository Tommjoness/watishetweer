"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  SPLIT_BRON,SPLIT_PRODUCTIE,HELPER_PRODUCTIE,RANDEN_PRODUCTIE,BEDRAGEN_PRODUCTIE,
  MOBIEL_LABEL_MIN_MM,MOBIEL_LABEL_MAX,q4MobieleGelabeldePerioden,pasQ4MobieleRegenlabelsToe
}=require("./q4-mobile-rain-label-owner.js");

assert.equal(MOBIEL_LABEL_MIN_MM,0.2,"mobiele permanente labels beginnen bij 0,2 mm");
assert.equal(MOBIEL_LABEL_MAX,3,"mobiel toont maximaal drie permanente regenperiodeteksten");

const perioden=[
  {van:0,tot:5,som:2.6},
  {van:8,tot:9,som:0.1},
  {van:11,tot:12,som:0.1},
  {van:13,tot:15,som:1.0}
];
assert.deepStrictEqual(
  q4MobieleGelabeldePerioden(perioden),
  [perioden[0],perioden[3]],
  "Kandy-achtig patroon houdt de betekenisvolle 2,6 en 1,0 mm-perioden en laat 0,1-labelruis weg"
);
const alleenMini=[{som:0.1},{som:0.1},{som:0.1}];
assert.equal(q4MobieleGelabeldePerioden(alleenMini).length,1,"als alles minimaal is blijft de sterkste periode toch gelabeld");
const vierBetekenisvol=[{som:0.2},{som:1.1},{som:0.7},{som:0.9}];
assert.deepStrictEqual(
  q4MobieleGelabeldePerioden(vierBetekenisvol),
  [vierBetekenisvol[1],vierBetekenisvol[2],vierBetekenisvol[3]],
  "meer dan drie betekenisvolle perioden worden op sterkte begrensd maar chronologisch teruggegeven"
);
assert.deepStrictEqual(q4MobieleGelabeldePerioden(null),[],"ontbrekende periodereeks is null-safe");

const bron=fs.readFileSync(path.join(__dirname,"q4-rain-runtime.js"),"utf8");
assert.equal(bron.split(SPLIT_BRON).length-1,1,"Q4-runtime mist exact één brede-periode splitanker");
assert(!bron.includes(SPLIT_PRODUCTIE),"Q4-runtime bevat de mobiele owner al vóór assemblage");
assert(!bron.includes(HELPER_PRODUCTIE),"Q4-runtime bevat de mobiele labelselectie al vóór assemblage");

const uit=pasQ4MobieleRegenlabelsToe(bron);
assert.equal(uit.split(SPLIT_PRODUCTIE).length-1,1,"mobiele compacte-rangeregel ontbreekt of is dubbel");
assert(!uit.includes(SPLIT_BRON),"oude mobiele/desktop gedeelde splitregel bleef actief");
assert.equal(uit.split(HELPER_PRODUCTIE).length-1,1,"mobiele betekenisselectie ontbreekt of is dubbel");
assert(uit.includes(RANDEN_PRODUCTIE),"tijdlabels gebruiken mobiel de gereduceerde labelset");
assert(uit.includes(BEDRAGEN_PRODUCTIE),"mm-labels gebruiken mobiel exact dezelfde gereduceerde labelset");
for(const invariant of [
  'const compactTekst=tekst.van+"–"+tekst.tot',
  'groep.setAttribute("data-q4-rain-periods","1")',
  'q4Mm(p.som)+" mm"',
  'q4PeriodeTijdvak(g,p)',
  'perioden.forEach(p=>{'
])assert(uit.includes(invariant),"regenperiode-invariant onbedoeld geraakt: "+invariant);

assert.throws(()=>pasQ4MobieleRegenlabelsToe(uit),/staat al in de runtime/,
  "owner moet fail-fast zijn bij dubbele assemblage");

console.log("Q4 mobiele regenlabels groen: alle brackets blijven staan; mobiel labelt maximaal drie betekenisvolle perioden en desktop blijft volledig.");
