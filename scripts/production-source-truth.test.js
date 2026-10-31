"use strict";

const assert=require("assert");
const {bft,dagNeerslag,uvPiekVandaag,uvPiekVerwacht,verwachtThema,zonDagIndex,zonVerwachting,verwachtDagRijen}=require("./production-source-truth.js");

assert.equal(bft(0),0);assert.equal(bft(1),1);assert.equal(bft(12),3);assert.equal(bft(117),11);assert.equal(bft(118),12);
assert.deepEqual(dagNeerslag(0,0),{hoofd:"Droog",hoeveelheid:""});
assert.deepEqual(dagNeerslag(25,0),{hoofd:"25%",hoeveelheid:"0,0 mm"});
assert.deepEqual(dagNeerslag(25,null),{hoofd:"25%",hoeveelheid:"hoeveelheid onzeker"});
assert.deepEqual(dagNeerslag(25,0.03),{hoofd:"25%",hoeveelheid:"hoeveelheid onzeker"});
assert.deepEqual(dagNeerslag(25,0.09),{hoofd:"25%",hoeveelheid:"hoeveelheid onzeker"});
assert.deepEqual(dagNeerslag(0,0.2),{hoofd:"Onzeker",hoeveelheid:"0,2 mm"});
assert.deepEqual(dagNeerslag(65,1.24),{hoofd:"65%",hoeveelheid:"1,2 mm"});

const bron={
  current:{time:"2026-08-27T21:00",is_day:0},
  hourly:{time:["2026-08-27T10:00","2026-08-27T12:00","2026-08-28T12:00"],uv_index:[2,5,7]},
  daily:{
    time:["2026-08-27","2026-08-28","2026-08-29","2026-08-30","2026-08-31","2026-09-01","2026-09-02"],
    sunrise:Array(7).fill("2026-08-27T06:30"),sunset:Array(7).fill("2026-08-27T20:30"),
    temperature_2m_min:[10,11,12,13,14,15,16],temperature_2m_max:[20,21,22,23,24,25,26],
    wind_speed_10m_max:[0,1,6,12,20,29,39],precipitation_probability_max:[0,10,20,30,40,50,60],precipitation_sum:[0,0,0.1,0.2,0.3,0.4,0.5]
  }
};
assert.equal(uvPiekVandaag(bron),5);
assert.equal(uvPiekVandaag(bron,"2026-08-27T23:59"),5,"dezelfde lokale dag blijft exact tegen de bron getoetst");
assert.equal(uvPiekVandaag(bron,"2026-08-28T00:01"),null,"stale UV van gisteren blijft fail-closed, zoals Q3 vereist");
assert.equal(uvPiekVandaag({...bron,current:{time:"2026-08-28T00:00"}},"2026-08-28T00:01"),7,"verse huidige dag vereist zijn eigen piek");
assert.equal(uvPiekVandaag({...bron,hourly:{time:["2026-08-27T12:00"],uv_index:[0]}},"2026-08-27T23:59"),0,"echte nul blijft nul");
assert.equal(uvPiekVandaag({...bron,hourly:{time:["2026-08-27T12:00"],uv_index:[null]}},"2026-08-27T23:59"),null,"ontbrekend is geen nul");
/* Na zonsondergang (20:30) toont de tegel de piek van morgen, ervoor die van vandaag. */
assert.equal(uvPiekVerwacht(bron,"2026-08-27T20:29"),5,"voor zonsondergang geldt de piek van vandaag");
assert.equal(uvPiekVerwacht(bron,"2026-08-27T20:30"),7,"vanaf zonsondergang geldt de piek van morgen");
assert.equal(uvPiekVerwacht(bron),7,"current.time 21:00 ligt na zonsondergang");
assert.equal(uvPiekVerwacht({...bron,hourly:{time:["2026-08-27T12:00"],uv_index:[5]},daily:{...bron.daily,uv_index_max:[5,6.6]}},"2026-08-27T21:00"),7,"zonder uurwaarden voor morgen valt de piek terug op de dagwaarde");
assert.equal(uvPiekVerwacht({...bron,daily:{...bron.daily,time:["2026-08-27"],sunset:["2026-08-27T20:30"]}},"2026-08-27T21:00"),5,"zonder dag van morgen blijft de piek van vandaag");
assert.equal(zonDagIndex(bron),1);
assert.deepEqual(zonVerwachting(bron).op,["06:30"]);
assert.deepEqual(zonVerwachting(bron).onder,["20:30"]);
assert.equal(verwachtDagRijen(bron).length,7);
assert.deepEqual(verwachtDagRijen(bron)[1],{datum:"2026-08-28",min:11,max:21,wind:1,neerslag:{hoofd:"10%",hoeveelheid:"0,0 mm"}});
assert.deepEqual(verwachtDagRijen(bron)[2],{datum:"2026-08-29",min:12,max:22,wind:2,neerslag:{hoofd:"20%",hoeveelheid:"0,1 mm"}});
/* Met uurdata volgt een komende dag de uren 00-24, net als de site: het uur
   23-24 van de vorige dag (tijdstempel 00:00, 90%) telt niet mee, het laatste
   uur van de dag zelf (tijdstempel 00:00 van de volgende dag, 77%) wel. */
{
  const tijden=Array.from({length:50},(_,k)=>new Date(Date.parse("2026-08-28T00:00Z")+k*3600000).toISOString().slice(0,16));
  const kans=tijden.map(t=>t==="2026-08-28T00:00"?90:t==="2026-08-29T00:00"?77:10);
  const metUren={...bron,utc_offset_seconds:7200,timezone:"Europe/Amsterdam",hourly:{time:tijden,precipitation_probability:kans,precipitation:tijden.map(()=>0)},
    daily:{...bron.daily,precipitation_probability_max:[0,90,77,30,40,50,60]}};
  assert.equal(verwachtDagRijen(metUren)[1].neerslag.hoofd,"77%","komende dag: uren 00-24 in plaats van het daily veld (90%)");
  assert.equal(verwachtDagRijen(metUren)[2].neerslag.hoofd,"10%","dag erna: het uur 23-24 van de vorige dag telt niet mee (daily veld 77%)");
}

