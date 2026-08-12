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

/* Providerdata gaat later als data-lat/data-lon de zoek-UI in. Alleen geldige
   wereldcoördinaten en een niet-lege naam mogen die grens passeren; numerieke
   strings worden bewust naar echte numbers genormaliseerd. */
const extern=[
  {id:1,name:" Geldig ",country_code:"NL",latitude:"52.3676",longitude:"4.9041"},
  {id:2,name:"Attribuutinjectie",country_code:"NL",latitude:'52.1\" onmouseover=\"alert(1)',longitude:5},
  {id:3,name:"Te noordelijk",country_code:"XX",latitude:91,longitude:0},
  {id:4,name:"Te oostelijk",country_code:"XX",latitude:0,longitude:181},
  {id:5,name:"   ",country_code:"NL",latitude:52,longitude:5},
  {id:6,name:"Geen latitude",country_code:"NL",longitude:5}
];
const schoonExtern=h.dedupliceerZoekresultaten(extern);
assert.equal(schoonExtern.length,1,"malforme of onvolledige providerresultaten mogen de UI niet bereiken");
assert.equal(schoonExtern[0].name,"Geldig");
assert.strictEqual(schoonExtern[0].latitude,52.3676);
assert.strictEqual(schoonExtern[0].longitude,4.9041);
assert.equal(h.geldigeCoordinaat(-90,-90,90),-90);
assert.equal(h.geldigeCoordinaat(180,-180,180),180);
assert.equal(h.geldigeCoordinaat("",-90,90),null);
assert.equal(h.geldigeCoordinaat("Infinity",-90,90),null);

/* Dedupliceren mag de lijst niet onnodig kort maken. De requestlaag vraagt
   daarom twaalf kandidaten en de UI krijgt hoogstens zes unieke resultaten in
   de oorspronkelijke provider-volgorde terug. */
assert(/count=12/.test(h.verruimZoekUrl("https://geocoding-api.open-meteo.com/v1/search?name=ja&count=6&language=nl")));
assert(/count=20/.test(h.verruimZoekUrl("https://geocoding-api.open-meteo.com/v1/search?name=ja&count=20")),"een al ruimer zoekvenster mag niet worden verkleind");
const veel=[];
for(let i=0;i<8;i++){
  veel.push({id:i,name:"Plaats "+i,country_code:"NL",latitude:52+i/100,longitude:5});
  if(i<3)veel.push({id:i,name:"Plaats "+i,country_code:"NL",latitude:52+i/100,longitude:5});
}
assert.deepEqual(h.dedupliceerZoekresultaten(veel,6).map(x=>x.id),[0,1,2,3,4,5]);

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

console.log("Wereldwijde locatiehardening: validatie, uniek zoekvenster, deduplicatie en fail-closed plaatswaarschuwingen geslaagd.");
