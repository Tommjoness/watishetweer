"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  DAG_SPOOR_MM,DAG_KLEINER_DAN_005_MM,
  dagNeerslagTekst,dagNeerslagMmTekst,dagNaam,pasDailyForecastOwnerToe,
  DCOND_BRON,DCOND_PRODUCTIE,DRAIN_BRON,DRAIN_PRODUCTIE,
  DAGNAAM_BRON,DAGNAAM_PRODUCTIE,KOP_BRON,KOP_PRODUCTIE,HELPER_PRODUCTIE,
  KOP_CSS_BRON,KOP_CSS_PRODUCTIE
}=require("./daily-forecast-owner.js");

assert.equal(DAG_SPOOR_MM,0.005,"dagpresentatie gebruikt dezelfde spoorgrens als de centrale interpretatie-engine");
assert.equal(DAG_KLEINER_DAN_005_MM,0.05,"<0,05 wordt alleen onder de echte 0,05-mm grens gebruikt");
assert.equal(dagNeerslagTekst(null,0),"–");
assert.equal(dagNeerslagTekst(2,0),"2%");
assert.equal(dagNeerslagTekst(6,0),"6%","een kleine echte kans blijft zichtbaar naast 0,0 mm");
assert.equal(dagNeerslagTekst(9,0.05),"9%");
assert.equal(dagNeerslagTekst(5,0.2),"5%");
assert.equal(dagNeerslagTekst(101,2),"100%");
assert.equal(dagNeerslagTekst(-3,2),"0%");
assert.equal(dagNeerslagMmTekst(null),"");
assert.equal(dagNeerslagMmTekst(undefined),"");
assert.equal(dagNeerslagMmTekst(-1),"");
assert.equal(dagNeerslagMmTekst(0),"0,0 mm","een werkelijk nulpunt blijft exact nul, niet <0,05");
assert.equal(dagNeerslagMmTekst(0.001),"spoor","amper meetbare hoeveelheid krijgt geen schijnprecisie");
assert.equal(dagNeerslagMmTekst(0.005),"spoor","de centrale spoorgrens blijft spoor");
assert.equal(dagNeerslagMmTekst(0.006),"<0,05 mm","boven de spoorgrens maar onder 0,05 is <0,05 correct");
assert.equal(dagNeerslagMmTekst(0.04),"<0,05 mm");
assert.equal(dagNeerslagMmTekst(0.049),"<0,05 mm");
assert.equal(dagNeerslagMmTekst(0.05),"<0,1 mm","0,05 mag niet als <0,05 worden gepresenteerd");
assert.equal(dagNeerslagMmTekst(0.09),"<0,1 mm");
assert.equal(dagNeerslagMmTekst(0.1),"0,1 mm");
assert.equal(dagNeerslagMmTekst(0.2),"0,2 mm");
assert.equal(dagNeerslagMmTekst(8.14),"8,1 mm");
assert.equal(dagNeerslagMmTekst(0.02,0.03),"spoor","formatter kan een expliciete centrale spoorgrens volgen");

assert.equal(dagNaam("2026-08-26",false,"2026-08-26"),"Vandaag");
assert.equal(dagNaam("2026-08-26",true,"2026-08-26"),"Vandaag 26");
assert.equal(dagNaam("2026-08-27",false,"2026-08-26"),"do 27");
assert.equal(dagNaam("2026-08-31",true,"2026-08-26"),"maandag 31");
assert.equal(dagNaam("2026-09-01",false,"2026-08-26"),"di 1","dagnaam rolt correct over maandgrens");

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
  [DAGNAAM_BRON,"oude weekdagnaam"],
  [KOP_BRON,"oude weekkoppen"],
  [KOP_CSS_BRON,"bestaande weekkop-CSShaak"]
])assert.equal(bron.split(fragment).length-1,1,"ontwikkeltemplate mist exact "+label);
assert(!bron.includes("function weatherNowDagNeerslagTekst(kans,som){"),"ontwikkeltemplate bevat de productiehelper al");
assert(!bron.includes('.row.day.kop .bar{text-align:center}'),"ontwikkeltemplate bevat de late Bereik-uitlijning al");

const uit=pasDailyForecastOwnerToe(bron);
for(const [fragment,label] of [
  [DCOND_PRODUCTIE,"finale weekomschrijving"],
  [DRAIN_PRODUCTIE,"finale weekneerslagcel"],
  [DAGNAAM_PRODUCTIE,"finale lokale weekdagnaam"],
  [KOP_PRODUCTIE,"finale weekkoppen"],
  [HELPER_PRODUCTIE,"daily-forecast helper"],
  [KOP_CSS_PRODUCTIE,"daily-forecast weekkop-CSS"]
])assert.equal(uit.split(fragment).length-1,1,label+" ontbreekt of is dubbel");
assert.equal(uit.split('.row.day.kop .bar{text-align:center}').length-1,1,"Bereik-kop moet exact één keer gecentreerd worden door de daily owner");
assert(uit.includes("function weatherNowDagNeerslagMmTekst(som){"),"hoeveelheidsformatter ontbreekt in base-build");
assert(uit.includes('if(mm===0)return "0,0 mm";'),"bekende nulhoeveelheid moet expliciet als 0,0 mm worden weergegeven");
assert(uit.includes('if(mm<=weatherNowDagSpoorMm())return "spoor";'),"spoorhoeveelheid mag geen <0,05-schijnprecisie krijgen");
assert(uit.includes('if(mm<0.05)return "<0,05 mm";'),"kleine maar boven-spoorhoeveelheid krijgt de precieze <0,05-weergave");
assert(uit.includes('if(mm<0.1)return "<0,1 mm";'),"0,05 tot 0,1 mm behoudt de bredere <0,1-weergave");
assert(uit.includes('globalThis.WeatherNowInterpretatie.INTERPRETATIE_CONFIG'),"browserformatter leest de centrale spoorgrens wanneer beschikbaar");
assert(uit.includes('if(sleutel===weatherNowLokaleDatumSleutel())return volledig?"Vandaag "+nr:"Vandaag";'),"weekrij gebruikt lokale kalenderdag voor Vandaag");
assert(uit.includes('neerslagMmTekst?`<small>${neerslagMmTekst}</small>`:""'),"weekcel gebruikt de null-veilige hoeveelheid niet");
for(const fragment of [DCOND_BRON,DRAIN_BRON,DAGNAAM_BRON,KOP_BRON])assert(!uit.includes(fragment),"oude daily-presentatie bleef in base-build staan");

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

console.log("Daily-forecast owner contract groen: lokale Vandaag-semantiek, kans en kleine bekende hoeveelheden worden precies weergegeven.");
