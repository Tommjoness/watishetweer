"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  GUST_BRON,GUST_PRODUCTIE,HELPERS_PRODUCTIE,
  windstootBegin,windstootTekst,pasWindGustCopyToe
}=require("./wind-gust-copy-owner.js");

/* Het forecast-tijdstip is het einde van het voorafgaande uurvak. */
assert.equal(windstootBegin("2026-08-27T00:00"),"2026-08-26T23:00");
assert.equal(windstootBegin("2026-08-26T18:00"),"2026-08-26T17:00");
assert.equal(windstootBegin("2026-01-01T00:00"),"2025-12-31T23:00");
assert.equal(windstootBegin("ongeldig"),null);

assert.equal(
  windstootTekst({t:"2026-08-13T03:00",v:52},"2026-08-13T16:00","Vandaag","02:00–03:00"),
  "De hoogste windstoot werd vandaag tussen 02:00 en 03:00 verwacht: 52 km/u."
);
assert.equal(
  windstootTekst({t:"2026-08-13T19:00",v:44},"2026-08-13T16:00","Vandaag","18:00–19:00"),
  "De hoogste windstoot wordt vandaag tussen 18:00 en 19:00 verwacht: 44 km/u."
);
/* Tokyo: lokale huidige tijd 04:07, venster 23:00–00:00 eindigt pas op de
   volgende lokale ISO-datum en blijft dus toekomstig, maar heet nog Vandaag. */
assert.equal(
  windstootTekst({t:"2026-08-27T00:00",v:48},"2026-08-26T04:07","Vandaag","23:00–00:00"),
  "De hoogste windstoot wordt vandaag tussen 23:00 en 00:00 verwacht: 48 km/u."
);
/* Kaapstad: hetzelfde datumgrenscontract bij 21:08 lokale tijd. */
assert.equal(
  windstootTekst({t:"2026-08-27T00:00",v:57},"2026-08-26T21:08","Vandaag","23:00–00:00"),
  "De hoogste windstoot wordt vandaag tussen 23:00 en 00:00 verwacht: 57 km/u."
);
/* Lopend venster: 21:00–22:00 is om 21:30 nog niet verleden. */
assert.equal(
  windstootTekst({t:"2026-08-26T22:00",v:41},"2026-08-26T21:30","Vandaag","21:00–22:00"),
  "De hoogste windstoot wordt vandaag tussen 21:00 en 22:00 verwacht: 41 km/u."
);
assert.equal(
  windstootTekst({t:"2026-08-26T21:00",v:37},"2026-08-26T21:08","Vandaag","20:00–21:00"),
  "De hoogste windstoot werd vandaag tussen 20:00 en 21:00 verwacht: 37 km/u."
);
assert.equal(
  windstootTekst({t:"2026-08-14T19:00",v:44},"2026-08-13T16:00","Morgen","18:00–19:00"),
  "De hoogste windstoot wordt morgen tussen 18:00 en 19:00 verwacht: 44 km/u."
);
assert.equal(
  windstootTekst({t:"2026-08-12T19:00",v:37},"2026-08-13T16:00","Gisteren","18:00–19:00"),
  "De hoogste windstoot werd gisteren tussen 18:00 en 19:00 verwacht: 37 km/u."
);
assert.equal(windstootTekst(null,"2026-08-13T16:00","", ""),"Geen uurgegevens beschikbaar.");
for(const tekst of [
  windstootTekst({t:"2026-08-13T03:00",v:52},"2026-08-13T16:00","Vandaag","02:00–03:00"),
  windstootTekst({t:"2026-08-13T19:00",v:44},"2026-08-13T16:00","Vandaag","18:00–19:00"),
  windstootTekst({t:"2026-08-27T00:00",v:48},"2026-08-26T04:07","Vandaag","23:00–00:00")
]){
  assert(!/\bbedroeg\b/i.test(tekst),"forecastcopy mag geen gemeten historische windstoot suggereren");
  assert(/verwacht/i.test(tekst),"forecastcopy moet de verwachtingsstatus expliciet behouden");
}

const bron=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
assert.equal(bron.split(GUST_BRON).length-1,1,"ontwikkeltemplate mist exact het oude windstootcopy-anker");
assert(!bron.includes("function weatherNowWindstootTekst(pg,nu,dag,vak){"),"ontwikkeltemplate bevat de productiehelper al");

const uit=pasWindGustCopyToe(bron);
assert(!uit.includes(GUST_BRON),"oude windstootcopy bleef in de base-build staan");
assert.equal(uit.split(GUST_PRODUCTIE).length-1,1,"finale windstootcopy-call ontbreekt of is dubbel");
assert.equal(uit.split(HELPERS_PRODUCTIE).length-1,1,"finale windstootcopy-helpers ontbreken of zijn dubbel");
assert(uit.includes("dagAanduiding(gustBegin||pg.t,true)"),"dagaanduiding moet bij intervalbegin horen");

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

console.log("Windstootcopy-owner contract groen: lokale intervaleinden, middernacht en lopende vensters blijven correct forecastcopy.");
