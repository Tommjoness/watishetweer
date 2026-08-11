"use strict";

const assert=require("assert");
const p=require("./mobile-screenshot-polish.js");

const afnemend=p.maanFaseUitBeschrijving("afnemende sikkel, 7 procent verlicht");
const wassend=p.maanFaseUitBeschrijving("wassende sikkel, 7 procent verlicht");
assert(afnemend>0.75&&afnemend<1,"afnemende sikkel ligt aan het einde van de cyclus");
assert(wassend>0&&wassend<0.25,"wassende sikkel ligt aan het begin van de cyclus");
assert(Math.abs((1-afnemend)-wassend)<0.0001,"wassend en afnemend blijven elkaars spiegelbeeld");
assert.equal(p.maanFaseUitBeschrijving("nieuwe maan, 0 procent verlicht"),0);
assert.equal(p.maanFaseUitBeschrijving("volle maan, 100 procent verlicht"),0.5);
assert.equal(p.maanFaseUitBeschrijving("geen fase"),null);

const nieuw=p.maanFaseSvgV2(0,14);
const vol=p.maanFaseSvgV2(0.5,14);
const eerste=p.maanFaseSvgV2(0.25,14);
const laatste=p.maanFaseSvgV2(0.75,14);
assert(!nieuw.includes("maan-licht-vol"),"nieuwe maan heeft geen verlicht vlak");
assert(vol.includes("maan-licht-vol"),"volle maan vult de schijf volledig");
assert.notEqual(nieuw,vol,"nieuwe en volle maan zijn visueel verschillend");
assert.notEqual(eerste,laatste,"eerste en laatste kwartier staan aan een andere zijde");
for(const svg of [nieuw,vol,eerste,laatste]){
  assert(svg.includes("maan-fase-svg-v2"));
  assert(!/[🌑🌒🌓🌔🌕🌖🌗🌘]/u.test(svg));
}

for(const [score,oordeel] of [[0,"Ongunstig"],[3,"Ongunstig"],[4,"Matig"],[5,"Redelijk"],[6,"Redelijk"],[7,"Goed"],[8,"Goed"],[9,"Uitstekend"],[10,"Uitstekend"]]){
  assert.equal(p.nachtOordeelGetoond(score),oordeel,"Nachtzicht-oordeel bij zichtbare score "+score);
}
assert.equal(p.nachtBalkPercentageGetoond(6.4),60);
assert.equal(p.nachtBalkPercentageGetoond(6.6),70);
assert.deepEqual(p.nachtLabelVarianten("ma op di"),{lang:"ma op di",kort:"ma–di"});
assert.equal(p.nachtAdviesMetHorizon("Goed",2),"Goed");
assert.equal(p.nachtAdviesMetHorizon("Goed",3),"Voorlopige indicatie: goed");
assert.equal(p.nachtAdviesMetHorizon("Goed",5),"Globale indicatie: goed");

/* Open-Meteo hourly cloud_cover is een puntwaarde op het genoemde uur. De oude
   renderer maakte van goede punten om 22:00 en 23:00 ten onrechte een venster
   tot 00:00. Checkpoint 50 mag alleen de werkelijk goede modeluren claimen. */
assert.equal(p.corrigeerNachtVensterBron("Beste periode 22:00–00:00",0),"Beste modeluren 22:00–23:00");
assert.equal(p.corrigeerNachtVensterBron("Beste periode 23:00–02:00",1),"Beste modeluren 23:00–01:00");
assert.equal(p.corrigeerNachtVensterBron("Beste periode 22:00–00:00",3),"Gunstigste zicht in de avond");
assert.equal(p.corrigeerNachtVensterBron("Beste periode 23:00–02:00",5),"Waarschijnlijk gunstigste zicht van de avond tot de nacht");
assert.equal(p.corrigeerNachtVensterBron("Geen goed zichtvenster door bewolking",0),"Geen goed zichtvenster door bewolking");

assert.equal(p.pollenEenheid(1),"korrel/m³","één zichtbare korrel gebruikt enkelvoud");
assert.equal(p.pollenEenheid(1.4),"korrel/m³","een naar 1 afgeronde waarde gebruikt enkelvoud");
assert.equal(p.pollenEenheid(1.5),"korrels/m³","een naar 2 afgeronde waarde gebruikt meervoud");
assert.equal(p.pollenEenheid(0),"korrels/m³","nul gebruikt meervoud");
assert.equal(p.pollenEenheid(4),"korrels/m³","meerdere korrels gebruiken meervoud");

console.log("Mobiele screenshot-polish: checkpoint-50 Nachtzicht-, maanfase- en pollenregressies geslaagd.");
