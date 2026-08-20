"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  dagNeerslagTekst,pasDailyForecastOwnerToe,
  DCOND_BRON,DCOND_PRODUCTIE,DRAIN_BRON,DRAIN_PRODUCTIE,
  KOP_BRON,KOP_PRODUCTIE,HELPER_PRODUCTIE
}=require("./daily-forecast-owner.js");

assert.equal(dagNeerslagTekst(null,0),"–");
assert.equal(dagNeerslagTekst(2,0),"Droog");
assert.equal(dagNeerslagTekst(9,0.05),"Droog");
assert.equal(dagNeerslagTekst(5,0.2),"5%");
assert.equal(dagNeerslagTekst(101,2),"100%");
assert.equal(dagNeerslagTekst(-3,2),"0%");

const bron=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
for(const [fragment,label] of [
  [DCOND_BRON,"oude weekomschrijving"],
  [DRAIN_BRON,"oude weekneerslagcel"],
  [KOP_BRON,"oude weekkoppen"]
])assert.equal(bron.split(fragment).length-1,1,"ontwikkeltemplate mist exact "+label);
assert(!bron.includes("function weatherNowDagNeerslagTekst(kans,som){"),"ontwikkeltemplate bevat de productiehelper al");

const uit=pasDailyForecastOwnerToe(bron);
for(const [fragment,label] of [
  [DCOND_PRODUCTIE,"finale weekomschrijving"],
  [DRAIN_PRODUCTIE,"finale weekneerslagcel"],
  [KOP_PRODUCTIE,"finale weekkoppen"],
  [HELPER_PRODUCTIE,"daily-forecast helper"]
])assert.equal(uit.split(fragment).length-1,1,label+" ontbreekt of is dubbel");
for(const fragment of [DCOND_BRON,DRAIN_BRON,KOP_BRON])assert(!uit.includes(fragment),"oude daily-presentatie bleef in base-build staan");

/* Daily data, temperatuur, wind, kans/hoeveelheid en daginteractie blijven van
   de bestaande renderer. Alleen de al zichtbare eindpresentatie verhuist. */
for(const invariant of [
  "day.temperature_2m_min[i]","day.temperature_2m_max[i]","day.weather_code&&day.weather_code[i]",
  "day.wind_speed_10m_max&&day.wind_speed_10m_max[i]","day.wind_direction_10m_dominant&&day.wind_direction_10m_dominant[i]",
  "day.precipitation_sum&&day.precipitation_sum[i]","day.precipitation_probability_max&&day.precipitation_probability_max[i]",
  "S.dag=i;","etmaal(st,24);dagen();","scrollIntoView({behavior:\"smooth\",block:\"center\"})"
])assert(uit.includes(invariant),"daily invariant is onbedoeld geraakt: "+invariant);

assert.throws(()=>pasDailyForecastOwnerToe(uit),/staat al in het aangeleverde artifact/,
  "owner moet fail-fast zijn op een reeds gemigreerd artifact");

console.log("Daily-forecast owner contract groen: finale zeven-dagenpresentatie zit in de base-build en daily data/interactie zijn ongewijzigd.");
