"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  GUST_BRON,GUST_PRODUCTIE,HELPER_PRODUCTIE,
  windstootTekst,pasWindGustCopyToe
}=require("./wind-gust-copy-owner.js");

assert.equal(
  windstootTekst({t:"2026-08-13T02:00",v:52},"2026-08-13T16:00","Vandaag","02:00–03:00"),
  "Voor vandaag lag de hoogste verwachte windstoot rond 02:00–03:00 op 52 km/u."
);
assert.equal(
  windstootTekst({t:"2026-08-13T18:00",v:44},"2026-08-13T16:00","Vandaag","18:00–19:00"),
  "Later vandaag worden rond 18:00–19:00 windstoten tot 44 km/u verwacht."
);
assert.equal(
  windstootTekst({t:"2026-08-14T18:00",v:44},"2026-08-13T16:00","Morgen","18:00–19:00"),
  "Morgen worden rond 18:00–19:00 windstoten tot 44 km/u verwacht."
);
assert.equal(
  windstootTekst({t:"2026-08-12T18:00",v:37},"2026-08-13T16:00","Gisteren","18:00–19:00"),
  "Voor gisteren lag de hoogste verwachte windstoot rond 18:00–19:00 op 37 km/u."
);
assert.equal(windstootTekst(null,"2026-08-13T16:00","", ""),"Geen uurgegevens beschikbaar.");

const bron=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
assert.equal(bron.split(GUST_BRON).length-1,1,"ontwikkeltemplate mist exact het oude windstootcopy-anker");
assert(!bron.includes("function weatherNowWindstootTekst(pg,nu,dag,vak){"),"ontwikkeltemplate bevat de productiehelper al");

const uit=pasWindGustCopyToe(bron);
assert(!uit.includes(GUST_BRON),"oude windstootcopy bleef in de base-build staan");
assert.equal(uit.split(GUST_PRODUCTIE).length-1,1,"finale windstootcopy-call ontbreekt of is dubbel");
assert.equal(uit.split(HELPER_PRODUCTIE).length-1,1,"finale windstootcopy-helper ontbreekt of is dubbel");

/* Data-eigenaarschap blijft bij meters(): actuele windstoot, piekbron en de
   bestaande niet-negatieve filtering mogen door deze migratie niet veranderen. */
for(const invariant of [
  "const windstootRuw=eindigGetal(c.wind_gusts_10m);",
  "const windstoot=windstootRuw!==null&&windstootRuw>=0?windstootRuw:null;",
  'const pgRuw=piek("wind_gusts_10m"),pg=pgRuw&&pgRuw.v>=0?pgRuw:null;',
  'set("gust",windstoot===null?"–":Math.round(windstoot)+"<s>km/u</s>");'
]){
  assert(uit.includes(invariant),"windstootdata-invariant is onbedoeld geraakt: "+invariant);
}

assert.throws(()=>pasWindGustCopyToe(uit),/staat al in het aangeleverde artifact/,
  "owner moet fail-fast zijn op een reeds gemigreerd artifact");

console.log("Windstootcopy-owner contract groen: alleen de finale gustsub-presentatie is naar de base-build verplaatst.");
