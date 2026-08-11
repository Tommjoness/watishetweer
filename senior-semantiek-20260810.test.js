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

assert.equal(s.vervangExactForecastMoment("Lichte motregen mogelijk rond 05:00","05:00",6),"Lichte motregen mogelijk in de vroege ochtend");
assert.equal(s.vervangExactForecastMoment("Lichte motregen mogelijk rond 05:00","05:00",3),"Lichte motregen mogelijk tussen ongeveer 03:00 en 06:00");
assert.equal(s.vervangExactForecastMoment("Lichte motregen mogelijk rond 05:00","05:00",2),"Lichte motregen mogelijk rond 05:00");

assert.equal(
  s.briefingHistorieSemantiek("Vandaag was het rond 02:00 het warmst met <b>24&nbsp;graden</b>."),
  "Vandaag was het rond 02:00 het warmst, met <b>24&nbsp;graden</b>."
);
assert.equal(s.briefingHistorieSemantiek("Morgen wordt het maximaal <b>24 graden</b>."),"Morgen wordt het maximaal <b>24 graden</b>.");

assert.equal(s.daglichtGrammatica("15 uur en 1 minuten daglicht"),"15 uur en 1 minuut daglicht");
assert.equal(s.daglichtGrammatica("15 uur en 0 minuten daglicht"),"15 uur en 0 minuten daglicht");
assert.equal(s.daglichtGrammatica("15 uur en 2 minuten daglicht"),"15 uur en 2 minuten daglicht");

assert.deepEqual(s.nachtLabelVarianten("ma op di"),{lang:"ma op di",kort:"ma–di"});
assert.deepEqual(s.nachtLabelVarianten("vannacht"),{lang:"vannacht",kort:"vannacht"});
assert.equal(s.nachtAdviesMetHorizon("Uitstekend",2),"Uitstekend");
assert.equal(s.nachtAdviesMetHorizon("Uitstekend",3),"Voorlopige indicatie: uitstekend");
assert.equal(s.nachtAdviesMetHorizon("Uitstekend",5),"Globale indicatie: uitstekend");
assert.equal(s.nachtVensterMetHorizon("Beste periode 22:00–07:00",2),"Beste periode 22:00–07:00");
assert.equal(s.nachtVensterMetHorizon("Beste periode 22:00–07:00",3),"Beste periode van de avond tot de vroege ochtend");
assert.equal(s.nachtVensterMetHorizon("Beste periode 22:00–07:00",5),"Waarschijnlijk beste periode van de avond tot de vroege ochtend");

