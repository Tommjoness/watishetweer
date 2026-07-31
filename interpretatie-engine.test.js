"use strict";

const assert=require("assert");
const {
  analyseerNeerslagData,
  analyseerDagData,
  neerslagZin,
  hoeveelheidTekst,
  statusRang
}=require("./interpretatie-engine.js");

function tijdenVanaf(datum,beginUur,aantal){
  const start=Date.UTC(+datum.slice(0,4),+datum.slice(5,7)-1,+datum.slice(8,10),beginUur,0);
  return Array.from({length:aantal},(_,i)=>new Date(start+i*3600000).toISOString().slice(0,16));
}

function kwartierenVanaf(datum,beginUur,aantal){
  const start=Date.UTC(+datum.slice(0,4),+datum.slice(5,7)-1,+datum.slice(8,10),beginUur,0);
  return Array.from({length:aantal},(_,i)=>new Date(start+i*15*60000).toISOString().slice(0,16));
}

function basis(opties){
  opties=opties||{};
  const datum="2026-07-31";
  const hourlyTime=opties.hourlyTime||tijdenVanaf(datum,17,9); // 17:00 t/m 01:00
  const minTime=opties.minTime||kwartierenVanaf(datum,18,17);  // 18:00 t/m 22:00
  const kans=opties.kans||hourlyTime.map(()=>4);
  const uurMm=opties.uurMm||hourlyTime.map(()=>0);
  const uurCode=opties.uurCode||hourlyTime.map(()=>3);
  const minMm=opties.minMm||minTime.map(()=>0);
  const minCode=opties.minCode||minTime.map(()=>3);
  return {
    current:{
      time:opties.nu||datum+"T19:00",
      interval:900,
      precipitation:opties.currentMm||0,
      weather_code:opties.currentCode===undefined?3:opties.currentCode
    },
    hourly:{
      time:hourlyTime,
      precipitation_probability:kans,
      precipitation:uurMm,
      weather_code:uurCode
    },
    minutely_15:{
      time:minTime,
      precipitation:minMm,
      weather_code:minCode,
      rain:minMm.map(()=>0),
      showers:minMm.map(()=>0),
      snowfall:minMm.map(()=>0)
    },
    daily:{time:[datum,"2026-08-01"]}
  };
}

let geslaagd=0;
function test(naam,fn){
  try{ fn(); geslaagd++; console.log("OK  "+naam); }
  catch(e){ console.error("FOUT "+naam+"\n  "+e.message); process.exitCode=1; }
}

test("verlopen 23% telt niet mee voor de komende twee uur",()=>{
  const d=basis();
  // 19:00 is de kans over 18:00-19:00 en raakt het toekomstige venster niet.
  d.hourly.precipitation_probability[2]=23; // tijd 19:00
  d.hourly.precipitation_probability[3]=4;  // tijd 20:00
  d.hourly.precipitation_probability[4]=4;  // tijd 21:00
  const a=analyseerNeerslagData(d,120);
  assert.equal(a.kans,4);
  assert.equal(a.status,"ZEER_KLEINE_KANS");
});

test("optie 1 wordt exact en zonder absolute droogclaim gevormd",()=>{
  const a=analyseerNeerslagData(basis(),120);
  assert.equal(neerslagZin(a),
    "De komende twee uur is de kans op neerslag zeer klein. Maximale kans: 4%. Verwachte hoeveelheid: 0,0 mm.");
  assert(!/blijft.*droog/i.test(neerslagZin(a)));
});

test("0% en 0,0 mm wordt verwachting, geen garantie",()=>{
  const d=basis({kans:Array(9).fill(0)});
  const zin=neerslagZin(analyseerNeerslagData(d,120));
  assert(/wordt geen neerslag verwacht/.test(zin));
  assert(!/blijft.*droog/i.test(zin));
});

test("om 19:47 omvat komend uur beide overlappende uurvakken",()=>{
  const d=basis({nu:"2026-07-31T19:47"});
  d.hourly.precipitation_probability[3]=4;  // 19:00-20:00
  d.hourly.precipitation_probability[4]=12; // 20:00-21:00
  const a=analyseerNeerslagData(d,60);
  assert.equal(a.begin,"19:47");
  assert.equal(a.eind,"20:47");
  assert.equal(a.kans,12);
  assert.equal(a.kansDekking,1);
});

test("positieve hoeveelheid onder 0,1 mm wordt niet als 0,0 verborgen",()=>{
  assert.equal(hoeveelheidTekst(0.04),"<0,1 mm");
  const d=basis();
  d.minutely_15.precipitation[5]=0.04;
  const a=analyseerNeerslagData(d,120);
  assert.equal(a.status,"SPOORHOEVEELHEID");
  assert(/<0,1 mm/.test(neerslagZin(a)));
});

