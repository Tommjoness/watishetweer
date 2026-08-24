"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path");
const {analyseerNeerslagData,analyseerDagData,neerslagZin}=require("./interpretatie-engine.js");
const {zonDaglichtInfo,nachtzichtScore,grafiekNeerslagVerschuiving,dagKansSamenvatting,komendUurTekst,maanEventsBinnenVenster,huidigeNeerslagEindMin,nachtSegmentHorizon}=require("./senior-correctness-v2.js");
let n=0;const test=(naam,fn)=>{try{fn();n++;console.log("OK  "+naam);}catch(e){console.error("FOUT "+naam+"\n  "+e.message);process.exitCode=1;}};
const uren=(datum,start,aantal)=>Array.from({length:aantal},(_,i)=>new Date(Date.UTC(+datum.slice(0,4),+datum.slice(5,7)-1,+datum.slice(8,10),start+i)).toISOString().slice(0,16));
function basis(){
  const ht=uren("2026-07-31",19,6);
  const mt=Array.from({length:8},(_,i)=>new Date(Date.UTC(2026,6,31,19,15*(i+1))).toISOString().slice(0,16));
  return {current:{time:"2026-07-31T19:00",precipitation:0,weather_code:3},hourly:{time:ht,precipitation:Array(6).fill(0),precipitation_probability:Array(6).fill(4),weather_code:Array(6).fill(3),rain:Array(6).fill(0),showers:Array(6).fill(0),snowfall:Array(6).fill(0)},minutely_15:{time:mt,precipitation:Array(8).fill(0),weather_code:Array(8).fill(3),rain:Array(8).fill(0),showers:Array(8).fill(0),snowfall:Array(8).fill(0)},daily:{time:["2026-07-31","2026-08-01"],weather_code:[3,3]}};
}

test("poolnacht: Open-Meteo gelijke lokale middernachten betekenen nul uur daglicht",()=>{
  const a=zonDaglichtInfo("2021-11-06T00:00","2021-11-06T00:00");
  assert.equal(a.status,"poolnacht");assert.equal(a.minuten,0);assert.equal(a.tekst,"poolnacht");assert.equal(a.daglichtTekst,"0 uur daglicht");assert.equal(a.zontekst,"Zon komt niet op");
});

test("pooldag: Open-Meteo middernacht tot volgende kalenderdag betekent 24 uur daglicht",()=>{
  const a=zonDaglichtInfo("2021-11-06T00:00","2021-11-07T00:00");
  assert.equal(a.status,"pooldag");assert.equal(a.minuten,1440);assert.equal(a.tekst,"24 uur daglicht");assert.equal(a.daglichtTekst,"24 uur daglicht");assert.equal(a.zontekst,"Zon gaat niet onder");
});

test("poolfallback: ontbrekende zonstippen vereisen een volledige eenduidige is_day-dag",()=>{
  const dag=Array(24).fill(1),nacht=Array(24).fill(0),gemengd=Array(24).fill(0);gemengd[12]=1;
  assert.equal(zonDaglichtInfo(null,null,dag).status,"pooldag");
  assert.equal(zonDaglichtInfo(null,null,nacht).status,"poolnacht");
  assert.equal(zonDaglichtInfo(null,null,gemengd).status,"onbekend");
  assert.equal(zonDaglichtInfo(null,null,Array(22).fill(1)).status,"onbekend");
});

test("poolovergang: zeer korte en zeer lange dag blijven normale daglengtes",()=>{
  const kort=zonDaglichtInfo("2026-01-20T11:00","2026-01-20T13:00");
  const lang=zonDaglichtInfo("2026-05-01T00:30","2026-05-01T23:30");
  assert.equal(kort.status,"normaal");assert.equal(kort.minuten,120);
  assert.equal(lang.status,"normaal");assert.equal(lang.minuten,1380);
});

test("daglengte: kalenderdatum blijft onderdeel van een over-middernachtinterval",()=>{
  const a=zonDaglichtInfo("2026-05-01T01:30","2026-05-02T00:30");
  assert.equal(a.status,"normaal");assert.equal(a.minuten,1380);assert.equal(a.tekst,"23 uur en 0 minuten daglicht");
});

