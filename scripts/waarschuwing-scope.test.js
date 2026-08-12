"use strict";
const assert=require("assert");
const {alleenPlaatsgebonden}=require("../lib/waarschuwing-scope.cjs");

const landfeed=alleenPlaatsgebonden({
  bron:"MeteoAlarm italy",dekking:true,plaatsSpecifiek:false,land:"IT",
  lijst:[
    {titel:"Red High-temperature Warning issued for Italy - Sardegna",plaatsSpecifiek:false,landelijk:true},
    {titel:"Red High-temperature Warning issued for Italy - Sicilia",plaatsSpecifiek:false,landelijk:true}
  ]
});
assert.equal(landfeed.dekking,false);
assert.equal(landfeed.lijst.length,0);
assert.equal(landfeed.plaatsSpecifiek,false);
assert.equal(landfeed.reden,"geen plaats-specifieke dekking");

const punt=alleenPlaatsgebonden({
  bron:"National Weather Service",dekking:true,plaatsSpecifiek:true,
  lijst:[{titel:"Heat Advisory",plaatsSpecifiek:true,scope:"punt"}]
});
assert.equal(punt.dekking,true);
assert.equal(punt.lijst.length,1);

const gebied=alleenPlaatsgebonden({
  bron:"MeteoAlarm",dekking:true,plaatsSpecifiek:true,
  lijst:[
    {titel:"Lokale waarschuwing",plaatsSpecifiek:true,landelijk:false,scope:"gebied"},
    {titel:"Niet bewezen",plaatsSpecifiek:false,landelijk:true,scope:"land"}
  ]
});
assert.deepEqual(gebied.lijst.map(x=>x.titel),["Lokale waarschuwing"]);

const geenActief=alleenPlaatsgebonden({bron:"NWS",dekking:true,plaatsSpecifiek:true,lijst:[]});
assert.equal(geenActief.dekking,true);
assert.deepEqual(geenActief.lijst,[]);

const toekomst=alleenPlaatsgebonden({dekking:true,lijst:[{titel:"Nieuwe provider zonder scope"}]});
assert.equal(toekomst.dekking,false);
assert.deepEqual(toekomst.lijst,[]);

const onbereikbaar=alleenPlaatsgebonden({dekking:false,reden:"bron onbereikbaar",lijst:[{titel:"mag nooit lekken"}]});
assert.equal(onbereikbaar.dekking,false);
assert.deepEqual(onbereikbaar.lijst,[]);
assert.equal(onbereikbaar.reden,"bron onbereikbaar");

console.log("Waarschuwingsscope servergrens: punt/gebied toegestaan, land/onbewezen fail-closed geslaagd.");