test("grote kans zonder hoeveelheid wordt als modelverschil benoemd",()=>{
  const d=basis();
  d.hourly.precipitation_probability[3]=80;
  d.hourly.precipitation_probability[4]=75;
  const a=analyseerNeerslagData(d,120);
  assert.equal(a.status,"GROTE_KANS_ZONDER_HOEVEELHEID");
  assert(/hoeveelheidsmodel berekent geen meetbare neerslag/.test(neerslagZin(a)));
});

test("meetbare sneeuw gebruikt toekomstig neerslagtype",()=>{
  const d=basis();
  d.minutely_15.precipitation[5]=0.2;
  d.minutely_15.weather_code[5]=73;
  d.hourly.precipitation_probability[3]=70;
  const a=analyseerNeerslagData(d,120);
  assert.equal(a.status,"NEERSLAG_VERWACHT");
  assert.equal(a.soort,"sneeuw");
  assert(/sneeuw verwacht/.test(neerslagZin(a)));
});

test("recente neerslag is alleen 'nu' bij passende actuele weercode",()=>{
  const droogCode=basis({currentMm:0.2,currentCode:3});
  assert.notEqual(analyseerNeerslagData(droogCode,120).status,"NEERSLAG_NU");
  const regenCode=basis({currentMm:0.2,currentCode:61});
  assert.equal(analyseerNeerslagData(regenCode,120).status,"NEERSLAG_NU");
});

test("onvoldoende tijdsdekking geeft geen stellige uitspraak",()=>{
  const d=basis({
    hourlyTime:["2026-07-31T19:00","2026-07-31T20:00"],
    kans:[4,4],uurMm:[0,0],uurCode:[3,3],
    minTime:["2026-07-31T19:15","2026-07-31T19:30","2026-07-31T19:45","2026-07-31T20:00"],
    minMm:[0,0,0,0],minCode:[3,3,3,3]
  });
  const a=analyseerNeerslagData(d,120);
  assert.equal(a.genoeg,false);
  assert.equal(a.status,"ONVOLDOENDE_DATA");
  assert(/ontbreken voldoende consistente gegevens/.test(neerslagZin(a)));
});

test("ontbrekende kans wordt niet stilletjes nul",()=>{
  const d=basis({kans:Array(9).fill(null)});
  const a=analyseerNeerslagData(d,120);
  assert.equal(a.kans,null);
  assert.equal(a.genoeg,false);
});

test("dubbele lokale tijd rond klokomslag verlaagt zekerheid",()=>{
  const d=basis();
  d.hourly.time[4]=d.hourly.time[3];
  const a=analyseerNeerslagData(d,120);
  assert.equal(a.genoeg,false);
  assert(/klokomslag/.test(a.reden));
});

test("daganalyse van vandaag sluit verlopen dagpiek uit",()=>{
  const d=basis();
  d.hourly.precipitation_probability[2]=94; // uur tot 19:00, precies verlopen
  d.hourly.precipitation_probability[3]=4;
  d.hourly.precipitation_probability[4]=3;
  d.hourly.precipitation_probability[5]=2;
  d.hourly.precipitation_probability[6]=1;
  d.hourly.precipitation_probability[7]=0;
  const a=analyseerDagData(d,0);
  assert.equal(a.kans,4);
});

test("meer kans leidt nooit tot een drogere status",()=>{
  const waarden=[0,1,19,20,39,40,69,70,100];
  let vorige=-Infinity;
  for(const v of waarden){
    const d=basis();
    d.hourly.precipitation_probability[3]=v;
    d.hourly.precipitation_probability[4]=v;
    const rang=statusRang(analyseerNeerslagData(d,120).status);
    assert(rang>=vorige,"rang daalde bij "+v+"%: "+rang+" < "+vorige);
    vorige=rang;
  }
});

test("meetbare hoeveelheid is nooit droger dan alleen kans",()=>{
  const d0=basis();
  const r0=statusRang(analyseerNeerslagData(d0,120).status);
  const d1=basis(); d1.minutely_15.precipitation[5]=0.12;
  const r1=statusRang(analyseerNeerslagData(d1,120).status);
  assert(r1>r0);
});

if(process.exitCode){
  console.error("\nInterpretatie-engine: minstens één test mislukt.");
}else{
  console.log("\nInterpretatie-engine: "+geslaagd+" scenario's geslaagd.");
}
