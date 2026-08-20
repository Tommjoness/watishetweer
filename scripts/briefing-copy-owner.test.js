"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  briefingNachtzin,pasBriefingCopyToe,HELPER_PRODUCTIE,
  NACHTZIN_BRON,NACHTZIN_PRODUCTIE,VANDAAG_PIEK_BRON,VANDAAG_PIEK_PRODUCTIE,
  MORGEN_BRON,MORGEN_PRODUCTIE,VANDAAG_VERLEDEN_BRON,VANDAAG_VERLEDEN_PRODUCTIE,
  VANDAAG_MAX_BRON,VANDAAG_MAX_PRODUCTIE,NACHT_STANDALONE_BRON,NACHT_STANDALONE_PRODUCTIE
}=require("./briefing-copy-owner.js");

assert.equal(briefingNachtzin(null,"2026-08-20T02:00",18),"");
assert.equal(briefingNachtzin(16,"2026-08-20T23:30",19),"Vannacht koelt het af naar <b>16 graden</b>.");
assert.equal(briefingNachtzin(16,"2026-08-20T00:03",19),"Later vannacht koelt het af naar <b>16 graden</b>.");
assert.equal(briefingNachtzin(16,"2026-08-20T04:59",16),"De minimumtemperatuur vannacht ligt rond <b>16 graden</b>.");
assert.equal(briefingNachtzin(16,"2026-08-20T04:59",15.5),"De minimumtemperatuur vannacht ligt rond <b>16 graden</b>.");
assert.equal(briefingNachtzin(16,"2026-08-20T05:00",19),"Vannacht koelt het af naar <b>16 graden</b>.");

const bron=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
assert.equal(bron.split(NACHTZIN_BRON).length-1,1,"bron mist exact de nachtzin");
assert.equal(bron.split(VANDAAG_PIEK_BRON).length-1,2,"bron mist de twee vandaag-piekpaden");
assert.equal(bron.split(MORGEN_BRON).length-1,1,"bron mist morgenpad");
assert.equal(bron.split(VANDAAG_VERLEDEN_BRON).length-1,1,"bron mist verstreken-vandaagpad");
assert.equal(bron.split(VANDAAG_MAX_BRON).length-1,1,"bron mist vandaag-maxpad");
assert.equal(bron.split(NACHT_STANDALONE_BRON).length-1,1,"bron mist losse nachtzin");

const uit=pasBriefingCopyToe(bron);
assert.equal(uit.split(HELPER_PRODUCTIE).length-1,1,"briefinghelper ontbreekt of is dubbel");
assert.equal(uit.split(NACHTZIN_PRODUCTIE).length-1,1,"finale nachtzin-call ontbreekt of is dubbel");
assert.equal(uit.split(VANDAAG_PIEK_PRODUCTIE).length-1,2,"finale vandaag-piekcopy ontbreekt of is dubbel");
assert.equal(uit.split(MORGEN_PRODUCTIE).length-1,1,"finale morgencopy ontbreekt of is dubbel");
assert.equal(uit.split(VANDAAG_VERLEDEN_PRODUCTIE).length-1,1,"finale verstreken-vandaagcopy ontbreekt of is dubbel");
assert.equal(uit.split(VANDAAG_MAX_PRODUCTIE).length-1,1,"finale vandaag-maxcopy ontbreekt of is dubbel");
assert.equal(uit.split(NACHT_STANDALONE_PRODUCTIE).length-1,1,"finale losse nachtzin ontbreekt of is dubbel");

for(const oud of [NACHTZIN_BRON,VANDAAG_PIEK_BRON,MORGEN_BRON,VANDAAG_VERLEDEN_BRON,VANDAAG_MAX_BRON,NACHT_STANDALONE_BRON])
  assert(!uit.includes(oud),"oude briefingcopy bleef in base-build staan");

/* Analyse en inputs blijven bij de bestaande renderer. De owner mag geen
   neerslag-, temperatuur-, wind-, provider- of tijdzoneselectie verplaatsen. */
for(const invariant of [
  "const kt=kortetermijn();","const eind=Math.min(i+25,h.time.length);",
  "const volledigePiekVandaag=piekOpDag(vandaag,null);","day.temperature_2m_max&&day.temperature_2m_max[dagIndexVandaag]",
  "h.temperature_2m&&h.temperature_2m[k]","h.wind_speed_10m&&h.wind_speed_10m[k]","h.wind_gusts_10m&&h.wind_gusts_10m[k]",
  "const plaatsDelen=plaatsTijdDelen(),vandaag=plaatsVandaag();",
  "document.getElementById(\"brief\").innerHTML=nbsp(zin1+\"<!--brief-rest--> \"+zin2+\" \"+zin3);"
])assert(uit.includes(invariant),"briefing invariant is onbedoeld geraakt: "+invariant);

assert.throws(()=>pasBriefingCopyToe(uit),/staat al in het aangeleverde artifact/,
  "owner moet fail-fast zijn op een reeds gemigreerd artifact");

console.log("Briefingcopy-owner contract groen: bron-/tijdsemantiek zit in briefing() en forecast/wind/neerslaginputs zijn ongewijzigd.");