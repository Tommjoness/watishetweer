"use strict";
const assert=require("assert");
const a=require("./final-audit-20260901.js");
const {vochtigheidPresentatie,zonPresentatie}=require("./final-consumer-polish-20260831-runtime.js");

/* Uurwaarde op 08:00 beschrijft volgens de provider 07:00–08:00. */
const tijden=["2026-09-01T06:00","2026-09-01T07:00","2026-09-01T08:00","2026-09-01T09:00","2026-09-01T10:00"];
let p=a.regenperiodenVoorGrafiek({grafiekTijden:tijden,bronTijden:tijden,neerslag:[0,0,0.8,0.4,0],bronStart:0,actueelBronIndex:1});
assert.equal(p.length,1);
assert.equal(p[0].van,"2026-09-01T07:00");
assert.equal(p[0].tot,"2026-09-01T09:00");
assert.equal(Math.round(p[0].som*10)/10,1.2);
assert.equal(a.regenSamenvatting(p),"Verwachte meetbare neerslag: 07:00–09:00 · 1,2 mm.");

/* Als exact één periode achter de compacte tweeregelgrens valt, toon die periode
   concreet in plaats van de vage tekst 'plus 1 latere periode'. */
const driePerioden=[
  {van:"2026-09-01T21:00",tot:"2026-09-02T00:00",som:0.3},
  {van:"2026-09-02T02:00",tot:"2026-09-02T04:00",som:2.1},
  {van:"2026-09-02T10:00",tot:"2026-09-02T13:00",som:3.8}
];
const drieSamenvatting=a.regenSamenvatting(driePerioden,2);
assert.equal(drieSamenvatting,"Verwachte meetbare neerslag: di 21:00–wo 00:00 · 0,3 mm; 02:00–04:00 · 2,1 mm; daarna 10:00–13:00 · 3,8 mm.");
assert(!/plus 1 latere periode/.test(drieSamenvatting),"Een bekende derde periode mag niet als vage resttelling worden verborgen.");

/* Hercontrole 4 oktober (R03): een periode die niet vandaag valt, krijgt
   "morgen" of de dag, zodat "19:00–20:00" nooit als vanavond wordt gelezen. */
const vandaag="2026-10-04";
assert.equal(a.regenSamenvatting([{van:"2026-10-04T19:00",tot:"2026-10-04T20:00",som:0.7}],2,vandaag),"Verwachte meetbare neerslag: 19:00–20:00 · 0,7 mm.","vandaag: geen dag");
assert.equal(a.regenSamenvatting([{van:"2026-10-05T19:00",tot:"2026-10-05T20:00",som:0.7}],2,vandaag),"Verwachte meetbare neerslag: morgen 19:00–20:00 · 0,7 mm.","morgen");
assert.equal(a.regenSamenvatting([{van:"2026-10-06T07:00",tot:"2026-10-06T09:00",som:1.2}],2,vandaag),"Verwachte meetbare neerslag: di 07:00–09:00 · 1,2 mm.","overmorgen: dag");
assert.equal(a.regenSamenvatting([{van:"2026-10-04T22:00",tot:"2026-10-05T01:00",som:2}],2,vandaag),"Verwachte meetbare neerslag: zo 22:00–ma 01:00 · 2,0 mm.","over middernacht: beide dagen");
assert.equal(a.regenSamenvatting([{van:"2026-12-31T19:00",tot:"2026-12-31T20:00",som:0.7}],2,"2026-12-30"),"Verwachte meetbare neerslag: morgen 19:00–20:00 · 0,7 mm.","morgen over de jaargrens");
{
  const v=require("../taal/vertaalkern.js").maakVertaler(require("../taal/en.js"));
  assert.equal(v.vertaal("Verwachte meetbare neerslag: morgen 19:00–20:00 · 0,7 mm."),"Expected measurable precipitation: tomorrow 19:00–20:00 · 0.7 mm.","Engels: tomorrow");
}

/* Verstreken uurwaarden horen niet in de standaard vooruitkijkende grafiektekst. */
p=a.regenperiodenVoorGrafiek({grafiekTijden:tijden,bronTijden:tijden,neerslag:[0,0.7,0.8,0,0],bronStart:0,actueelBronIndex:2});
assert.equal(p.length,0);
p=a.regenperiodenVoorGrafiek({grafiekTijden:tijden,bronTijden:tijden,neerslag:[0,0.7,0.8,0,0],bronStart:0,actueelBronIndex:2,toonVerstreken:true});
assert.equal(p.length,1);assert.equal(p[0].van,"2026-09-01T06:00");assert.equal(p[0].tot,"2026-09-01T08:00");