test("zondata: ontbrekende, onmogelijke of omgekeerde tijden falen gesloten",()=>{
  for(const [op,onder] of [[null,null],["2026-02-31T00:00","2026-02-31T01:00"],["2026-05-02T12:00","2026-05-01T12:00"],["geen-tijd","2026-05-01T12:00"]]){
    const a=zonDaglichtInfo(op,onder);assert.equal(a.status,"onbekend",JSON.stringify({op,onder,a}));assert.equal(a.minuten,null);
  }
});

test("poolovergang: alleen echte opeenvolgende kalendernachten krijgen een rij",()=>{
  assert.equal(nachtSegmentHorizon("2026-08-25T23:00","2026-08-25T23:00","2026-08-24T16:00",false),null);
  assert.equal(nachtSegmentHorizon("2026-08-29T23:00","2026-08-30T01:00","2026-08-24T16:00",false),5);
  assert.equal(nachtSegmentHorizon("2026-08-25T00:00","2026-08-27T23:00","2026-08-24T16:00",false),null);
  assert.equal(nachtSegmentHorizon("2026-08-24T00:00","2026-08-24T05:00","2026-08-24T02:00",true),0);
});

test("punt 4: actuele regen blijft regen als later sneeuw volgt",()=>{
  const d=basis();d.current.precipitation=0.2;d.current.weather_code=61;
  d.minutely_15.precipitation.fill(0.2);d.minutely_15.weather_code.fill(73);
  d.hourly.precipitation_probability.fill(80);
  const a=analyseerNeerslagData(d,120);
  assert.equal(a.status,"NEERSLAG_NU");assert.equal(a.soort,"regen");assert(/valt er nu regen/.test(neerslagZin(a)),neerslagZin(a));
});

test("punt 5: verstreken onweer bepaalt het resterende weerbeeld van vandaag niet",()=>{
  const d=basis();d.daily.weather_code[0]=95;d.current.time="2026-07-31T19:00";
  d.hourly.weather_code=[95,0,1,1,0,0];d.hourly.precipitation.fill(0);d.hourly.precipitation_probability.fill(0);
  const a=analyseerDagData(d,0,"2026-07-31T19:00");
  assert(a.genoeg,"daganalyse hoort voldoende dekking te hebben");assert.notEqual(a.code,95);assert([0,1].includes(a.code),"resterende code "+a.code);
});

test("punt 7: overlappende uurkans wordt als modeluurmaximum benoemd in detailuitleg",()=>{
  const d=basis();d.current.time="2026-07-31T19:47";d.hourly.precipitation_probability[1]=4;d.hourly.precipitation_probability[2]=12;
  const a=analyseerNeerslagData(d,60,"2026-07-31T19:47"),zin=neerslagZin(a);
  assert.equal(a.kans,12);assert(/hoogste modelkans in de overlappende uurvakken/.test(zin),zin);
});

test("punt 8: twee verstreken uren over Amsterdamse voorjaarssprong eindigen om 04:30",()=>{
  const d={timezone:"Europe/Amsterdam",utc_offset_seconds:7200,current:{time:"2026-03-29T01:30",precipitation:0,weather_code:3},hourly:{time:["2026-03-29T01:00","2026-03-29T03:00","2026-03-29T04:00","2026-03-29T05:00"],precipitation:[0,0,0,0],precipitation_probability:[0,0,0,0],weather_code:[3,3,3,3],rain:[0,0,0,0],showers:[0,0,0,0],snowfall:[0,0,0,0]},minutely_15:{time:[],precipitation:[]}};
  const a=analyseerNeerslagData(d,120,"2026-03-29T01:30");assert.equal(a.eind,"04:30",JSON.stringify(a));
});

