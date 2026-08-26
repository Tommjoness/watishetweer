"use strict";

const assert=require("assert");
const {waarschuwingTitelNl,locatieSleutel,historyState,historyStateGeldig,formatMm}=require("./staff-audit-20260826.js");

assert.deepEqual(waarschuwingTitelNl("Flood Watch"),{origineel:"Flood Watch",nederlands:"Waakzaamheid voor overstromingen",vertaald:true});
assert.deepEqual(waarschuwingTitelNl("Extreme Heat Warning"),{origineel:"Extreme Heat Warning",nederlands:"Waarschuwing voor extreme hitte",vertaald:true});
assert.deepEqual(waarschuwingTitelNl("Air Quality Alert"),{origineel:"Air Quality Alert",nederlands:"Luchtkwaliteitswaarschuwing",vertaald:true});
assert.deepEqual(waarschuwingTitelNl("Unknown Marine Statement"),{origineel:"Unknown Marine Statement",nederlands:"Unknown Marine Statement",vertaald:false});

assert.equal(locatieSleutel("52.3676",4.9041,"Amsterdam"),"52.36760|4.90410|amsterdam");
assert.equal(locatieSleutel(null,4.9,"Amsterdam"),null);
const s=historyState(52.3676,4.9041,"Amsterdam","nl",false);
assert.deepEqual(s,{weatherNowLocation:1,lat:52.3676,lon:4.9041,plaats:"Amsterdam",land:"NL",route:false});
assert(historyStateGeldig(s));
assert(!historyStateGeldig({weatherNowLocation:1,lat:999,lon:4,plaats:"Fout"}));
assert.equal(historyState(91,4,"Fout","NL",false),null);
assert.equal(historyState(52,181,"Fout","NL",false),null);

assert.equal(formatMm(null),"–");
assert.equal(formatMm(-1),"–");
assert.equal(formatMm(0),"0,0 mm");
assert.equal(formatMm(0.04),"<0,1 mm");
assert.equal(formatMm(31.2),"31,2 mm");

console.log("Staff-audit pure contracts groen: gecontroleerde warningmapping, geldige history-state en nul/null-neerslag blijven onderscheiden.");
