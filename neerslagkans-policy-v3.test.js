"use strict";
const assert=require("assert");
const {kansNiveau,kansHoofd,kansZin,komendUurTekst,briefingZin,dagMomentZinsdeel,dagKansSamenvatting}=require("./neerslagkans-policy-v3.js");
let n=0;const test=(naam,fn)=>{try{fn();n++;console.log("OK  "+naam);}catch(e){console.error("FOUT "+naam+"\n  "+e.message);process.exitCode=1;}};

const grenzen=[
  [0,"DROOG"],[1,"ZEER_KLEIN"],[9,"ZEER_KLEIN"],[10,"KLEIN"],[29,"KLEIN"],
  [30,"MOGELIJK"],[69,"MOGELIJK"],[70,"GROOT"],[89,"GROOT"],[90,"ZEER_GROOT"],[100,"ZEER_GROOT"]
];
test("kansgrenzen volgen de afgesproken consumentencategorieën",()=>{
  for(const [k,verwacht] of grenzen) assert.equal(kansNiveau(k),verwacht,k+"%");
});

test("hoeveelheid maakt een lage kans nooit stellig",()=>{
  const a={genoeg:true,status:"NEERSLAG_VERWACHT",kans:20,hoeveelheid:8.4,soort:"regen",currentWet:false};
  const zin=kansZin(a,"de komende twee uur");
  assert(/kleine kans/i.test(zin),zin);
  assert(!/wordt .*verwacht/i.test(zin),zin);
  assert(/Als er neerslag valt/.test(zin),zin);
  assert.equal(kansHoofd(a),"20%");
  assert.equal(komendUurTekst(a),"Kleine kans op neerslag het komende uur.");
});

test("nul kans met meetbare hoeveelheid wordt niet als Droog voorgesteld",()=>{
  const a={genoeg:true,kans:0,hoeveelheid:0.8,soort:"regen"};
  assert.equal(kansHoofd(a),"Onzeker");
  assert(/spreken elkaar tegen/.test(kansZin(a,"de komende twee uur")));
  assert(/onzeker/.test(briefingZin(a)));
});

test("ook een komende spoorhoeveelheid blokkeert een droge claim",()=>{
  const a={genoeg:true,status:"SPOORHOEVEELHEID",kans:0,hoeveelheid:0.04,soort:"regen",currentWet:false,currentHoeveelheid:0};
  assert.equal(kansHoofd(a),"Onzeker");
  assert(/onzeker/.test(briefingZin(a)),briefingZin(a));
  assert(!/blijft.*droog/i.test(briefingZin(a)),briefingZin(a));
});

test("actuele positieve neerslag wint van een droge code of nul kans",()=>{
  const a={genoeg:true,status:"GEEN_KANS",currentWet:false,currentHoeveelheid:0.2,kans:0,hoeveelheid:0,soort:"neerslag"};
  assert.equal(kansHoofd(a),"Neerslag");
  assert.equal(kansZin(a,"de komende twee uur"),"Er valt nu neerslag.");
  assert.equal(komendUurTekst(a),"Er valt nu neerslag.");
  assert.equal(briefingZin(a),"Er valt nu neerslag.");
});

test("nul kans zonder nat signaal is een verwachting en geen absolute droogclaim",()=>{
  const a={genoeg:true,status:"GEEN_KANS",currentWet:false,currentHoeveelheid:0,kans:0,hoeveelheid:0,soort:"neerslag"};
  assert.equal(briefingZin(a),"De komende twee uur wordt geen neerslag verwacht.");
  assert(!/blijft.*droog/i.test(briefingZin(a)));
});

test("30, 70 en 90 procent krijgen zichtbaar verschillende zekerheid",()=>{
  assert(/mogelijk/.test(kansZin({genoeg:true,kans:30,hoeveelheid:0,soort:"regen"},"de komende twee uur")));
  assert(/grote kans/.test(kansZin({genoeg:true,kans:70,hoeveelheid:0,soort:"regen"},"de komende twee uur")));
  assert(/zeer grote kans/.test(kansZin({genoeg:true,kans:90,hoeveelheid:0,soort:"regen"},"de komende twee uur")));
});