for(const [score,oordeel] of [[0,"Ongunstig"],[3,"Ongunstig"],[4,"Matig"],[5,"Redelijk"],[6,"Redelijk"],[7,"Goed"],[8,"Goed"],[9,"Uitstekend"],[10,"Uitstekend"]]){
  assert.equal(s.nachtOordeelGetoond(score),oordeel,"zichtscore "+score);
}
assert.equal(s.nachtBalkPercentageGetoond(6.4),60);
assert.equal(s.nachtBalkPercentageGetoond(6.6),70);
assert.equal(s.nachtBalkPercentageGetoond(10.4),100);
for(const [uv,oordeel] of [[2,"laag"],[3,"matig"],[5,"matig"],[6,"hoog"],[7,"hoog"],[8,"zeer hoog"],[10,"zeer hoog"],[11,"extreem"]]){
  assert.equal(s.uvOordeelGetoond(uv),oordeel,"UV "+uv);
}
assert.equal(s.bewolkingOordeelGetoond(14.4,true),"Vrijwel onbewolkt");
assert.equal(s.bewolkingOordeelGetoond(14.6,true),"Overwegend zonnig");
assert.equal(s.bewolkingOordeelGetoond(14.6,false),"Overwegend helder");
assert.equal(s.bewolkingOordeelGetoond(39.6,true),"Half bewolkt");
assert.equal(s.bewolkingOordeelGetoond(69.6,true),"Zwaar bewolkt");
assert.equal(s.bewolkingOordeelGetoond(94.6,true),"Vrijwel geheel bewolkt");
assert.equal(s.bewolkingOordeelGetoond(100,true),"Geheel bewolkt");
assert.equal(s.actueleBewolkingsomschrijving(2,79,true,"Half bewolkt"),"Zwaar bewolkt");
assert.equal(s.actueleBewolkingsomschrijving(61,79,true,"Lichte regen"),"Lichte regen");
assert.equal(s.bewolkingscodeUitPercentage(14.9),0);
assert.equal(s.bewolkingscodeUitPercentage(15),1);
assert.equal(s.bewolkingscodeUitPercentage(40),2);
assert.equal(s.bewolkingscodeUitPercentage(70),3);
assert.deepEqual(s.aqiOordeelGetoond(20,true),{tekst:"goed",kleur:"teal"});
assert.deepEqual(s.aqiOordeelGetoond(21,true),{tekst:"redelijk",kleur:"teal"});
assert.deepEqual(s.aqiOordeelGetoond(40,true),{tekst:"redelijk",kleur:"teal"});
assert.deepEqual(s.aqiOordeelGetoond(41,true),{tekst:"matig",kleur:"ink"});
assert.deepEqual(s.aqiOordeelGetoond(50,false),{tekst:"goed",kleur:"teal"});
assert.deepEqual(s.aqiOordeelGetoond(51,false),{tekst:"redelijk",kleur:"teal"});
assert.deepEqual(s.pollenOordeelGetoond(9),{tekst:"laag",kleur:"ink45"});
assert.deepEqual(s.pollenOordeelGetoond(10),{tekst:"matig",kleur:"ink"});
assert.deepEqual(s.pollenOordeelGetoond(49),{tekst:"matig",kleur:"ink"});
assert.deepEqual(s.pollenOordeelGetoond(50),{tekst:"hoog",kleur:"carmine"});
assert.deepEqual(s.pollenOordeelGetoond(199),{tekst:"hoog",kleur:"carmine"});
assert.deepEqual(s.pollenOordeelGetoond(200),{tekst:"zeer hoog",kleur:"carmine"});
assert.equal(s.zichtOordeelGetoond(0.9,false),"Slecht zicht, minder dan een kilometer.");
assert.equal(s.zichtOordeelGetoond(1.0,false),"Beperkt zicht.");
assert.equal(s.zichtOordeelGetoond(3.9,false),"Beperkt zicht.");
assert.equal(s.zichtOordeelGetoond(4.0,false),"Redelijk zicht.");
assert.equal(s.zichtOordeelGetoond(9.9,false),"Redelijk zicht.");
assert.equal(s.zichtOordeelGetoond(10,false),"Goed zicht, ongeveer tien kilometer.");
assert.equal(s.zichtOordeelGetoond(10,true),"Goed zicht, tien kilometer of meer.");
assert.equal(s.zonurenOordeelGetoond(1.9),"Weinig zon vandaag");
assert.equal(s.zonurenOordeelGetoond(2.0),"Een aantal zonuren vandaag");
assert.equal(s.zonurenOordeelGetoond(7.0),"Een aantal zonuren vandaag");
assert.equal(s.zonurenOordeelGetoond(7.1),"Vandaag redelijk wat zon");
assert.equal(s.neerslagWeerCode(3),false);
assert.equal(s.neerslagWeerCode(51),true);
assert.equal(s.neerslagWeerCode(99),true);
assert.equal(s.maanFaseUitSymbool("🌘"),7/8);
assert.equal(s.maanFaseUitSymbool("🌘\uFE0E"),7/8);
const maanSvg=s.maanFaseSvg(7/8,11);
assert(maanSvg.includes("<svg"));
assert(maanSvg.includes("currentColor"));
assert(!/[🌑🌒🌓🌔🌕🌖🌗🌘]/u.test(maanSvg));
const maanHtml=s.maanSymboolNaarSvgInHtml('🌘<span>afnemende sikkel</span>',12);
assert(maanHtml.startsWith('<svg'));
assert(maanHtml.includes('<span>afnemende sikkel</span>'));
assert(!/[🌑🌒🌓🌔🌕🌖🌗🌘]/u.test(maanHtml));
const maanHtmlVs=s.maanSymboolNaarSvgInHtml('🌘\uFE0F tekst',12);
assert(!maanHtmlVs.includes('\uFE0F'));
assert(!/[🌑🌒🌓🌔🌕🌖🌗🌘]/u.test(maanHtmlVs));

