"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  GUST_BRON,GUST_PRODUCTIE,HELPERS_PRODUCTIE,
  windstootBegin,windstootTekst,windstootDitUur,windstootDitUurTekst,pasWindGustCopyToe
}=require("./wind-gust-copy-owner.js");

/* Het forecast-tijdstip is het einde van het voorafgaande uurvak. */
assert.equal(windstootBegin("2026-08-27T00:00"),"2026-08-26T23:00");
assert.equal(windstootBegin("2026-08-26T18:00"),"2026-08-26T17:00");
assert.equal(windstootBegin("2026-01-01T00:00"),"2025-12-31T23:00");
assert.equal(windstootBegin("ongeldig"),null);

/* De tegel leest de max-gust van het eerstvolgende hourly eindpunt. Dat punt
   beschrijft volgens het providercontract het lopende klokuur. */
const uurdata={
  time:["2026-08-30T20:00","2026-08-30T21:00","2026-08-30T22:00"],
  wind_gusts_10m:[11,14.4,19.7]
};
assert.deepEqual(windstootDitUur(uurdata,0),{v:14.4,t:"2026-08-30T21:00"});
assert.deepEqual(windstootDitUur(uurdata,1),{v:19.7,t:"2026-08-30T22:00"});
assert.equal(windstootDitUur({time:["2026-08-30T20:00"],wind_gusts_10m:[11]},0),null);
assert.equal(windstootDitUur({time:["2026-08-30T20:00","2026-08-30T21:00"],wind_gusts_10m:[11,-1]},0),null);
assert.equal(windstootDitUurTekst({v:14.4,t:"2026-08-30T21:00"},"20:00–21:00"),"Verwachte hoogste windstoot tussen 20:00 en 21:00.");
assert.equal(windstootDitUurTekst(null,""),"Geen windstootverwachting voor dit uur.");

/* De historische dagpiekformatter blijft beschikbaar voor briefing- en
   architectuurregressies, maar is geen eigenaar meer van de hoofdtegel. */
assert.equal(
  windstootTekst({t:"2026-08-13T03:00",v:52},"2026-08-13T16:00","Vandaag","02:00–03:00"),
  "De hoogste windstoot werd vandaag tussen 02:00 en 03:00 verwacht: 52 km/u."
);
assert.equal(
  windstootTekst({t:"2026-08-13T19:00",v:44},"2026-08-13T16:00","Vandaag","18:00–19:00"),
  "De hoogste windstoot wordt vandaag tussen 18:00 en 19:00 verwacht: 44 km/u."
);
assert.equal(
  windstootTekst({t:"2026-08-27T00:00",v:48},"2026-08-26T04:07","Vandaag","23:00–00:00"),
  "De hoogste windstoot wordt vandaag tussen 23:00 en 00:00 verwacht: 48 km/u."
);
assert.equal(
  windstootTekst({t:"2026-08-27T00:00",v:57},"2026-08-26T21:08","Vandaag","23:00–00:00"),
  "De hoogste windstoot wordt vandaag tussen 23:00 en 00:00 verwacht: 57 km/u."
);
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
assert.equal(bron.split(GUST_BRON).length-1,1,"ontwikkeltemplate mist exact het oude windstootanker");
assert(!bron.includes("function weatherNowWindstootDitUur(hourly,index){"),"ontwikkeltemplate bevat de productiehelper al");

const uit=pasWindGustCopyToe(bron);
assert(!uit.includes(GUST_BRON),"oude gemengde windstoottegel bleef in de base-build staan");
assert.equal(uit.split(GUST_PRODUCTIE).length-1,1,"finale windstoottegel ontbreekt of is dubbel");
assert.equal(uit.split(HELPERS_PRODUCTIE).length-1,1,"finale windstoothelpers ontbreken of zijn dubbel");
assert(uit.includes("weatherNowWindstootDitUur(h,i)"),"tegel moet het lopende forecast-uur lezen");
assert(uit.includes('gustKop.textContent="Max. windstoot dit uur"'),"tegelkop maakt expliciet dat de waarde het uurmaximum is");
assert(uit.includes('weatherNowUurvak(gustUur.t)'),"subtekst gebruikt exact het uurvak van dezelfde forecastwaarde");
assert(uit.includes('Verwachte hoogste windstoot tussen '),"subtekst benoemt expliciet wat het getal betekent");
assert(!uit.includes('set("gust",windstoot===null?"–":Math.round(windstoot)+"<s>km/u</s>")'),"actuele 15-minutenwindstoot mag niet meer als uurforecast worden getoond");

/* De gewone windkaart blijft current-data; deze owner raakt alleen windstoten. */
for(const invariant of [
  "const windRuw=eindigGetal(c.wind_speed_10m);",
  'set("wind",Math.round(windsnelheid)+"<s>km/u</s>"'
]){
  assert(uit.includes(invariant),"gewone winddata-invariant is onbedoeld geraakt: "+invariant);
}

assert.throws(()=>pasWindGustCopyToe(uit),/staat al in het aangeleverde artifact/,
  "owner moet fail-fast zijn op een reeds gemigreerd artifact");

console.log("Windstootowner groen: uurmaximum en uurvak zijn expliciet, dagpiekhelper blijft forecastcorrect en gewone wind blijft current-data.");