/* Een bronindexmismatch faalt gesloten; geen indexOf-koppeling rond DST. */
const dubbel=["2026-10-25T01:00","2026-10-25T02:00","2026-10-25T02:00","2026-10-25T03:00"];
p=a.regenperiodenVoorGrafiek({grafiekTijden:dubbel,bronTijden:dubbel,neerslag:[0,0.3,0.4,0],bronStart:0,actueelBronIndex:0});
assert.equal(p.length,1);assert.equal(Math.round(p[0].som*10)/10,0.7);

assert.equal(a.nwsTitelNl("Heat Advisory"),"Hitteadvies");
assert.equal(a.nwsTitelNl("Air Quality Alert"),"Luchtkwaliteitswaarschuwing");
assert.equal(a.nwsTitelNl("Flood Watch"),"Waakzaamheid voor overstromingen");
assert.equal(a.nwsTitelNl("Flood Warning"),"Waarschuwing voor overstromingen");
assert.equal(a.nwsTitelNl("Severe Thunderstorm Watch"),"Waakzaamheid voor zwaar onweer");
assert.equal(a.nwsTitelNl("Tornado Watch"),"Waakzaamheid voor tornado's");
assert.equal(a.nwsTitelNl("Winter Storm Warning"),"Waarschuwing voor zwaar winterweer");
assert.equal(a.nwsTitelNl("High Wind Warning"),"Waarschuwing voor zeer harde wind");
assert.equal(a.nwsTitelNl("Rip Current Statement"),"Melding over gevaarlijke stromingen (rip currents)");
assert.equal(a.nwsTitelNl("Coastal Flood Advisory"),"Advies voor overstroming aan de kust");
assert.equal(a.nwsTitelNl("Beach Hazards Statement"),"Beach Hazards Statement","de oudere tabel kent deze titel niet en geeft de officiële titel terug; de kaart toont dan zelf de specifieke gebeurtenis (nwsKop), nooit een algemene kop");
{
  /* De uitleg noemt alleen de soort melding en de uitgever: de gebeurtenis zelf staat in de kop. Een rip current krijgt
     daarnaast een korte uitleg van het vakwoord; de officiële tekst blijft ongemoeid. */
  const rip=a.nwsUitleg("Rip Current Statement","* WHAT...For the High Rip Current Risk, dangerous rip currents.");
  assert.equal(rip.uitleg,"De Amerikaanse weerdienst heeft voor deze locatie een officiële melding uitgegeven. Een rip current is een sterke, smalle stroming die van de kust af loopt en zwemmers snel verder het water in kan trekken.");
  const kust=a.nwsUitleg("Coastal Flood Advisory","* WHAT...Minor coastal flooding.");
  assert.equal(kust.uitleg,"De Amerikaanse weerdienst heeft voor deze locatie een advies uitgegeven.","geen vakwoord, dus ook geen extra uitleg");
  assert.equal(kust.toelichting,"");
  /* Fase 1 (25 oktober 2026): de algemene zin "een officiële waarschuwing" is weg. Ze noemde ook een statement of outlook een
     waarschuwing en verborg wat er werkelijk was uitgegeven. De soort volgt de officiële naam of het veld `klasse` van de server. */
  const zin=(t,melding)=>a.nwsUitleg(t,"x",melding).uitleg;
  assert.equal(zin("Beach Hazards Statement"),"De Amerikaanse weerdienst heeft voor deze locatie een officiële melding uitgegeven.");
  assert.equal(zin("Coastal Flood Warning"),"De Amerikaanse weerdienst heeft voor deze locatie een waarschuwing uitgegeven.");
  assert.equal(zin("Flood Watch"),"De Amerikaanse weerdienst heeft voor deze locatie een waakzaamheidsmelding (watch) uitgegeven.");
  assert.equal(zin("Small Craft Advisory"),"De Amerikaanse weerdienst heeft voor deze locatie een advies uitgegeven.");
  assert.equal(zin("Volcanic Fog Warning"),"De Amerikaanse weerdienst heeft voor deze locatie een waarschuwing uitgegeven.","onbekend type: soort volgt de naam");
  assert.equal(zin("Air Quality Alert",{klasse:"waarschuwing"}),"De Amerikaanse weerdienst heeft voor deze locatie een waarschuwing uitgegeven.","`klasse` van de server wint");
  for(const u of ["Beach Hazards Statement","Coastal Flood Warning","Hydrologic Outlook","x"])assert.doesNotMatch(zin(u),/officiële waarschuwing/,"geen algemene zin: "+u);
  /* Kop: Nederlands bij een zekere vertaling van de server, anders de oudere tabel, anders de officiële naam; nooit leeg of algemeen. */
  assert.deepEqual(a.nwsKop({titel:"Coastal Flood Warning",titelNl:"Waarschuwing voor overstroming aan de kust"}),{officieel:"Coastal Flood Warning",nl:"Waarschuwing voor overstroming aan de kust"});
  assert.deepEqual(a.nwsKop({titel:"Heat Advisory"}),{officieel:"Heat Advisory",nl:"Hitteadvies"},"antwoord zonder titelNl: oudere tabel als terugval");
  assert.deepEqual(a.nwsKop({titel:"Hydrologic Outlook",titelNl:null}),{officieel:"Hydrologic Outlook",nl:""},"onzekere vertaling: officiële naam");
  assert.deepEqual(a.nwsKop({titel:"Volcanic Fog Warning"}),{officieel:"Volcanic Fog Warning",nl:""});
  assert.deepEqual(a.nwsKop(null),{officieel:"",nl:""});
  /* Ernstregel: alleen wat de bron zegt, met bronvermelding; geen KNMI-kleurcode. */
  assert.equal(a.nwsErnstZin({ernstNl:"ernstig"}),"Ernst volgens de Amerikaanse weerdienst: ernstig.");
  assert.equal(a.nwsErnstZin({ernstNl:"niet opgegeven"}),"Ernst volgens de Amerikaanse weerdienst: niet opgegeven.");
  assert.equal(a.nwsErnstZin({}),"","antwoord zonder ernst: geen verzonnen label");
  assert.doesNotMatch(a.nwsErnstZin({ernstNl:"extreem"}),/code|geel|oranje|rood|KNMI/i);
}
assert.equal(a.fahrenheitContext("Heat Advisory","Heat index values of 100 to 110 degrees Fahrenheit."),"100–110 °F is ongeveer 38–43 °C.");
assert.equal(a.fahrenheitContext("Heat Advisory","Temperatures near 104 °F."),"104 °F is ongeveer 40 °C.");
assert.equal(a.fahrenheitContext("Heat Advisory","Heat index values up to 105."),"De Amerikaanse hitte-index loopt op tot 105 °F, ongeveer 41 °C.");
assert.equal(a.fahrenheitContext("Extreme Heat Warning","Heat index values up to 105."),"De Amerikaanse hitte-index loopt op tot 105 °F, ongeveer 41 °C.");
assert.equal(a.fahrenheitContext("Air Quality Alert","Index values up to 105."),"");
assert.equal(a.fahrenheitContext("Heat Advisory","Heat index values up to 41 °C."),"");
assert.match(a.nwsUitleg("Heat Advisory","100 to 110 degrees Fahrenheit").uitleg,/38–43 °C/);

