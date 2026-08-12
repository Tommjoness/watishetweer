"use strict";
const assert=require("assert");
const h=require("./global-location-hardening.js");

/* Zoekresultaten: identieke GeoNames-id's zijn dezelfde plaats, ook als een
   provider minieme metadata-/coordinatenverschillen terugstuurt. */
const dubbel=[
  {id:123,name:"Ja",admin1:"Janub-Darfur",country_code:"SD",latitude:11.1,longitude:24.2},
  {id:123,name:"Ja",admin1:"Janub-Darfur",country_code:"SD",latitude:11.1001,longitude:24.2001},
  {id:456,name:"Ja",admin1:"Janub-Darfur",country_code:"SD",latitude:11.8,longitude:24.8}
];
assert.equal(h.dedupliceerZoekresultaten(dubbel).length,2,"dezelfde provider-id moet eenmaal worden getoond");

/* Zonder id dedupliceren we alleen bij dezelfde genormaliseerde plaatsmetadata
   én coordinaten. Twee echte plaatsen met dezelfde naam blijven dus bestaan. */
const zonderId=[
  {name:" Né ",admin1:"Ligurië",country_code:"IT",latitude:44.356,longitude:9.388},
  {name:"né",admin1:"Ligurië",country_code:"it",latitude:44.356,longitude:9.388},
  {name:"Né",admin1:"Ligurië",country_code:"IT",latitude:44.456,longitude:9.488}
];
assert.equal(h.dedupliceerZoekresultaten(zonderId).length,2,"gelijke fallback-identiteit dedupliceert, andere coordinaten blijven apart");
assert.deepEqual(h.dedupliceerZoekresultaten(null),[]);

/* Waarschuwingen zijn fail-closed: alleen aantoonbaar punt-/gebiedspecifieke
   kaarten mogen door. Een landfeed mag nooit regionale waarschuwingen als
   plaatswaarschuwing tonen. */
const atom=h.alleenPlaatsgebondenWaarschuwingen({
  dekking:true,plaatsSpecifiek:false,bron:"MeteoAlarm landfeed",
  lijst:[{titel:"Red warning Sardegna",landelijk:true,plaatsSpecifiek:false}]
});
assert.equal(atom.dekking,false);
assert.equal(atom.lijst.length,0);
assert.equal(atom.reden,"geen plaats-specifieke dekking");

const gemengd=h.alleenPlaatsgebondenWaarschuwingen({
  dekking:true,plaatsSpecifiek:true,
  lijst:[
    {titel:"Raakt gekozen punt",plaatsSpecifiek:true,landelijk:false},
    {titel:"Onbekend gebied",plaatsSpecifiek:false,landelijk:true}
  ]
});
assert.equal(gemengd.dekking,true);
assert.deepEqual(gemengd.lijst.map(x=>x.titel),["Raakt gekozen punt"]);

const schoon=h.alleenPlaatsgebondenWaarschuwingen({dekking:true,plaatsSpecifiek:true,lijst:[]});
assert.equal(schoon.dekking,true,"een bewezen puntbron met nul actieve waarschuwingen blijft geldige dekking");
assert.deepEqual(schoon.lijst,[]);

const ambigu=h.alleenPlaatsgebondenWaarschuwingen({dekking:true,lijst:[{titel:"Geen scope metadata"}]});
assert.equal(ambigu.dekking,false,"toekomstige brondata zonder plaatsbewijs mag niet als kaart verschijnen");
assert.equal(ambigu.lijst.length,0);

const nws=h.alleenPlaatsgebondenWaarschuwingen({
  dekking:true,plaatsSpecifiek:true,
  lijst:[{titel:"Heat Advisory",plaatsSpecifiek:true,landelijk:false}]
});
assert.equal(nws.dekking,true);
assert.equal(nws.lijst.length,1);

console.log("Wereldwijde locatiehardening: zoekdeduplicatie en fail-closed plaatswaarschuwingen geslaagd.");
