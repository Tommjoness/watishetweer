"use strict";

const assert=require("assert");
const G=require("./final-global-correctness-20260901.js");

/* Zoekresultaten: provider-ID is geen geografische identiteit. */
const singapore=[
  {id:11,name:"Singapore",country_code:"SG",admin1:"Singapore",latitude:1.28967,longitude:103.85007},
  {id:99,name:"Singapore",country_code:"SG",admin1:"Singapore",latitude:1.28967,longitude:103.85007}
];
assert.equal(G.dedupliceerZoekresultaten(singapore,6).length,1,"Singapore met verschillende provider-ID's moet één zichtbaar resultaat zijn");
const dubaiDup=[1,2,3].map(id=>({id,name:"Dubai",country_code:"IN",admin1:"Uttar Pradesh",latitude:25.1123,longitude:82.9912}));
assert.equal(G.dedupliceerZoekresultaten(dubaiDup,6).length,1,"drie identieke Dubai-resultaten moeten worden samengevoegd");
const springfields=[
  {id:1,name:"Springfield",country_code:"US",admin1:"Illinois",latitude:39.7817,longitude:-89.6501},
  {id:2,name:"Springfield",country_code:"US",admin1:"Missouri",latitude:37.2090,longitude:-93.2923}
];
assert.equal(G.dedupliceerZoekresultaten(springfields,6).length,2,"werkelijk verschillende gelijknamige plaatsen moeten blijven bestaan");
assert.deepStrictEqual(G.dedupliceerZoekresultaten([springfields[1],springfields[0]],6),[springfields[1],springfields[0]],"relevantievolgorde moet behouden blijven");

/* Nachtzicht: volledige lokale kalenderdatum bepaalt de tijdsvorm. */
const nacht=(tekst,nu,nachtDatum,tz,h=0,nuEpochMs)=>G.nachtVensterTijdsvorm(tekst,{horizonDagen:h,nuDatumTijd:nu,nachtDatum,tijdzone:tz,nuEpochMs});
assert.equal(nacht("Beste periode: 20:00–23:00.","2026-09-01T05:49","2026-09-01","Asia/Singapore"),"Beste periode: 20:00–23:00.","Singapore toekomstige avond mag niet verleden zijn");
assert.equal(nacht("Beste periode: 19:00–22:00.","2026-08-31T17:50","2026-08-31","America/La_Paz"),"Beste periode: 19:00–22:00.","La Paz toekomstvenster moet toekomst blijven");
assert.equal(nacht("Beste periode: 20:00–23:00.","2026-09-01T01:52","2026-09-01","Asia/Dubai",1),"Beste periode: 20:00–23:00.","Dubai volgende volledige nacht is toekomstig");
assert.equal(nacht("Relatief beste periode: 10:00–13:00.","2026-08-31T09:51","2026-08-31","Antarctica/South_Pole"),"Relatief beste periode: 10:00–13:00.","poolnachtvenster later die dag mag niet verleden zijn");
assert.equal(nacht("Beste periode: 20:00–23:00.","2026-09-01T21:15","2026-09-01","Asia/Singapore"),"Beste periode: nu tot 23:00.","actief venster gebruikt nu tot");
assert.equal(nacht("Beste periode: 20:00–23:00.","2026-09-01T23:15","2026-09-01","Asia/Singapore"),"Beste periode was 20:00–23:00.","volledig verstreken venster gebruikt was");
assert.equal(nacht("Beste periode: 22:00–02:00.","2026-09-02T00:30","2026-09-01","Europe/Amsterdam"),"Beste periode: nu tot 02:00.","venster over middernacht blijft actief");
assert.equal(nacht("Beste periode: 22:00–02:00.","2026-09-02T03:00","2026-09-01","Europe/Amsterdam"),"Beste periode was 22:00–02:00.","venster over middernacht wordt pas na echte einddatum verleden");
const herfstRef=Date.parse("2026-10-25T01:30:00Z");
assert.equal(nacht("Beste periode: 01:00–03:00.","2026-10-25T02:30","2026-10-25","Europe/Amsterdam",0,herfstRef),"Beste periode: nu tot 03:00.","DST-herfstnacht gebruikt de juiste herhaalde lokale tijd");
assert(G.tijdzoneKandidaten("2026-10-25T02:30","Europe/Amsterdam").length>=2,"herhaalde DST-tijd moet als ambigu worden herkend");