const avond={
  current:{time:"2026-08-27T19:00",is_day:1},
  daily:{
    time:["2026-08-27","2026-08-28"],
    sunrise:["2026-08-27T06:31","2026-08-28T06:33"],
    sunset:["2026-08-27T20:31","2026-08-28T20:29"]
  }
};
assert.deepEqual(zonVerwachting(avond).op,["06:33"],"na de verstreken zonsopkomst toont de UI de eerstvolgende opkomst");
assert.deepEqual(zonVerwachting(avond).onder,["20:31"],"vóór zonsondergang blijft de huidige ondergang zichtbaar");

const rondZonsopkomst={
  current:{time:"2026-08-28T06:15",is_day:1},
  daily:{
    time:["2026-08-28","2026-08-29"],
    sunrise:["2026-08-28T06:19","2026-08-29T06:20"],
    sunset:["2026-08-28T19:31","2026-08-29T19:29"]
  }
};
assert.deepEqual(zonVerwachting(rondZonsopkomst).op,["06:19"],"zonder live override volgt de bronhorizon vóór zonsopkomst");
assert.deepEqual(zonVerwachting(rondZonsopkomst,"2026-08-28T06:22").op,["06:20"],"met live lokale horizon verwacht de monitor na zonsopkomst alleen de volgende opkomst");
assert.deepEqual(zonVerwachting(rondZonsopkomst,"2026-08-28T06:22").onder,["19:31"],"met live lokale horizon blijft de komende zonsondergang van vandaag zichtbaar");

