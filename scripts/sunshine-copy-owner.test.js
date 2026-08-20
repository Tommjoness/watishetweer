"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  ZONUREN_BRON,ZONUREN_PRODUCTIE,HELPER_PRODUCTIE,
  zonurenWoord,pasSunshineCopyToe
}=require("./sunshine-copy-owner.js");

assert.equal(zonurenWoord(13.8,14.83),"Naar verwachting bijna de hele dag zon.");
assert.equal(zonurenWoord(8,14),"Naar verwachting meerdere uren zon vandaag.");
assert.equal(zonurenWoord(2,14),"Naar verwachting weinig zon vandaag.");
assert.equal(zonurenWoord(8,null),"Naar verwachting veel zon vandaag.");
assert.equal(zonurenWoord(null,14),"Zonuren niet beschikbaar.");

const bron=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
assert.equal(bron.split(ZONUREN_BRON).length-1,1,"ontwikkeltemplate mist exact de oude zonurentegel");
assert(!bron.includes("function weatherNowZonurenWoord(uur,daglichtUur){"),"ontwikkeltemplate bevat de productiehelper al");

const uit=pasSunshineCopyToe(bron);
assert(!uit.includes(ZONUREN_BRON),"oude zonurentegel bleef in de base-build staan");
assert.equal(uit.split(ZONUREN_PRODUCTIE).length-1,1,"finale zonurentegel ontbreekt of is dubbel");
assert.equal(uit.split(HELPER_PRODUCTIE).length-1,1,"finale zonurencopy-helper ontbreekt of is dubbel");

/* Databronnen en dagselectie blijven expliciet dezelfde. Deze migratie mag
   alleen ownership/presentatie veranderen en geen nieuw weer- of zonmodel
   introduceren. */
for(const invariant of [
  "day.time.indexOf(plaatsVandaag())",
  "day.sunshine_duration",
  "day.sunrise",
  "day.sunset",
  "mins(ss)-mins(sr)",
  "const uur=sec/3600;",
  '<div class="ssub">Zonuren niet beschikbaar</div>'
]){
  assert(uit.includes(invariant),"zonuren-invariant is onbedoeld geraakt: "+invariant);
}
assert(!uit.includes("Weinig zon vandaag"),"oude grove zonurencopy staat nog in base-artifact");
assert(!uit.includes("Een aantal zonuren vandaag"),"oude grove zonurencopy staat nog in base-artifact");
assert(!uit.includes("Vandaag redelijk wat zon"),"oude grove zonurencopy staat nog in base-artifact");

assert.throws(()=>pasSunshineCopyToe(uit),/staat al in het aangeleverde artifact/,
  "owner moet fail-fast zijn op een reeds gemigreerd artifact");

console.log("Zonurencopy-owner contract groen: finale daglichtbewuste presentatie zit in de base-build, databronnen zijn ongewijzigd.");