test("punt 8: dubbel lokaal uur rond najaarsomslag verlaagt zekerheid",()=>{
  const d={timezone:"Europe/Amsterdam",utc_offset_seconds:3600,current:{time:"2026-10-25T01:30",precipitation:0,weather_code:3},hourly:{time:["2026-10-25T02:00","2026-10-25T02:00","2026-10-25T03:00","2026-10-25T04:00"],precipitation:[0,0,0,0],precipitation_probability:[0,0,0,0],weather_code:[3,3,3,3],rain:[0,0,0,0],showers:[0,0,0,0],snowfall:[0,0,0,0]},minutely_15:{time:[],precipitation:[]}};
  const a=analyseerNeerslagData(d,120,"2026-10-25T01:30");assert.equal(a.genoeg,false);
});

test("punt 2: honderd meter zicht kan nooit Goed opleveren",()=>{
  const r=[0,1,2,3].map(i=>({ms:i*3600000,cloud:0,visibility:100,precip:0,code:0,humidity:100,spread:0,gust:5,moon:0}));
  const a=nachtzichtScore(r);assert(a.genoeg);assert(a.score<=1.5,"score "+a.score);
});

test("punt 2: langdurige mist en neerslag begrenzen Nachtzicht hard",()=>{
  const r=[0,1,2,3].map(i=>({ms:i*3600000,cloud:5,visibility:900,precip:0.3,code:61,humidity:98,spread:0.5,gust:5,moon:0}));
  const a=nachtzichtScore(r);assert(a.score<=1.5,"score "+a.score);assert.equal(a.beste,null);
});

test("punt 2: een tijdelijke zichtdip wordt niet als slecht nachtgemiddelde geformuleerd",()=>{
  const zicht=[500,15000,15000,15000];
  const r=zicht.map((visibility,i)=>({ms:i*3600000,cloud:45,visibility,precip:0,code:i===0?45:3,humidity:80,spread:4,gust:5,moon:0}));
  const a=nachtzichtScore(r);
  assert(a.genoeg);assert(a.gemZicht>=10000,"gemiddeld zicht "+a.gemZicht);
  assert(a.redenen.includes("tijdelijk slechter zicht"),JSON.stringify(a.redenen));
  assert(!a.redenen.includes("beperkt zicht"),JSON.stringify(a.redenen));
});

test("punt 2/3: ontbrekende uren vormen nooit een vals aaneengesloten zichtvenster",()=>{
  const r=[{ms:0,cloud:0,visibility:20000,precip:0,code:0,moon:0},{ms:3*3600000,cloud:0,visibility:20000,precip:0,code:0,moon:0}];
  const a=nachtzichtScore(r);assert.equal(a.beste,null);
});

test("actuele neerslag: eerste droge kwartier na aaneengesloten natte reeks bepaalt eindmoment",()=>{
  const a={currentWet:true,bronHoeveelheid:"kwartierdata",minutelyItems:[
    {begin:100,eind:115,precipitation:0.1},{begin:115,eind:130,precipitation:0.2},{begin:130,eind:145,precipitation:0},{begin:145,eind:160,precipitation:0}
  ]};
  assert.equal(huidigeNeerslagEindMin(a,0.1),130);
});

test("actuele neerslag: gat in kwartierreeks verzint geen droogtijd",()=>{
  const a={currentWet:true,bronHoeveelheid:"kwartierdata",minutelyItems:[
    {begin:100,eind:115,precipitation:0.1},{begin:130,eind:145,precipitation:0}
  ]};
  assert.equal(huidigeNeerslagEindMin(a,0.1),null);
});

test("punt 6: uurneerslag wordt een halve kolom naar het voorafgaande uur verschoven",()=>{
  assert.equal(grafiekNeerslagVerschuiving(100),-50);assert.equal(grafiekNeerslagVerschuiving(42),-21);
  const bron=fs.readFileSync(path.join(__dirname,"senior-correctness-v2.js"),"utf8");
  assert(bron.includes('millimeter neerslag$'),"hoeveelheidscijfers moeten met hun uurstaaf meeschuiven");
});

