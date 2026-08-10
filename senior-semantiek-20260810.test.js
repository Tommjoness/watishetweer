"use strict";

const assert=require("assert");
const fs=require("fs");
const pad=require("path");
const s=require("./senior-semantiek-20260810.js");

assert.equal(s.datumDagenVerschil("2026-08-10","2026-08-10"),0);
assert.equal(s.datumDagenVerschil("2026-08-10","2026-08-11"),1);
assert.equal(s.datumDagenVerschil("2026-08-31","2026-09-01"),1);
assert.equal(s.datumDagenVerschil("2026-12-31","2027-01-01"),1);
assert.equal(s.datumDagenVerschil("ongeldig","2026-08-11"),null);

assert.equal(s.dagdeelVanTijd("2026-08-10T00:30"),"nacht");
assert.equal(s.dagdeelVanTijd("05:00"),"vroege ochtend");
assert.equal(s.dagdeelVanTijd("08:00"),"ochtend");
assert.equal(s.dagdeelVanTijd("12:00"),"middag");
assert.equal(s.dagdeelVanTijd("18:00"),"avond");

assert.equal(s.forecastMomentZinsdeel("05:00",0),"rond 05:00");
assert.equal(s.forecastMomentZinsdeel("05:00",2),"rond 05:00");
assert.equal(s.forecastMomentZinsdeel("05:00",3),"tussen ongeveer 03:00 en 06:00");
assert.equal(s.forecastMomentZinsdeel("23:00",4),"tussen ongeveer 21:00 en 00:00");
assert.equal(s.forecastMomentZinsdeel("05:00",5),"in de vroege ochtend");
assert.equal(s.forecastMomentZinsdeel("14:00",7),"in de middag");

assert.equal(
  s.vervangExactForecastMoment("Lichte motregen mogelijk rond 05:00","05:00",6),
  "Lichte motregen mogelijk in de vroege ochtend"
);
assert.equal(
  s.vervangExactForecastMoment("Lichte motregen mogelijk rond 05:00","05:00",3),
  "Lichte motregen mogelijk tussen ongeveer 03:00 en 06:00"
);
assert.equal(
  s.vervangExactForecastMoment("Lichte motregen mogelijk rond 05:00","05:00",2),
  "Lichte motregen mogelijk rond 05:00"
);

assert.equal(
  s.briefingHistorieSemantiek("Vandaag was het rond 02:00 het warmst met <b>24&nbsp;graden</b>."),
  "De hoogste verwachte temperatuur voor vandaag lag rond 02:00 op <b>24&nbsp;graden</b>."
);
assert.equal(
  s.briefingHistorieSemantiek("Morgen wordt het maximaal <b>24 graden</b>."),
  "Morgen wordt het maximaal <b>24 graden</b>."
);

assert.deepEqual(s.nachtLabelVarianten("ma op di"),{lang:"ma op di",kort:"ma–di"});
assert.deepEqual(s.nachtLabelVarianten("vannacht"),{lang:"vannacht",kort:"vannacht"});
assert.equal(s.nachtAdviesMetHorizon("Uitstekend",2),"Uitstekend");
assert.equal(s.nachtAdviesMetHorizon("Uitstekend",3),"Voorlopige indicatie: uitstekend");
assert.equal(s.nachtAdviesMetHorizon("Uitstekend",5),"Globale indicatie: uitstekend");
assert.equal(s.nachtVensterMetHorizon("Beste periode 22:00–07:00",2),"Beste periode 22:00–07:00");
assert.equal(s.nachtVensterMetHorizon("Beste periode 22:00–07:00",3),"Beste periode van de avond tot de vroege ochtend");
assert.equal(s.nachtVensterMetHorizon("Beste periode 22:00–07:00",5),"Waarschijnlijk beste periode van de avond tot de vroege ochtend");

const daily={
  time:["2026-08-10","2026-08-11","2026-08-12"],
  sunrise:["2026-08-10T06:13","2026-08-11T06:15","2026-08-12T06:17"],
  sunset:["2026-08-10T21:14","2026-08-11T21:12","2026-08-12T21:10"]
};
const labels=d=>d==="2026-08-10"?"Vandaag":d==="2026-08-11"?"Morgen":"Op woensdag";
const lengte=i=>["15 uur 1 minuut daglicht","14 uur 57 minuten daglicht","14 uur 53 minuten daglicht"][i];
assert.deepEqual(s.zonInfoRijen(daily,"2026-08-10T16:04",null,lengte,labels),[
  {label:"Vandaag",items:["zon onder 21:14","15 uur 1 minuut daglicht"]},
  {label:"Morgen",items:["zon op 06:15"]}
]);
assert.deepEqual(s.zonInfoRijen(daily,"2026-08-10T05:59",null,lengte,labels),[
  {label:"Vandaag",items:["zon op 06:13","zon onder 21:14","15 uur 1 minuut daglicht"]}
]);
assert.deepEqual(s.zonInfoRijen(daily,"2026-08-10T23:59",null,lengte,labels),[
  {label:"Morgen",items:["zon op 06:15","zon onder 21:12","14 uur 57 minuten daglicht"]}
]);
assert.deepEqual(s.zonInfoRijen(daily,"2026-08-11T00:01",null,lengte,labels),[
  {label:"Morgen",items:["zon op 06:15","zon onder 21:12","14 uur 57 minuten daglicht"]}
]);
assert.deepEqual(s.zonInfoRijen(daily,"2026-08-10T16:04",2,lengte,labels),[
  {label:"Op woensdag",items:["zon op 06:17","zon onder 21:10","14 uur 53 minuten daglicht"]}
]);
const polar={time:["2026-12-20"],sunrise:[null],sunset:[null]};
assert.deepEqual(s.zonInfoRijen(polar,"2026-12-20T12:00",null,()=>"poolnacht",()=>"Vandaag"),[
  {label:"Vandaag",items:["poolnacht"]}
]);

assert.deepEqual(s.tooltipCompactMaten(224,136),{breedte:201.6,hoogte:122.4,inzet:12,rijHoogte:15});

const css=fs.readFileSync(pad.join(__dirname,"senior-semantiek-20260810.css"),"utf8");
assert(css.includes(".nachtlabel-kort"));
assert(css.includes("font-size:12px"));
assert(css.includes("#suntimes.senior-zoninfo"));
assert(!css.includes("display:none}/* attribution"));

console.log("Senior-semantiek 20260810: horizon-, zon-, Nachtzicht- en compactheidsregressies geslaagd.");
