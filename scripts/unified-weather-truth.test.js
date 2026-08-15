"use strict";

const assert=require("assert");
const interpretatie=require("../interpretatie-engine.js");
const beleid=require("../neerslagkans-policy-v3.js");

let n=0;
function test(naam,fn){
  try{fn();n++;console.log("OK  "+naam);}
  catch(e){console.error("FOUT "+naam+"\n  "+e.message);process.exitCode=1;}
}

test("centrale engine en zichtbaar kansbeleid delen exact dezelfde grenzen",()=>{
  const c=interpretatie.INTERPRETATIE_CONFIG;
  assert.equal(c.zeerKleineKansMax,9);
  assert.equal(c.kleineKansMax,29);
  assert.equal(c.mogelijkeKansMax,69);
  assert.equal(beleid.kansNiveau(9),"ZEER_KLEIN");
  assert.equal(beleid.kansNiveau(10),"KLEIN");
  assert.equal(beleid.kansNiveau(29),"KLEIN");
  assert.equal(beleid.kansNiveau(30),"MOGELIJK");
  assert.equal(beleid.kansNiveau(69),"MOGELIJK");
  assert.equal(beleid.kansNiveau(70),"GROOT");
});

test("Dronten: verse droge KNMI-meting wist een actuele modelregenclaim uit",()=>{
  const nu=Date.parse("2026-08-15T14:55:00Z");
  const start=nu/60000;
  const data={
    timezone:"Europe/Amsterdam",
    utc_offset_seconds:7200,
    current:{weather_code:61,precipitation:0.2},
    __knmiNeerslag:{
      beschikbaar:true,
      opgehaaldOp:"2026-08-15T14:55:30Z",
      actueel:{waarde:0,tijd:"2026-08-15T14:50:00Z"},
      nowcast:null
    }
  };
  const basis={
    genoeg:true,status:"NEERSLAG_NU",rang:interpretatie.STATUS_RANG.NEERSLAG_NU,
    kans:12,kansDekking:1,hoeveelheid:0,bronHoeveelheid:"uurdata",
    currentWet:true,currentHoeveelheid:0.2,soort:"regen",startMin:start,duurMin:120
  };
  const a=beleid.verrijkAnalyseMetKnmi(basis,data,120,interpretatie,nu);
  assert.equal(a.bronActueel,"knmi-rtcor");
  assert.equal(a.currentIntensiteit,0);
  assert.equal(a.currentRadarWet,false);
  assert.equal(a.currentModelWet,true,"modelsignaal blijft alleen diagnostisch bewaard");
  assert.equal(a.currentWet,false,"verse radarwaarneming bepaalt de actuele nat/droog-vraag");
  assert.equal(a.status,"KLEINE_KANS","12% blijft toekomstige kleine kans en geen actuele regen");
  assert.equal(beleid.kansHoofd(a),"12%");
  assert.equal(beleid.briefingZin(a),"De komende twee uur is er een kleine kans op neerslag.");
  assert.equal(beleid.komendUurTekst(a),"Kleine kans op neerslag het komende uur.");
  assert(!/(valt|regent|vallen) nu/i.test(beleid.kansZin(a,"de komende twee uur")));
});

test("verse droge KNMI-meting laat toekomstige modelneerslag wel intact",()=>{
  const nu=Date.parse("2026-08-15T14:55:00Z");
  const data={
    current:{weather_code:61,precipitation:0.2},
    __knmiNeerslag:{
      beschikbaar:true,
      opgehaaldOp:"2026-08-15T14:55:30Z",
      actueel:{waarde:0,tijd:"2026-08-15T14:50:00Z"},
      nowcast:null
    }
  };
  const basis={
    genoeg:true,status:"NEERSLAG_NU",rang:interpretatie.STATUS_RANG.NEERSLAG_NU,
    kans:40,kansDekking:1,hoeveelheid:0.4,bronHoeveelheid:"uurdata",
    currentWet:true,currentHoeveelheid:0.2,soort:"regen",startMin:nu/60000,duurMin:120
  };
  const a=beleid.verrijkAnalyseMetKnmi(basis,data,120,interpretatie,nu);
  assert.equal(a.currentWet,false);
  assert.equal(a.status,"NEERSLAG_VERWACHT");
  assert.equal(a.hoeveelheid,0.4);
  assert(/mogelijk|verwacht/i.test(beleid.briefingZin(a)));
  assert(!/(valt|regent|vallen) nu/i.test(beleid.briefingZin(a)));
});

test("verse natte KNMI-meting blijft model-droog direct overrulen",()=>{
  const nu=Date.parse("2026-08-15T14:55:00Z");
  const data={
    current:{weather_code:3,precipitation:0},
    __knmiNeerslag:{
      beschikbaar:true,
      opgehaaldOp:"2026-08-15T14:55:20Z",
      actueel:{waarde:1.4,tijd:"2026-08-15T14:50:00Z"},
      nowcast:null
    }
  };
  const basis={
    genoeg:true,status:"KLEINE_KANS",rang:interpretatie.STATUS_RANG.KLEINE_KANS,
    kans:12,kansDekking:1,hoeveelheid:0,bronHoeveelheid:"uurdata",
    currentWet:false,currentHoeveelheid:0,soort:"neerslag",startMin:nu/60000,duurMin:120
  };
  const a=beleid.verrijkAnalyseMetKnmi(basis,data,120,interpretatie,nu);
  assert.equal(a.currentRadarWet,true);
  assert.equal(a.currentWet,true);
  assert.equal(a.status,"NEERSLAG_NU");
  assert.equal(beleid.kansHoofd(a),"12%","kanscijfer mag zichtbaar blijven, actuele tekst moet wel nat zijn");
  assert.match(beleid.briefingZin(a),/valt nu neerslag/i);
});

test("verouderde droge KNMI-meting mag een verse modelregenclaim niet overschrijven",()=>{
  const nu=Date.parse("2026-08-15T14:55:00Z");
  const data={
    current:{weather_code:61,precipitation:0.2},
    __knmiNeerslag:{
      beschikbaar:true,
      opgehaaldOp:"2026-08-15T14:55:20Z",
      actueel:{waarde:0,tijd:"2026-08-15T14:40:00Z"},
      nowcast:null
    }
  };
  const basis={
    genoeg:true,status:"NEERSLAG_NU",rang:interpretatie.STATUS_RANG.NEERSLAG_NU,
    kans:12,kansDekking:1,hoeveelheid:0,bronHoeveelheid:"uurdata",
    currentWet:true,currentHoeveelheid:0.2,soort:"regen",startMin:nu/60000,duurMin:120
  };
  const a=beleid.verrijkAnalyseMetKnmi(basis,data,120,interpretatie,nu);
  assert.equal(a.bronActueel,undefined);
  assert.equal(a.currentWet,true);
  assert.equal(a.status,"NEERSLAG_NU");
});

if(process.exitCode)console.error("\nUnified weather truth: minstens één regressie mislukt.");
else console.log("\nUnified weather truth: "+n+" regressies geslaagd.");