/* Klokwisseldagen. Open-Meteo zet één response op één vaste utc_offset_seconds en negeert een klokwissel binnen de forecastperiode:
   de ruwe daily.sunrise/sunset van een dag na de wissel staan dan een uur te laat ten opzichte van de klok in de plaats. De monitor
   moet het echte instant in de IANA-zone vergelijken met wat de pagina toont (de pagina rekent via de vaste offset naar de echte
   lokale tijd), zonder een verschil van één uur of beide waarden goed te rekenen.
   Fixtures zijn synthetisch; Miami volgt de ruwe Open-Meteo-waarden van 31 oktober 2026 (timezone=auto, -14400), Amsterdam de ruwe
   komende zonsopkomst 08:23 die de productiemonitor op 24 oktober 2026 (run #1010, 18:13 UTC) op de vaste +02:00-as zag. */
{
  const {providerIsoNaarLokaleIso}=require("./production-source-truth.js");
  const interpretatie=require("../interpretatie-engine.js");
  const nl={timezone:"Europe/Amsterdam",utc_offset_seconds:7200,
    current:{time:"2026-10-24T18:13"},
    daily:{time:["2026-10-24","2026-10-25","2026-10-26"],
      sunrise:["2026-10-24T08:21","2026-10-25T08:23","2026-10-26T08:25"],
      sunset:["2026-10-24T18:07","2026-10-25T18:05","2026-10-26T18:03"]}};
  const miami={timezone:"America/New_York",utc_offset_seconds:-14400,
    current:{time:"2026-10-31T08:30"},
    daily:{time:["2026-10-31","2026-11-01","2026-11-02"],
      sunrise:["2026-10-31T07:28","2026-11-01T07:29","2026-11-02T07:29"],
      sunset:["2026-10-31T18:39","2026-11-01T18:39","2026-11-02T18:38"]}};

  /* Tweede mening: de omzetting van de monitor (Intl) is gelijk aan die van de app-API (interpretatie-engine) voor alle ruwe
     tijden van de fixtures en voor elk uur rond beide klokwissels, inclusief het dubbele en het ontbrekende uur. */
  const gelijkAanApp=(bron,iso)=>assert.equal(providerIsoNaarLokaleIso(iso,bron),
    interpretatie.minutenNaarLokaal(interpretatie.providerNaarMinuten(iso,bron.utc_offset_seconds),bron.timezone,bron.utc_offset_seconds),
    `${bron.timezone} ${iso}: monitor en app rekenen de ruwe provider-tijd verschillend om`);
  for(const bron of [nl,miami])for(const iso of [...bron.daily.sunrise,...bron.daily.sunset])gelijkAanApp(bron,iso);
  for(const [bron,begin] of [[nl,Date.UTC(2026,9,24,20)],[miami,Date.UTC(2026,9,31,20)]])
    for(let k=0;k<=96;k++)gelijkAanApp(bron,new Date(begin+k*3600000+bron.utc_offset_seconds*1000).toISOString().slice(0,16));

  /* Nederland, zaterdag 24 oktober 2026 (de wissel naar wintertijd is zondag 25 oktober om 03:00): de vaste as is +02:00. */
  assert.equal(providerIsoNaarLokaleIso("2026-10-25T08:23",nl),"2026-10-25T07:23","zondag staat de zon 07:23 CET op, niet 08:23");
  assert.equal(providerIsoNaarLokaleIso("2026-10-25T18:05",nl),"2026-10-25T17:05","zondag gaat de zon 17:05 CET onder, niet 18:05");
  assert.equal(providerIsoNaarLokaleIso("2026-10-24T08:21",nl),"2026-10-24T08:21","zaterdag (nog zomertijd) blijft ongewijzigd");
  assert.deepEqual(zonVerwachting(nl,"2026-10-24T18:13").op,["07:23"],"zaterdagavond na zonsondergang: de komende opkomst is 07:23 (CET), de waarde uit run #1010 (08:23) is de ruwe as");
  assert.deepEqual(zonVerwachting(nl,"2026-10-24T18:13").onder,["17:05"]);
  assert.deepEqual(zonVerwachting(nl,"2026-10-24T07:30").op,["08:21"],"zaterdagochtend voor zonsopkomst: nog zomertijd, 08:21");
  assert.deepEqual(zonVerwachting(nl,"2026-10-24T07:30").onder,["18:07"]);
  assert.deepEqual(zonVerwachting(nl).op,["07:23"],"zonder override volgt de horizon ook de omgezette current.time (zaterdag 18:13 CEST)");
  assert.deepEqual(zonVerwachting(nl,"2026-10-25T12:00").onder,["17:05"],"zondagmiddag (CET) op dezelfde oude response: ondergang 17:05");
  assert.deepEqual(zonVerwachting(nl,"2026-10-25T12:00").op,["07:25"],"zondagmiddag (CET): komende opkomst maandag is 07:25");
  assert.deepEqual(zonVerwachting(nl,"2026-10-25T17:30").onder,["17:03"],"zondag 17:30 CET is na de echte ondergang (17:05): alleen de ondergang van maandag, hoewel de ruwe as nog 18:05 zegt");
  assert.deepEqual(zonVerwachting(nl,"2026-10-25T17:30").op,["07:25"]);

  /* Miami, zaterdag 31 oktober 2026 (de wissel naar wintertijd is zondag 1 november om 02:00): de vaste as is -04:00. */
  assert.equal(providerIsoNaarLokaleIso("2026-11-01T07:29",miami),"2026-11-01T06:29","zondag staat de zon 06:29 EST op, niet 07:29");
  assert.equal(providerIsoNaarLokaleIso("2026-11-01T18:39",miami),"2026-11-01T17:39","zondag gaat de zon 17:39 EST onder, niet 18:39");
  assert.equal(providerIsoNaarLokaleIso("2026-10-31T07:28",miami),"2026-10-31T07:28","zaterdag (nog zomertijd) blijft ongewijzigd");
  assert.deepEqual(zonVerwachting(miami,"2026-10-31T08:36").op,["06:29"],"productie 31 oktober 08:36: de pagina toont Morgen zon op 06:29");
  assert.deepEqual(zonVerwachting(miami,"2026-10-31T08:36").onder,["18:39"]);
  assert.notDeepEqual(zonVerwachting(miami,"2026-10-31T08:36").op,["07:29"],"de ruwe provider-as (07:29) is niet de zichtbare tijd");
  assert.deepEqual(zonVerwachting(miami).op,["06:29"],"zonder override is current.time 08:30 na de opkomst van vandaag (07:28): komende opkomst is die van zondag, 06:29");
  assert.deepEqual(zonVerwachting(miami).onder,["18:39"]);
  assert.deepEqual(zonVerwachting(miami,"2026-11-01T08:00").op,["06:29"],"zondag 08:00 EST op dezelfde oude response: komende opkomst maandag 06:29");
  assert.deepEqual(zonVerwachting(miami,"2026-11-01T08:00").onder,["17:39"]);
  assert.deepEqual(zonVerwachting(miami,"2026-11-01T17:50").onder,["17:38"],"zondag 17:50 EST is na de echte ondergang (17:39): alleen de ondergang van maandag");

  /* Een response die ná de wissel is opgehaald heeft de nieuwe offset: ruwe en lokale tijd vallen samen en worden niet dubbel gecorrigeerd. */
  const miamiNa={timezone:"America/New_York",utc_offset_seconds:-18000,current:{time:"2026-11-01T08:00"},
    daily:{time:["2026-11-01","2026-11-02"],sunrise:["2026-11-01T06:29","2026-11-02T06:29"],sunset:["2026-11-01T17:39","2026-11-02T17:38"]}};
  assert.equal(providerIsoNaarLokaleIso("2026-11-02T06:29",miamiNa),"2026-11-02T06:29");
  assert.deepEqual(zonVerwachting(miamiNa,"2026-11-01T08:00").op,["06:29"]);
  assert.deepEqual(zonVerwachting(miamiNa,"2026-11-01T08:00").onder,["17:39"]);

  /* Reguliere dagen zonder klokwissel (winter in Nederland, standaardtijd in Miami, Tokio zonder zomertijd): ruw is gelijk aan lokaal. */
  for(const [bron,verwacht] of [
    [{timezone:"Europe/Amsterdam",utc_offset_seconds:3600,current:{time:"2026-11-10T10:00"},daily:{time:["2026-11-10","2026-11-11"],sunrise:["2026-11-10T07:46","2026-11-11T07:48"],sunset:["2026-11-10T16:55","2026-11-11T16:53"]}},{op:["07:48"],onder:["16:55"]}],
    [{timezone:"America/New_York",utc_offset_seconds:-18000,current:{time:"2026-11-10T10:00"},daily:{time:["2026-11-10","2026-11-11"],sunrise:["2026-11-10T06:35","2026-11-11T06:36"],sunset:["2026-11-10T17:33","2026-11-11T17:32"]}},{op:["06:36"],onder:["17:33"]}],
    [{timezone:"Asia/Tokyo",utc_offset_seconds:32400,current:{time:"2026-11-10T10:00"},daily:{time:["2026-11-10","2026-11-11"],sunrise:["2026-11-10T06:11","2026-11-11T06:12"],sunset:["2026-11-10T16:32","2026-11-11T16:31"]}},{op:["06:12"],onder:["16:32"]}]
  ]){
    for(const iso of [...bron.daily.sunrise,...bron.daily.sunset])assert.equal(providerIsoNaarLokaleIso(iso,bron),iso,`${bron.timezone}: zonder klokwissel is de ruwe tijd de lokale tijd`);
    assert.deepEqual(zonVerwachting(bron,"2026-11-10T10:00").onder,verwacht.onder,`${bron.timezone}: ondergang van vandaag`);
    assert.deepEqual(zonVerwachting(bron,"2026-11-10T10:00").op,verwacht.op,`${bron.timezone}: komende opkomst`);
  }
  assert.equal(providerIsoNaarLokaleIso("2026-11-01T07:29",{timezone:"America/New_York"}),"2026-11-01T07:29","zonder offset blijft de ruwe tijd staan");
  assert.equal(providerIsoNaarLokaleIso("2026-11-01T07:29",{utc_offset_seconds:-14400}),"2026-11-01T07:29","zonder tijdzone blijft de ruwe tijd staan");
  assert.equal(providerIsoNaarLokaleIso("",miami),"","een lege waarde blijft leeg");
}

assert.equal(verwachtThema("auto","licht"),"licht","Auto volgt een licht systeem");
assert.equal(verwachtThema("auto","donker"),"donker","Auto volgt een donker systeem, ook overdag");
assert.equal(verwachtThema("licht","donker"),"licht","expliciete Licht-keuze wint van het systeem");
assert.equal(verwachtThema("donker","licht"),"donker","expliciete Donker-keuze wint van het systeem");
assert.equal(verwachtThema("auto",undefined),"licht","onbekend systeemschema valt terug op licht");

console.log("production-source-truth: bron-naar-UI-contracten OK");
