"use strict";

const assert=require("assert");
const p=require("./final-27-polish.js");

assert.equal(p.recenteNeerslagKop(900),"Afgelopen kwartier");
assert.equal(p.recenteNeerslagKop(null),"Afgelopen kwartier");
assert.equal(p.recenteNeerslagKop(3600),"Afgelopen 60 minuten");

assert.equal(p.mmTekst(0),"0,0 mm");
assert.equal(p.mmTekst(0.04),"<0,1 mm");
assert.equal(p.mmTekst(1.44),"1,4 mm");
assert.equal(p.mmTekst(null),"");

const kansHoofd=a=>a.kans===0?"Droog":a.kans+"%";
const hoeveelheid=v=>p.mmTekst(v);
assert.deepEqual(
  p.dagNeerslagPresentatie({genoeg:true,kans:60,hoeveelheid:4.8},kansHoofd,hoeveelheid),
  {hoofd:"60%",hoeveelheid:"4,8 mm"}
);
assert.deepEqual(
  p.dagNeerslagPresentatie({genoeg:true,kans:0,hoeveelheid:0},kansHoofd,hoeveelheid),
  {hoofd:"Droog",hoeveelheid:""}
);
assert.deepEqual(
  p.dagNeerslagPresentatie({genoeg:true,kans:25,hoeveelheid:0},kansHoofd,hoeveelheid),
  {hoofd:"25%",hoeveelheid:""},
  "0 mm mag een echte niet-nulle neerslagkans niet naar 0% veranderen"
);
assert.deepEqual(
  p.dagNeerslagPresentatie({genoeg:true,kans:0,hoeveelheid:1.2},()=>"Onzeker",hoeveelheid),
  {hoofd:"Onzeker",hoeveelheid:"1,2 mm"},
  "tegenstrijdige bronvelden worden niet stilletjes gladgestreken"
);

assert.deepEqual(p.tooltipNeerslag(0,0),{kans:"0%",hoeveelheid:""});
assert.deepEqual(p.tooltipNeerslag(35,0),{kans:"35%",hoeveelheid:""});
assert.deepEqual(p.tooltipNeerslag(65,1.24),{kans:"65%",hoeveelheid:"1,2 mm"});
assert.deepEqual(p.tooltipNeerslag(null,2),{kans:"–",hoeveelheid:"2,0 mm"});

assert.deepEqual(p.nachtOordeelCompact("Voorlopige indicatie: uitstekend"),{oordeel:"Uitstekend",zekerheid:"voorlopig"});
assert.deepEqual(p.nachtOordeelCompact("Globale indicatie: matig"),{oordeel:"Matig",zekerheid:"indicatief"});
assert.equal(p.nachtVensterCompact("Beste periode van de avond tot de vroege ochtend"),"Beste periode: avond–vroege ochtend");
assert.equal(p.nachtVensterCompact("Waarschijnlijk beste periode in de nacht"),"Beste periode: waarschijnlijk 's nachts");
assert.equal(p.nachtVensterCompact("Beste periode 22:00–07:00"),"Beste periode 22:00–07:00");

assert.equal(p.bewolkingTekst(100,true),"Geheel bewolkt");
assert.equal(p.bewolkingTekst(99,true),"Vrijwel geheel bewolkt");
assert.equal(p.bewolkingTekst(10,false),"Vrijwel onbewolkt");
assert.equal(p.bewolkingTekst(20,false),"Overwegend helder");

const oordeel=v=>v<3?"laag":v<6?"matig":v<8?"hoog":"zeer hoog";
assert.equal(p.uvMomentTekst("2026-08-10T13:00",6,"2026-08-10T20:17",oordeel),"Piekte rond 13:00 · hoog.");
assert.equal(p.uvMomentTekst("2026-08-10T13:00",6,"2026-08-10T09:00",oordeel),"Piek rond 13:00 · hoog.");

assert.equal(p.cacheSleutel(52.367612,4.9041),"52.368,4.904");
assert.equal(p.cacheIsVers({op:1000},1000+p.CACHE_VERS_MS),true);
assert.equal(p.cacheIsVers({op:1000},1001+p.CACHE_VERS_MS),false);
const gesnoeid=p.cacheSnoei({a:{op:1},b:{op:2},c:{op:3},d:{op:4},e:{op:5},f:{op:6}});
assert.deepEqual(Object.keys(gesnoeid),["f","e","d","c","b"]);

const T=[14.4,13.6,18];
const A={text:"14°",i:0},B={text:"14°",i:1};
assert.strictEqual(p.kiesDubbelTemperatuurlabel(A,B,T),B,"bij het afgeronde minimum blijft het echte laagste punt staan");

console.log("Finale 27-punten polish: pure regressies geslaagd.");
