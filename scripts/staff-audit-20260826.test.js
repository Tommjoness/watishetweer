"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {waarschuwingTitelNl,waarschuwingTitelVoorBriefing,locatieSleutel,historyState,historyStateGeldig,formatMm}=require("./staff-audit-20260826.js");

const owner=fs.readFileSync(path.join(__dirname,"apply-staff-audit-20260826.js"),"utf8");
const css=fs.readFileSync(path.join(__dirname,"staff-audit-20260826.css"),"utf8");
assert(owner.includes('<body>\\n<div class="sheet" data-nosnippet>'),"staff-audit moet de data-nosnippet-eigenschap van de dynamische appcontainer behouden");
assert(owner.includes('<span data-nosnippet><a class="skiplink" href="#app">Ga naar hoofdinhoud</a></span>'),"de skiplink hoort in een span met data-nosnippet: Google toonde anders 'Ga naar hoofdinhoud' als beschrijving, en data-nosnippet werkt niet rechtstreeks op <a>");
assert(css.includes('.chartdata{margin:10px 0 0;min-width:0;max-width:100%;width:100%;box-sizing:border-box;overflow:hidden;contain:inline-size}'),"chartdata-details moet de brede tabel zowel visueel als intrinsiek lokaal bevatten");
assert(css.includes('.chartdata-scroll{margin-top:8px;width:100%;max-width:100%;min-width:0;box-sizing:border-box;overflow-x:auto;overflow-y:hidden'),"grafiektabel-scroller moet horizontaal scrollbaar blijven zonder onbedoelde verticale scrollcontainer te worden");
assert(!css.includes('.chartdata-scroll{margin-top:8px;width:100%;max-width:100%;min-width:0;box-sizing:border-box;overflow-x:hidden'),"de echte tabelscroller mag niet worden afgeknipt: brede data blijft horizontaal bereikbaar");

assert.deepEqual(waarschuwingTitelNl("Flood Watch"),{origineel:"Flood Watch",nederlands:"Waakzaamheid voor overstromingen",vertaald:true});
assert.deepEqual(waarschuwingTitelNl("Extreme Heat Warning"),{origineel:"Extreme Heat Warning",nederlands:"Waarschuwing voor extreme hitte",vertaald:true});
assert.deepEqual(waarschuwingTitelNl("Air Quality Alert"),{origineel:"Air Quality Alert",nederlands:"Luchtkwaliteitswaarschuwing",vertaald:true});
assert.deepEqual(waarschuwingTitelNl("Unknown Marine Statement"),{origineel:"Unknown Marine Statement",nederlands:"Unknown Marine Statement",vertaald:false});
assert.equal(waarschuwingTitelVoorBriefing("Flood Watch","US"),"Waakzaamheid voor overstromingen");
assert.equal(waarschuwingTitelVoorBriefing("Flood Watch","NL"),"Flood Watch");
/* Miami: twee verschillende meldingen van NWS Miami (Rip Current Statement en Coastal Flood Advisory) kregen
   geen eigen Nederlandse titel en dus allebei de algemene kop. Nu hebben ze twee onderscheidbare titels. */
assert.deepEqual(waarschuwingTitelNl("Rip Current Statement"),{origineel:"Rip Current Statement",nederlands:"Melding over gevaarlijke stromingen (rip currents)",vertaald:true});
assert.deepEqual(waarschuwingTitelNl("Coastal Flood Advisory"),{origineel:"Coastal Flood Advisory",nederlands:"Advies voor overstroming aan de kust",vertaald:true});
assert.equal(waarschuwingTitelVoorBriefing("Rip Current Statement","US"),"Melding over gevaarlijke stromingen (rip currents)");
assert.equal(waarschuwingTitelVoorBriefing("Rip Current Statement","NL"),"Rip Current Statement","buiten NWS-gebieden blijft de officiële titel ongewijzigd");

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

console.log("Staff-audit pure contracts groen: gecontroleerde warningmapping, geldige history-state, lokale inline-size containment, horizontaal-only tabelscroll en nul/null-neerslag blijven onderscheiden.");