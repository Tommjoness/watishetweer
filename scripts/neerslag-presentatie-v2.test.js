"use strict";

const assert=require("assert");
const fs=require("fs");
const vm=require("vm");
const path=require("path");
const echtBeleid=require("../neerslagkans-policy-v3.js");

const bron=fs.readFileSync(path.join(__dirname,"neerslag-presentatie-v2.js"),"utf8");

function element(id){
  return {
    id,
    textContent:"",
    innerHTML:"",
    title:"",
    attrs:{},
    setAttribute(k,v){this.attrs[k]=String(v);},
    getAttribute(k){return this.attrs[k]||null;},
    closest(){return null;},
    querySelector(){return null;}
  };
}

const els={
  pop:element("pop"),popsub:element("popsub"),cond:element("cond"),minicond:element("minicond"),
  nowicon:element("nowicon"),brief:element("brief"),nctext:element("nctext"),nc:element("nc")
};
const kop=element("kop"),stat=element("stat");
stat.querySelector=sel=>sel===".eyebrow"?kop:null;
els.pop.closest=sel=>sel===".stat"?stat:null;

let basisAnalyse={};
const engine={
  STATUS_RANG:{ONVOLDOENDE_DATA:0,GEEN_KANS:1,ZEER_KLEINE_KANS:2,KLEINE_KANS:3,MOGELIJKE_NEERSLAG:4,GROTE_KANS_ZONDER_HOEVEELHEID:5,SPOORHOEVEELHEID:6,NEERSLAG_VERWACHT:7,NEERSLAG_NU:8},
  analyseerNeerslagData:()=>({...basisAnalyse})
};
const context={
  console,
  S:{land:"NL",lat:52.259,lon:5.606,d:{current:{weather_code:3,is_day:1,cloud_cover:55,precipitation:0}}},
  document:{getElementById:id=>els[id]||null},
  WeatherNowInterpretatie:engine,
  WeatherNowKansbeleidV3:echtBeleid,
  weatherNowActueleLokaleTijd:()=>new Date(),
  txt:code=>({0:"Onbewolkt",1:"Licht bewolkt",2:"Half bewolkt",3:"Bewolkt",61:"Lichte regen"}[code]||"Verwachting"),
  icon:code=>'<svg data-code="'+code+'">icoon</svg>',
  minibarBij(){
    const c=context.S.d.current,tekst=context.txt(c.weather_code,c.is_day!==0).toLowerCase();
    els.minicond.textContent=tekst;els.minicond.title=tekst;
  },
  meters(){
    kop.textContent="Neerslag komend uur";
    els.pop.innerHTML="49<s>%</s>";
    els.popsub.textContent="Komend uur is de neerslagkans 49%.";
  },
  briefing(){
    els.brief.innerHTML="In de komende twee uur is neerslag mogelijk. Ook later vandaag blijft neerslag mogelijk. Vandaag was het rond 13:00 het warmst, met <b>24 graden</b>.";
  },
  nowcast(){els.nctext.textContent="Er valt nu neerslag.";}
};
context.globalThis=context;
vm.runInNewContext(bron,context,{filename:"neerslag-presentatie-v2.js"});

assert(context.WeatherNowNeerslagPresentatieV2,"presentatie-API ontbreekt");
assert(!bron.includes('getElementById("prec")'),"nieuwe presentatie mag niet meer van de verwijderde #prec-tegel afhangen");

function zonderKnmi(){delete context.S.d.__knmiNeerslag;}

/* Reeds verrijkte natte analyse: presentatie verandert alleen de zichtbare dragers. */
zonderKnmi();
basisAnalyse={
  genoeg:true,bronActueel:"knmi-rtcor",currentIntensiteit:0.24,currentRadarWet:true,currentWet:true,
  status:"NEERSLAG_NU",soort:"neerslag",droogVanafTijd:"15:50",bronHoeveelheid:"knmi-nowcast",hoeveelheid:0,kans:49
};
context.meters();
assert.equal(kop.textContent,"Neerslag nu");
assert.match(els.pop.innerHTML,/0,2/);
assert.match(els.pop.innerHTML,/mm\/u/);
assert.match(els.popsub.textContent,/15:50/);
assert.equal(els.cond.textContent,"Neerslag");
assert.equal(els.minicond.textContent,"Neerslag");
assert.match(els.nowicon.innerHTML,/data-code="61"/);

context.briefing();
assert.match(els.brief.innerHTML,/^Er valt nu neerslag: 0,2 mm\/u\./);
assert.match(els.brief.innerHTML,/Rond 15:50 wordt het naar verwachting droog\./);
assert.match(els.brief.innerHTML,/Vandaag was het rond 13:00/);
assert.match(els.brief.innerHTML,/<b>24 graden<\/b>/,"latere briefingmarkup moet intact blijven");
assert(!/^In de komende twee uur is neerslag mogelijk/.test(els.brief.innerHTML));

context.nowcast();
assert.equal(els.nctext.textContent,"Er valt nu neerslag: 0,2 mm/u. Rond 15:50 wordt het naar verwachting droog.");
assert.match(els.nc.attrs["aria-label"],/0,2 mm\/u/);