test("punt 9: nachtelijke bewolkingsomschrijving heeft expliciete heldere nachtvorm",()=>{
  const engine=fs.readFileSync(path.join(__dirname,"interpretatie-engine.js"),"utf8");assert(engine.includes('"Overwegend helder."'));
});

test("punt 1: landbrede waarschuwing mag briefing niet overrulen",()=>{
  const engine=fs.readFileSync(path.join(__dirname,"interpretatie-engine.js"),"utf8"),waars=fs.readFileSync(path.join(__dirname,"lib/waarschuwingen.cjs"),"utf8");
  assert(engine.includes('filter(w=>w&&w.plaatsSpecifiek!==false)'));assert(waars.includes("plaatsSpecifiek: false"));
});

test("punt 10: productsemantiek en correctheidslaag zijn expliciet geconfigureerd",()=>{
  const build=fs.readFileSync(path.join(__dirname,"build-weather.js"),"utf8"),cfg=require("./product-config.js");
  assert(build.includes('require("./product-config.js")'));assert(build.includes("SENIOR CORRECTHEIDSLAAG"));assert.equal(cfg.defaultLocation.naam,"Amsterdam");
});

test("live polish: lage dagkans wordt nooit als zekere motregen geformuleerd",()=>{
  const basisA={genoeg:true,status:"NEERSLAG_VERWACHT",soort:"motregen",eersteTijd:"20:00"};
  assert.equal(dagKansSamenvatting({...basisA,kans:12},"Lichte motregen"),"Zeer kleine kans op lichte motregen rond 20:00");
  assert.equal(dagKansSamenvatting({...basisA,kans:22},"Lichte motregen"),"Kleine kans op lichte motregen rond 20:00");
  assert.equal(dagKansSamenvatting({...basisA,kans:50},"Lichte motregen"),"Lichte motregen mogelijk rond 20:00");
  assert.equal(dagKansSamenvatting({...basisA,kans:80},"Lichte motregen"),"Lichte motregen rond 20:00");
});

test("live polish: komend-uurtegel volgt de canonieke kansowner zonder bronjargon",()=>{
  const tekst=komendUurTekst({genoeg:true,status:"KLEINE_KANS",kans:27,soort:"regen"});
  assert.equal(tekst,"Het komende uur is er een kleine kans op neerslag.");
  assert(!/model|overlapp|uurvak/i.test(tekst),tekst);
});

test("live polish: komend-uurtegel gebruikt dezelfde canonieke modaliteit",()=>{
  assert.equal(
    komendUurTekst({genoeg:true,status:"NEERSLAG_VERWACHT",kans:55,soort:"buien"}),
    "Het komende uur is neerslag mogelijk."
  );
  assert.equal(
    komendUurTekst({genoeg:true,status:"NEERSLAG_VERWACHT",kans:85,soort:"buien"}),
    "Het komende uur is er een grote kans op neerslag."
  );
});

test("live polish: alleen maan-events binnen de nacht blijven over",()=>{
  const start=1000,eind=5000;
  assert.deepEqual(maanEventsBinnenVenster(3000,500,start,eind),[{type:"op",ms:3000}]);
  assert.deepEqual(maanEventsBinnenVenster(6000,2000,start,eind),[{type:"onder",ms:2000}]);
});

test("live polish: desktop gebruikt 3 x 3 meetblokken en Nachtzicht drie rustige regels",()=>{
  const css=fs.readFileSync(path.join(__dirname,"live-polish.css"),"utf8"),correct=fs.readFileSync(path.join(__dirname,"senior-correctness-v2.js"),"utf8");
  assert(css.includes("grid-template-columns:repeat(3,minmax(0,1fr))"));
  assert(css.includes("min-width:1100px"));
  assert(correct.includes('class="nachtvenster"'));
  assert(correct.includes("Gem. zicht "));
  assert(!correct.includes("Gemiddeld zicht"));
});

if(process.exitCode) console.error("\nSenior-correctheidsronde: minstens één regressie mislukt.");
else console.log("\nSenior-correctheidsronde: "+n+" regressies geslaagd.");
