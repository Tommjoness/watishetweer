"use strict";
const assert=require("assert");
const {UITKOMST:U,beoordeelReserve:R,beoordeelOpenMeteo:O,samenvatting:S}=require("./bronbeschikbaarheid.js");

const dagen=n=>({time:Array.from({length:n},(_,i)=>"2026-10-"+String(10+i))});
const geldig={hourly:{time:Array.from({length:168},(_,i)=>i)},daily:dagen(7)};

/* Reserveroute */
assert.equal(R({status:200,bron:"visualcrossing",json:geldig}).uitkomst,U.BEWEZEN);
assert.equal(R({status:503,json:{beschikbaar:false}}).uitkomst,U.FOUTCONTRACT,"nette onbeschikbaarheid is geen datalevering");
assert.equal(R({fout:"timeout"}).uitkomst,U.NIET_UITGEVOERD,"timeout is geen acceptatie");
assert.throws(()=>R({status:200,bron:"onbekend",json:geldig}),/bekende bron/);
assert.throws(()=>R({status:200,bron:"weatherapi",json:{hourly:{time:[1,2]},daily:dagen(7)}}),/uurdata/);
assert.throws(()=>R({status:200,bron:"weatherapi",json:{hourly:geldig.hourly,daily:dagen(3)}}),/zeven dagen/,"gedeeltelijk resultaat faalt");
assert.throws(()=>R({status:503,json:{}}),/beschikbaar:false/);
assert.throws(()=>R({status:500,json:null}),/ongeldige status/);

/* Open-Meteo */
assert.equal(O({status:200,json:geldig}).uitkomst,U.BEWEZEN);
assert.equal(O({status:503,json:null}).uitkomst,U.STORING);
assert.equal(O({status:429,json:null}).uitkomst,U.STORING);
assert.equal(O({status:200,json:{}}).uitkomst,U.NIET_UITGEVOERD,"onvolledig antwoord telt niet als bewezen");
assert.equal(O({status:404,json:null}).uitkomst,U.NIET_UITGEVOERD);
assert.equal(O({fout:"time-out"}).uitkomst,U.NIET_UITGEVOERD);

/* Eindoordeel: alleen aantoonbare datalevering met bewezen reserve is volledig */
const om=u=>({uitkomst:u,reden:"x"});
assert.equal(S(om(U.BEWEZEN),om(U.BEWEZEN)).volledig,true);
assert.equal(S(om(U.STORING),om(U.BEWEZEN)).volledig,true);
const beide=S(om(U.STORING),om(U.FOUTCONTRACT));
assert.equal(beide.volledig,false);assert(/GEEN datalevering/.test(beide.tekst)&&/foutcontract/.test(beide.tekst));
assert.equal(S(om(U.BEWEZEN),om(U.FOUTCONTRACT)).volledig,false,"reserve onbewezen is beperkt");
assert.equal(S(om(U.BEWEZEN),om(U.NIET_UITGEVOERD)).volledig,false);
assert.equal(S(om(U.NIET_UITGEVOERD),om(U.BEWEZEN)).volledig,false);
assert(/ONVOLLEDIGE/.test(S(om(U.NIET_UITGEVOERD),om(U.NIET_UITGEVOERD)).tekst));
console.log("Bronbeschikbaarheid: datalevering, foutcontract, storing en niet-uitgevoerde controle blijven gescheiden; alleen bewezen datalevering is volledig.");