/* Zonder officiële actuele meting blijft de presentatielaag van de modelhero af.
   Dit bewaakt dat de droge-KNMI-correctie wereldwijd geen modelcondities herschrijft. */
zonderKnmi();
basisAnalyse={genoeg:true,bronActueel:null,currentWet:false,currentRadarWet:false,status:"MOGELIJKE_NEERSLAG",kans:49,hoeveelheid:0,soort:"regen"};
context.meters();
assert.equal(kop.textContent,"Neerslagkans komend uur");
assert.equal(els.pop.innerHTML,"49<s>%</s>");
assert.equal(els.cond.textContent,"Neerslag","zonder officiële actuele meting wordt de bestaande hero niet overschreven");

/* De echte integratieregressie: de engine levert nog de modelanalyse (regen nu),
   terwijl een verse officiële KNMI-puntmeting op S.d 0 mm/u zegt. De presentatie
   moet via het echte kansbeleid zélf tot de verrijkte droge analyse komen. */
context.S.d.current.weather_code=61;
context.S.d.current.cloud_cover=55;
context.S.d.current.precipitation=0.2;
const nu=Date.now();
context.S.d.__knmiNeerslag={
  beschikbaar:true,
  opgehaaldOp:new Date(nu).toISOString(),
  actueel:{waarde:0,tijd:new Date(nu-2*60*1000).toISOString()},
  nowcast:null
};
basisAnalyse={
  genoeg:true,status:"NEERSLAG_NU",rang:engine.STATUS_RANG.NEERSLAG_NU,
  kans:12,kansDekking:1,hoeveelheid:0,bronHoeveelheid:"uurdata",
  currentWet:true,currentHoeveelheid:0.2,soort:"regen",startMin:nu/60000,duurMin:120
};
const verrijkt=context.WeatherNowNeerslagPresentatieV2.analyse(120);
assert.equal(verrijkt.bronActueel,"knmi-rtcor","presentatie moet officiële actuele bron zelf kunnen verrijken");
assert.equal(verrijkt.currentWet,false);
assert.equal(verrijkt.currentRadarWet,false);
assert.equal(verrijkt.status,"KLEINE_KANS");
context.meters();
assert.equal(els.cond.textContent,"Half bewolkt");
assert.equal(els.minicond.textContent,"Half bewolkt");
assert.match(els.nowicon.innerHTML,/data-code="2"/);
assert.equal(kop.textContent,"Neerslagkans komend uur");
assert.equal(els.pop.innerHTML,"12<s>%</s>");
assert.equal(els.popsub.textContent,"Het komende uur is er een kleine kans op neerslag.");
context.briefing();
assert.match(els.brief.innerHTML,/^De komende twee uur is er een kleine kans op neerslag\./);
assert.doesNotMatch(els.brief.innerHTML,/(valt|regent) nu/i);
assert.match(els.brief.innerHTML,/<b>24 graden<\/b>/,"droge correctie bewaart latere briefingmarkup");

/* De basis-minibalk schrijft in productie na een async KNMI-update opnieuw de
   ruwe modelconditie. De presentatiewrapper moet daar direct dezelfde officiële
   droge hero-waarheid overheen leggen, inclusief title voor afgekorte tekst. */
context.minibarBij();
assert.equal(els.minicond.textContent,"Half bewolkt","mobiele balk mag modelregen niet als laatste eigenaar terugschrijven");
assert.equal(els.minicond.title,"Half bewolkt");

/* Toekomstige KNMI-nowcastpresentatie blijft onaangeraakt door de fallback omdat
   deze analyse al een officiële bron draagt. */
basisAnalyse={
  genoeg:true,bronActueel:"knmi-rtcor",currentIntensiteit:0,currentWet:false,currentRadarWet:false,
  status:"NEERSLAG_VERWACHT",kans:55,bronHoeveelheid:"knmi-nowcast",hoeveelheid:0.7,eersteTijd:"16:20"
};
context.S.d.current.weather_code=3;
context.meters();
assert.equal(kop.textContent,"Neerslag komend uur");
assert.match(els.pop.innerHTML,/0,7/);
assert.match(els.pop.innerHTML,/<s> mm<\/s>/);
assert.equal(els.popsub.textContent,"Vanaf ongeveer 16:20 wordt neerslag verwacht.");

els.nctext.textContent="Neerslag wordt verwacht.";
context.nowcast();
assert.equal(els.nctext.textContent,"Het is nu droog. Vanaf ongeveer 16:20 wordt neerslag verwacht. Verwachte hoeveelheid: ongeveer 0,7 mm.");

basisAnalyse={
  genoeg:true,bronActueel:"knmi-rtcor",currentIntensiteit:0.18,currentWet:true,currentRadarWet:true,
  status:"NEERSLAG_NU",kans:20,bronHoeveelheid:null,hoeveelheid:0
};
els.nctext.textContent="Er valt nu neerslag.";
context.nowcast();
assert.equal(els.nctext.textContent,"Er valt nu neerslag: 0,2 mm/u.","zonder nowcast mag geen droogtijd of hoeveelheid worden verzonnen");

console.log("Neerslagpresentatie v2: echte KNMI-verrijking, nat/droog, kanslabel, briefing, hero, minibalk en twee-uurscijfers geslaagd.");
