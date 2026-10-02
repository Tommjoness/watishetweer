"use strict";
const assert=require("assert");
const {maakVertaler,getal,isNeutraal,schoon}=require("../taal/vertaalkern.js");
const v=maakVertaler({
  exact:{"Neerslagkans":"Chance of rain","Bekijk per maand":"View by month"},
  patronen:[
    [/^Windstoten tot (\d+) km\/u\.$/,"Gusts up to $1 km/h."],
    [/^Het regent nu\.$/,"It is raining now."],
    [/^Per jaar valt er ongeveer ([\d.]+) mm neerslag\.$/,(m,h)=>`About ${h.getal(m[1])} mm of precipitation falls each year.`]
  ]
});
assert.equal(v.vertaal("Neerslagkans"),"Chance of rain");
assert.equal(v.vertaal("  Bekijk per   maand "),"View by month","witruimte en NBSP genormaliseerd");
assert.equal(v.vertaal("Windstoten tot 95 km/u."),"Gusts up to 95 km/h.");
assert.equal(v.vertaal("Het regent nu. Windstoten tot 60 km/u."),"It is raining now. Gusts up to 60 km/h.","meerdere zinnen");
assert.equal(v.vertaal("Het regent nu. Onbekende zin."),null,"geen halve vertaling");
assert.equal(v.vertaal("Per jaar valt er ongeveer 1.750 mm neerslag."),"About 1,750 mm of precipitation falls each year.");
assert.equal(getal("0,9"),"0.9");assert.equal(getal("1.750"),"1,750");assert.equal(getal("−1,4"),"−1.4");
assert(isNeutraal("12:00–15:00")&&isNeutraal("0,9 mm")&&isNeutraal("95 km/h")&&isNeutraal("17°")&&!isNeutraal("Regen"));
assert(isNeutraal("Almere",new Set(["Almere"])));
assert.throws(()=>maakVertaler({patronen:[[/Regen/,"x"]]}),/hele tekst/,"patronen moeten verankerd zijn");
assert.equal(schoon("Regen­dagen"),"Regendagen");
/* De app leest soms een al vertaalde schermtekst terug en plakt die voor de
   Nederlandse bron (aria-label van de neerslaggrafiek). Al Engelse zinnen die
   deze vertaler zelf maakte blijven staan, en een herhaling verschijnt één keer. */
assert.equal(v.vertaal("It is raining now. Het regent nu. Windstoten tot 60 km/u."),"It is raining now. Gusts up to 60 km/h.","al Engelse zin plus eigen bron: één keer");
assert.equal(v.vertaal("It is raining now. Gusts up to 60 km/h. Het regent nu. Windstoten tot 60 km/u."),"It is raining now. Gusts up to 60 km/h.","herhaald blok van twee zinnen: één keer");
assert.equal(v.vertaal("Chance of rain. Onbekende zin."),null,"Engels erbij maakt een onbekende zin niet vertaald");
assert.equal(v.vertaal("Some random English sentence. Het regent nu."),null,"alleen Engels dat de vertaler zelf maakte telt als vertaald");
/* Officiële Engelse brontekst (MeteoAlarm en-GB) blijft letterlijk en telt als vertaald. */
const echt=require("../taal/en.js");
const bron=new Set(["Yellow warning for fog","Widespread fog is expected."]);
const vb=maakVertaler(echt,{bronEngels:bron});
assert.equal(vb.vertaal("Yellow warning for fog"),"Yellow warning for fog","officiële Engelse titel blijft staan");
assert.equal(vb.vertaal("Widespread fog is expected. Geldig tot 18:00."),"Widespread fog is expected. Valid until 18:00.","officiële tekst plus eigen Nederlandse aanvulling");
assert.equal(vb.vertaal("Officiële weerwaarschuwing (geel): Yellow warning for fog."),"Official weather warning (yellow): Yellow warning for fog.","briefing met officiële Engelse titel");
assert.deepEqual(vb.onvertaald("Yellow warning for fog"),[],"bewaker telt officiële Engelse tekst niet als onvertaald");
assert.equal(maakVertaler(echt).vertaal("Yellow warning for fog"),null,"zonder bron blijft onbekend Engels onbekend");
console.log("Vertaalkern: exact, patronen, meerzins-blokken, getalnotatie, neutrale teksten, officiële Engelse brontekst en veiligheidsregels geslaagd.");