const daily={
  time:["2026-08-10","2026-08-11","2026-08-12"],
  sunrise:["2026-08-10T06:13","2026-08-11T06:15","2026-08-12T06:17"],
  sunset:["2026-08-10T21:14","2026-08-11T21:12","2026-08-12T21:10"]
};
const labels=d=>d==="2026-08-10"?"Vandaag":d==="2026-08-11"?"Morgen":"Op woensdag";
const lengte=i=>["15 uur en 1 minuten daglicht","14 uur en 57 minuten daglicht","14 uur en 53 minuten daglicht"][i];
assert.deepEqual(s.zonInfoRijen(daily,"2026-08-10T16:04",null,lengte,labels),[
  {label:"Vandaag",items:["zon onder 21:14","15 uur en 1 minuut daglicht"]},
  {label:"Morgen",items:["zon op 06:15"]}
]);
assert.deepEqual(s.zonInfoRijen(daily,"2026-08-10T05:59",null,lengte,labels),[
  {label:"Vandaag",items:["zon op 06:13","zon onder 21:14","15 uur en 1 minuut daglicht"]}
]);
assert.deepEqual(s.zonInfoRijen(daily,"2026-08-10T23:59",null,lengte,labels),[
  {label:"Morgen",items:["zon op 06:15","zon onder 21:12","14 uur en 57 minuten daglicht"]}
]);
assert.deepEqual(s.zonInfoRijen(daily,"2026-08-11T00:01",null,lengte,labels),[
  {label:"Morgen",items:["zon op 06:15","zon onder 21:12","14 uur en 57 minuten daglicht"]}
]);
assert.deepEqual(s.zonInfoRijen(daily,"2026-08-10T16:04",2,lengte,labels),[
  {label:"Op woensdag",items:["zon op 06:17","zon onder 21:10","14 uur en 53 minuten daglicht"]}
]);

const polar={time:["2026-12-20"],sunrise:[null],sunset:[null]};
assert.deepEqual(s.zonInfoRijen(polar,"2026-12-20T12:00",null,()=>"poolnacht",()=>"Vandaag"),[{label:"Vandaag",items:["poolnacht"]}]);
const alleenOp={time:["2026-05-15"],sunrise:["2026-05-15T01:20"],sunset:[null]};
assert.deepEqual(s.zonInfoRijen(alleenOp,"2026-05-15T00:30",null,()=>"24 uur daglicht",()=>"Vandaag"),[{label:"Vandaag",items:["zon op 01:20","24 uur daglicht"]}]);
assert.deepEqual(s.zonInfoRijen(alleenOp,"2026-05-15T02:00",null,()=>"24 uur daglicht",()=>"Vandaag"),[{label:"Vandaag",items:["24 uur daglicht"]}]);
const alleenOnder={time:["2026-07-25"],sunrise:[null],sunset:["2026-07-25T23:10"]};
assert.deepEqual(s.zonInfoRijen(alleenOnder,"2026-07-25T20:00",null,()=>"23 uur daglicht",()=>"Vandaag"),[{label:"Vandaag",items:["zon onder 23:10","23 uur daglicht"]}]);

assert.deepEqual(s.tooltipCompactMaten(224,136),{breedte:201.6,hoogte:122.4,inzet:12,rijHoogte:15});

const bron=fs.readFileSync(pad.join(__dirname,"senior-semantiek-20260810.js"),"utf8");
assert(bron.includes('nachtOordeelGetoond(zichtbaar)'),"Nachtzicht-oordeel is aan de zichtbare score gekoppeld");
assert(bron.includes('balk.style.width=nachtBalkPercentageGetoond(zichtbaar)+"%"'),"Nachtzicht-balk is aan de zichtbare score gekoppeld");
assert(bron.includes('neerslagWeerCode(a.code)?beleid.dagKansSamenvatting(a,basis):basis'),"droge/bewolkte dagteksten dupliceren de neerslagkolom niet");
assert(bron.includes('uvOordeelGetoond(zichtbaar)'),"UV-oordeel gebruikt de zichtbare afgeronde waarde");
assert(bron.includes('hoogste verwachte windstoot voor vandaag bedroeg'),"verstreken windstootpiek gebruikt natuurlijk Nederlands");
assert(bron.includes('maanSymboolNaarSvgInHtml(lab.innerHTML||lab.textContent,12)'),"maankop gebruikt de DOM-onafhankelijke SVG-vervanging");
assert(!bron.includes('lab.childNodes'),"maanvervanging leunt niet op iterable childNodes");

const css=fs.readFileSync(pad.join(__dirname,"senior-semantiek-20260810.css"),"utf8");
assert(css.includes(".nachtlabel-kort"));
assert(css.includes("font-size:12px"));
assert(css.includes("#suntimes.senior-zoninfo"));
assert(!css.includes("display:none}/* attribution"));

console.log("Senior-semantiek 20260810: horizon-, zon-, Nachtzicht-, afrondings- en compactheidsregressies geslaagd.");
