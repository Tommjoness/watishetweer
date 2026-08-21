"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  dagNeerslagTekst,pasDailyForecastOwnerToe,
  DCOND_BRON,DCOND_PRODUCTIE,DRAIN_BRON,DRAIN_PRODUCTIE,
  KOP_BRON,KOP_PRODUCTIE,HELPER_PRODUCTIE,
  KOP_CSS_BRON,KOP_CSS_PRODUCTIE
}=require("./daily-forecast-owner.js");

assert.equal(dagNeerslagTekst(null,0),"–");
assert.equal(dagNeerslagTekst(2,0),"Droog");
assert.equal(dagNeerslagTekst(9,0.05),"Droog");
assert.equal(dagNeerslagTekst(5,0.2),"5%");
assert.equal(dagNeerslagTekst(101,2),"100%");
assert.equal(dagNeerslagTekst(-3,2),"0%");

/* Deze migratie mag inhoudelijk exact één bestaande CSS-declaratie verplaatsen:
   dezelfde selector en dezelfde waarde. Zo kan een latere refactor niet stil
   extra weeklayout aan deze architectuurslice koppelen. */
assert.equal(
  KOP_CSS_PRODUCTIE,
  KOP_CSS_BRON+'  .row.day.kop .bar{text-align:center}\n',
  "daily owner mag naast de bestaande CSS-haak alleen de ongewijzigde Bereik-centrering toevoegen"
);

const bron=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
for(const [fragment,label] of [
  [DCOND_BRON,"oude weekomschrijving"],
  [DRAIN_BRON,"oude weekneerslagcel"],
  [KOP_BRON,"oude weekkoppen"],
  [KOP_CSS_BRON,"bestaande weekkop-CSShaak"]
])assert.equal(bron.split(fragment).length-1,1,"ontwikkeltemplate mist exact "+label);
assert(!bron.includes("function weatherNowDagNeerslagTekst(kans,som){"),"ontwikkeltemplate bevat de productiehelper al");
assert(!bron.includes('.row.day.kop .bar{text-align:center}'),"ontwikkeltemplate bevat de late Bereik-uitlijning al");

const uit=pasDailyForecastOwnerToe(bron);
for(const [fragment,label] of [
  [DCOND_PRODUCTIE,"finale weekomschrijving"],
  [DRAIN_PRODUCTIE,"finale weekneerslagcel"],
  [KOP_PRODUCTIE,"finale weekkoppen"],
  [HELPER_PRODUCTIE,"daily-forecast helper"],
  [KOP_CSS_PRODUCTIE,"daily-forecast weekkop-CSS"]
])assert.equal(uit.split(fragment).length-1,1,label+" ontbreekt of is dubbel");
assert.equal(uit.split('.row.day.kop .bar{text-align:center}').length-1,1,"Bereik-kop moet exact één keer gecentreerd worden door de daily owner");
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

console.log("Daily-forecast owner contract groen: zeven-dagencopy en Bereik-uitlijning zitten in de base-build; daily data/interactie zijn ongewijzigd.");