test("briefing gebruikt dezelfde grenzen zonder percentages te herhalen",()=>{
  const metHoeveelheid={genoeg:true,soort:"regen",hoeveelheid:1};
  assert.equal(briefingZin({...metHoeveelheid,kans:9}),"De kans op neerslag in de komende twee uur is zeer klein.");
  assert.equal(briefingZin({...metHoeveelheid,kans:10}),"De komende twee uur is er een kleine kans op neerslag.");
  assert.equal(briefingZin({...metHoeveelheid,kans:30}),"In de komende twee uur is neerslag mogelijk.");
  assert.equal(briefingZin({...metHoeveelheid,kans:70}),"De komende twee uur is er een grote kans op neerslag.");
  assert.equal(briefingZin({...metHoeveelheid,kans:90}),"De komende twee uur is de kans op neerslag zeer groot.");
});

test("hoge kans zonder hoeveelheid benoemt hoeveelheidsonzekerheid",()=>{
  const groot=briefingZin({genoeg:true,kans:80,hoeveelheid:0,soort:"regen"});
  const zeerGroot=kansZin({genoeg:true,kans:95,hoeveelheid:0,soort:"regen"},"de komende twee uur");
  assert(/grote kans/.test(groot)&&/hoeveelheid is onzeker/.test(groot),groot);
  assert(/zeer grote kans/.test(zeerGroot)&&/hoeveelheid is onzeker/.test(zeerGroot),zeerGroot);
});

test("dagmomenten gebruiken lokale dagdelen en geen minuutprecisie",()=>{
  assert.equal(dagMomentZinsdeel("00:00")," in de nacht");
  assert.equal(dagMomentZinsdeel("05:00")," in de vroege ochtend");
  assert.equal(dagMomentZinsdeel("09:15")," in de ochtend");
  assert.equal(dagMomentZinsdeel("12:25")," in de middag");
  assert.equal(dagMomentZinsdeel("18:00")," in de avond");
  assert.equal(dagMomentZinsdeel("ongeldig"),"");
});

test("dagtekst laat kans de modaliteit bepalen zonder schijnpreciese kloktijd",()=>{
  const basis={genoeg:true,status:"NEERSLAG_VERWACHT",soort:"motregen",eersteTijd:"05:00",hoeveelheid:3};
  assert.equal(dagKansSamenvatting({...basis,kans:9},"Lichte motregen"),"Zeer kleine kans op lichte motregen in de vroege ochtend");
  assert.equal(dagKansSamenvatting({...basis,kans:10},"Lichte motregen"),"Kleine kans op lichte motregen in de vroege ochtend");
  assert.equal(dagKansSamenvatting({...basis,kans:30},"Lichte motregen"),"Lichte motregen mogelijk in de vroege ochtend");
  assert.equal(dagKansSamenvatting({...basis,kans:70},"Lichte motregen"),"Grote kans op lichte motregen in de vroege ochtend");
  assert.equal(dagKansSamenvatting({...basis,kans:90},"Lichte motregen"),"Zeer grote kans op lichte motregen in de vroege ochtend");
  assert.equal(dagKansSamenvatting({...basis,soort:"buien",kans:90},"Onweer"),"Zeer grote kans op onweer in de vroege ochtend");
  const middag=dagKansSamenvatting({...basis,kans:90,eersteTijd:"12:25"},"Lichte motregen");
  assert.equal(middag,"Zeer grote kans op lichte motregen in de middag");
  assert(!/12:25|rond\s+\d{1,2}:\d{2}/.test(middag),middag);
});

test("actuele neerslag blijft een actuele observatie en geen kanszin",()=>{
  const a={genoeg:true,status:"NEERSLAG_NU",currentWet:true,kans:10,soort:"regen",hoeveelheid:0.2};
  assert.equal(kansZin(a,"de komende twee uur"),"Het regent nu.");
  assert.equal(komendUurTekst(a),"Het regent nu.");
  const buien={...a,soort:"buien"};
  assert.equal(kansZin(buien,"de komende twee uur"),"Er vallen nu buien.");
  assert.equal(briefingZin(buien),"Er vallen nu buien.");
});

test("mogelijke neerslag vervoegt enkelvoud en meervoud",()=>{
  assert.match(kansZin({genoeg:true,kans:40,hoeveelheid:0,soort:"regen"},"de komende twee uur"),/^Regen is mogelijk/);
  assert.match(kansZin({genoeg:true,kans:40,hoeveelheid:0,soort:"buien"},"de komende twee uur"),/^Buien zijn mogelijk/);
});

if(process.exitCode) console.error("\nNeerslagkansbeleid v3: minstens één regressie mislukt.");
else console.log("\nNeerslagkansbeleid v3: "+n+" regressies geslaagd.");