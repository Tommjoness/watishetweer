"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {CONTRACTEN,pasPressureCopyToe}=require("./pressure-copy-owner.js");

const bron=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
assert.equal(CONTRACTEN.length,2,"luchtdrukcopy-owner moet exact twee zichtbare broncontracten bezitten");
for(const contract of CONTRACTEN){
  assert.equal(bron.split(contract.bron).length-1,1,"ontwikkeltemplate mist exact bronanker: "+contract.label);
}

const uit=pasPressureCopyToe(bron);
for(const contract of CONTRACTEN){
  assert(!uit.includes(contract.bron),"oude luchtdrukcopy bleef staan: "+contract.label);
  assert.equal(uit.split(contract.productie).length-1,1,"finale luchtdrukcopy ontbreekt of is dubbel: "+contract.label);
}

/* De twee overige branches van dezelfde renderer zijn niet onderdeel van deze
   migratie en moeten daarom letterlijk gelijk blijven. */
assert(uit.includes('"Geen tendens beschikbaar."'),"missing-state luchtdrukcopy is onbedoeld geraakt");
assert(uit.includes('"Vrijwel stabiel."'),"stabiele luchtdrukcopy is onbedoeld geraakt");
assert(uit.includes('weatherNowUurWaardeOp("pressure_msl"'),"bestaande drie-uursdrukbron is onbedoeld geraakt");
assert.throws(()=>pasPressureCopyToe(uit),/bronanker ontbreekt of is dubbel/,
  "owner moet fail-fast zijn op een reeds gemigreerd artifact");

console.log("Luchtdrukcopy-owner contract groen: alleen de twee finale trendzinnen zijn naar de base-build verplaatst.");