/* Nederlandse temperatuurgrammatica. */
assert.equal(G.temperatuurTekst(-1),"-1 graad");
assert.equal(G.temperatuurTekst(0),"0 graden");
assert.equal(G.temperatuurTekst(1),"1 graad");
assert.equal(G.temperatuurTekst(2),"2 graden");
assert.equal(G.corrigeerGradenTekst("Vannacht ongeveer 1 graden."),"Vannacht ongeveer 1 graad.");
assert.equal(G.corrigeerGradenTekst("Minimaal -1 graden, maximaal 2 graden."),"Minimaal -1 graad, maximaal 2 graden.");
assert.equal(G.corrigeerGradenTekst("11 graden en 1,1 graden"),"11 graden en 1,1 graden","samengestelde getallen mogen niet per ongeluk enkelvoud worden");

/* Dagweertype: dagelijkse WMO-code blijft het karakter bepalen. */
assert.equal(G.dagBasis({code:81,hoeveelheid:8.7},"Lichte motregen"),"Regenbuien","Singapore WMO 81 + 8,7 mm mag geen motregen worden");
assert.equal(G.dagKansTekst({code:81,kans:98,hoeveelheid:8.7,eersteTijd:"09:00"},"Lichte motregen"),"Zeer grote kans op regenbuien in de ochtend");
assert.equal(G.dagBasis({code:80,hoeveelheid:7.2},"Lichte buien"),"Regenbuien","7,2 mm maakt lichte dagkarakterisering onnodig precieus");
assert.equal(G.dagBasis({code:51,hoeveelheid:0.3},"Lichte motregen"),"Lichte motregen");
assert.equal(G.dagBasis({code:51,hoeveelheid:6.0},"Lichte motregen"),"Motregen","grote dagsom mag niet als slechts licht worden samengevat");
assert.equal(G.dagBasis({code:73,hoeveelheid:3},"Regen"),"Sneeuw");
assert.equal(G.dagBasis({code:95,hoeveelheid:1},"Buien"),"Onweer");

/* Neerslagveld heeft altijd een betekenisvolle hoeveelheidstoestand. */
assert.equal(G.dagHoeveelheidStatus(61,null),"hoeveelheid onzeker");
assert.equal(G.dagHoeveelheidStatus(null,null),"niet beschikbaar");
assert.equal(G.dagHoeveelheidStatus(0,0),"Droog");
assert.equal(G.dagHoeveelheidStatus(40,0),"0,0 mm");
assert.equal(G.dagHoeveelheidStatus(40,0.003),"spoor");
assert.equal(G.dagHoeveelheidStatus(40,0.03),"<0,05 mm");
assert.equal(G.dagHoeveelheidStatus(40,0.1),"0,1 mm");

/* Modelsignalen: officiële waarschuwingen zijn geen input van deze policy. */
assert.deepStrictEqual(G.modelRisicos({maxTemperatuur:24,maxGevoel:25,maxUv:4,maxWindstoot:45,minZicht:10000,aqi:35,aqiSchaal:"US"}),[]);
const verhoogd=G.modelRisicos({maxTemperatuur:31,maxGevoel:35,maxUv:9,maxWindstoot:60,minZicht:5000,aqi:70,aqiSchaal:"US"});
assert.deepStrictEqual(verhoogd.map(x=>x.id),["uv"],"alleen aantoonbaar overschreden drempel hoort zichtbaar te zijn");
const dubai=G.modelRisicos({maxTemperatuur:43,maxGevoel:46,maxUv:11,maxWindstoot:45,minZicht:8000,aqi:151,aqiSchaal:"US"});
assert.deepStrictEqual(dubai.map(x=>x.id),["hitte","luchtkwaliteit"],"maximaal twee prioritaire signalen voorkomen chaotisch stapelen");
assert(dubai[1].tekst.includes("AQI VS 151"));
const windZicht=G.modelRisicos({maxTemperatuur:12,maxUv:1,maxWindstoot:110,minZicht:700,aqi:20,aqiSchaal:"EU"});
assert.deepStrictEqual(windZicht.map(x=>x.id),["windstoten","zicht"]);

/* Nachtzichtscore en advies moeten dezelfde totaalscore uitdrukken. */
assert.equal(G.nachtAdvies(9,"veel maanlicht"),"De totale zichtscore is hoog; maanlicht maakt de hemel minder donker.");
assert(!/geen (?:aaneengesloten )?gunstig kijkvenster/i.test(G.nachtAdvies(8,"veel maanlicht")),"hoge totaalscore mag niet als ongunstig venster worden beschreven");
assert(/redelijk/i.test(G.nachtAdvies(6,"wisselende bewolking")));
assert(/^Geen gunstig kijkvenster/i.test(G.nachtAdvies(3,"dichte bewolking")));

console.log("Finale wereldwijde correctheidsregels: 45 regressiechecks geslaagd.");