/* Wereldwijde vochtigheid: relatieve waarde blijft meetwaarde; de zin zegt in gewone taal of het plakkerig is. */
assert.equal(vochtigheidPresentatie({temperature_2m:40,relative_humidity_2m:43,dew_point_2m:25}),"Zeer benauwd en plakkerig.");
assert.equal(vochtigheidPresentatie({temperature_2m:5,relative_humidity_2m:84,dew_point_2m:3}),"Koude lucht.");
assert.equal(vochtigheidPresentatie({temperature_2m:2,relative_humidity_2m:78,dew_point_2m:-1}),"Koude lucht.");
assert.equal(vochtigheidPresentatie({temperature_2m:2,relative_humidity_2m:93,dew_point_2m:1}),"Koude, vochtige lucht.");
assert.equal(vochtigheidPresentatie({temperature_2m:-49,relative_humidity_2m:67,dew_point_2m:-52}),"IJskoude lucht.");
assert.equal(vochtigheidPresentatie({temperature_2m:20,relative_humidity_2m:87}),"Voelt wat plakkerig aan.");
assert(!/droog/i.test(vochtigheidPresentatie({temperature_2m:40,relative_humidity_2m:43,dew_point_2m:25})),"Dubai mag nooit droog heten");
assert(!/^Vochtige lucht/i.test(vochtigheidPresentatie({temperature_2m:-49,relative_humidity_2m:67,dew_point_2m:-52})),"poollucht mag niet simpelweg vochtig heten");

/* Exact één minuut moet ook voor assistieve technologie enkelvoud zijn. */
const zon={timezone:"UTC",utc_offset_seconds:0,current:{is_day:0},daily:{sunrise:["2026-09-01T06:01"],sunset:["2026-09-01T18:00"]}};
const zp=zonPresentatie(zon,Date.UTC(2026,8,1,6,0));
assert.equal(zp.waardeTekst,"1 min");
assert.match(zp.aria,/over 1 minuut,/);
assert(!/1 minuten/.test(zp.aria));

console.log("Finale audithelpers groen: regeninterval/-samenvatting, Dubai/Longyearbyen/Ushuaia/Zuidpool, 1 minuut en consistente NWS titel/metrische uitleg zijn geborgd.");
