"use strict";

const assert=require("assert");
const {bft,dagNeerslag,uvPiekVandaag,zonDagIndex,zonVerwachting,verwachtDagRijen}=require("./production-source-truth.js");

assert.equal(bft(0),0);assert.equal(bft(1),1);assert.equal(bft(12),3);assert.equal(bft(117),11);assert.equal(bft(118),12);
assert.deepEqual(dagNeerslag(0,0),{hoofd:"Droog",hoeveelheid:""});
assert.deepEqual(dagNeerslag(25,0),{hoofd:"25%",hoeveelheid:"hoeveelheid onzeker"});
assert.deepEqual(dagNeerslag(25,null),{hoofd:"25%",hoeveelheid:"hoeveelheid onzeker"});
assert.deepEqual(dagNeerslag(25,0.03),{hoofd:"25%",hoeveelheid:"hoeveelheid onzeker"});
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
assert.equal(zonDagIndex(bron),1);
assert.deepEqual(zonVerwachting(bron).op,["06:30"]);
assert.deepEqual(zonVerwachting(bron).onder,["20:30"]);
assert.equal(verwachtDagRijen(bron).length,7);
assert.deepEqual(verwachtDagRijen(bron)[1],{datum:"2026-08-28",min:11,max:21,wind:1,neerslag:{hoofd:"10%",hoeveelheid:"hoeveelheid onzeker"}});
assert.deepEqual(verwachtDagRijen(bron)[2],{datum:"2026-08-29",min:12,max:22,wind:2,neerslag:{hoofd:"20%",hoeveelheid:"0,1 mm"}});

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

console.log("production-source-truth: bron-naar-UI-contracten OK");
