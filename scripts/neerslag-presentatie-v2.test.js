"use strict";

const assert=require("assert");
const fs=require("fs");
const vm=require("vm");
const path=require("path");

const bron=fs.readFileSync(path.join(__dirname,"neerslag-presentatie-v2.js"),"utf8");

function element(id){
  return {
    id,
    textContent:"",
    innerHTML:"",
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

let analyse={};
const kansHoofd=a=>!a||!a.genoeg?"–":a.kans===0?"Droog":a.kans==null?"–":Math.round(a.kans)+"%";
const context={
  console,
  S:{land:"NL",lat:52.259,lon:5.606,d:{current:{weather_code:3,is_day:1,cloud_cover:55}}},
  document:{getElementById:id=>els[id]||null},
  WeatherNowInterpretatie:{analyseerNeerslagData:()=>({...analyse})},
  WeatherNowKansbeleidV3:{
    kansHoofd,
    komendUurTekst:a=>a&&a.kans===12?"Kleine kans op neerslag het komende uur.":"Neerslagkans beschikbaar.",
    briefingZin:a=>a&&a.kans===12?"De komende twee uur is er een kleine kans op neerslag.":"Neerslagverwachting beschikbaar."
  },
  weatherNowActueleLokaleTijd:()=>new Date("2026-08-15T13:46:00Z"),
  txt:code=>({0:"Onbewolkt",1:"Licht bewolkt",2:"Half bewolkt",3:"Bewolkt",61:"Lichte regen"}[code]||"Verwachting"),
  icon:code=>'<svg data-code="'+code+'">icoon</svg>',
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

analyse={
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
   Dit bewaakt dat de nieuwe droge-KNMI-correctie wereldwijd geen modelcondities
   gaat herschrijven. */
analyse={genoeg:true,bronActueel:null,currentWet:false,currentRadarWet:false,status:"MOGELIJKE_NEERSLAG",kans:49,hoeveelheid:0,soort:"regen"};
context.meters();
assert.equal(kop.textContent,"Neerslagkans komend uur");
assert.equal(els.pop.innerHTML,"49<s>%</s>");
assert.equal(els.cond.textContent,"Neerslag","zonder officiële actuele meting wordt de bestaande hero niet overschreven");

/* De omgekeerde productieregressie: modelcode zegt regen, maar een verse officiële
   puntmeting zegt 0 mm/u. Dan moet de hero naar de actuele bewolkingscontext en
   blijft de toekomstige kleine kans van 12% zichtbaar. */
context.S.d.current.weather_code=61;
context.S.d.current.cloud_cover=55;
analyse={
  genoeg:true,bronActueel:"knmi-rtcor",currentIntensiteit:0,currentWet:false,currentRadarWet:false,
  status:"KLEINE_KANS",kans:12,bronHoeveelheid:"uurdata",hoeveelheid:0,soort:"regen"
};
context.meters();
assert.equal(els.cond.textContent,"Half bewolkt");
assert.equal(els.minicond.textContent,"Half bewolkt");
assert.match(els.nowicon.innerHTML,/data-code="2"/);
assert.equal(kop.textContent,"Neerslagkans komend uur");
assert.equal(els.pop.innerHTML,"12<s>%</s>");
assert.equal(els.popsub.textContent,"Kleine kans op neerslag het komende uur.");
context.briefing();
assert.match(els.brief.innerHTML,/^De komende twee uur is er een kleine kans op neerslag\./);
assert.doesNotMatch(els.brief.innerHTML,/(valt|regent) nu/i);
assert.match(els.brief.innerHTML,/<b>24 graden<\/b>/,"droge correctie bewaart latere briefingmarkup");

context.S.d.current.weather_code=3;
analyse={
  genoeg:true,bronActueel:"knmi-rtcor",currentIntensiteit:0,currentWet:false,currentRadarWet:false,
  status:"NEERSLAG_VERWACHT",kans:55,bronHoeveelheid:"knmi-nowcast",hoeveelheid:0.7,eersteTijd:"16:20"
};
context.meters();
assert.equal(kop.textContent,"Neerslag komend uur");
assert.match(els.pop.innerHTML,/0,7/);
assert.match(els.pop.innerHTML,/<s> mm<\/s>/);
assert.equal(els.popsub.textContent,"Vanaf ongeveer 16:20 wordt neerslag verwacht.");

els.nctext.textContent="Neerslag wordt verwacht.";
context.nowcast();
assert.equal(els.nctext.textContent,"Het is nu droog. Vanaf ongeveer 16:20 wordt neerslag verwacht. Verwachte hoeveelheid: ongeveer 0,7 mm.");

analyse={
  genoeg:true,bronActueel:"knmi-rtcor",currentIntensiteit:0.18,currentWet:true,currentRadarWet:true,
  status:"NEERSLAG_NU",kans:20,bronHoeveelheid:null,hoeveelheid:0
};
els.nctext.textContent="Er valt nu neerslag.";
context.nowcast();
assert.equal(els.nctext.textContent,"Er valt nu neerslag: 0,2 mm/u.","zonder nowcast mag geen droogtijd of hoeveelheid worden verzonnen");

console.log("Neerslagpresentatie v2: natte en droge officiële waarheid, kanslabel, briefing, hero en twee-uurscijfers geslaagd.");
