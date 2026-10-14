"use strict";

const assert=require("assert");
const R=require("./seizoenspagina-runtime.js");
const {SEIZOENSPAGINAS,seizoenUrl}=require("./seizoenspagina.config.js");
const {pagina}=require("./generate-seizoenspaginas.js");

const kerst=SEIZOENSPAGINAS.find(p=>p.slug==="witte-kerst");
assert(kerst,"witte kerst staat in de config");

/* Config: generiek en zonder losse uitzonderingen. */
for(const cfg of SEIZOENSPAGINAS){
  assert(/^[a-z0-9-]+$/.test(cfg.slug),`${cfg.slug}: slug is een nette URL`);
  assert.equal(seizoenUrl(cfg),`https://watishetweer.nl/${cfg.slug}/`);
  if(cfg.soort==="vakantie"){
    const jaren=Object.keys(cfg.perioden);
    assert(jaren.length>=1,`${cfg.slug}: minstens één vakantiejaar`);
    for(const j of jaren)for(const p of cfg.perioden[j]){
      assert(/^\d{4}-\d{2}-\d{2}$/.test(p.van)&&/^\d{4}-\d{2}-\d{2}$/.test(p.tot)&&p.van<=p.tot,`${cfg.slug} ${j}: periode ${p.regio} is een geldige reeks datums`);
      assert(["noord","midden","zuid"].includes(p.regio),`${cfg.slug} ${j}: regio ${p.regio}`);
      assert(R.dagenTussen(p.van,p.tot)<=48,`${cfg.slug} ${j}: periode ${p.regio} is een schoolvakantie (hooguit zeven weken), geen seizoen`);
    }
  }else{
    assert(cfg.dagen.length>=1,`${cfg.slug}: minstens één dag`);
    for(let i=1;i<cfg.dagen.length;i++){
      const a=cfg.dagen[i-1],b=cfg.dagen[i];
      assert(b.maand*100+b.dag>a.maand*100+a.dag,`${cfg.slug}: dagen staan oplopend binnen één kalenderjaar`);
    }
  }
  assert.equal(cfg.vensterDagen,7,`${cfg.slug}: venster gelijk aan de 7-daagse verwachting van de site`);
  assert(cfg.plaatsen.filter(p=>p.officieel).length<=1,`${cfg.slug}: hoogstens één officiële meetplaats`);
  for(const p of cfg.plaatsen)assert(Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.naam,`${cfg.slug}: plaats ${p.naam} heeft coördinaten`);
}

/* Tijdzone: de kalenderdag volgt Amsterdam, niet UTC. */
assert.equal(R.vandaagIn("Europe/Amsterdam",new Date("2026-12-18T23:30:00Z")),"2026-12-19");
assert.equal(R.vandaagIn("Europe/Amsterdam",new Date("2026-12-18T22:30:00Z")),"2026-12-18");

/* Ver weg: alleen de datum waarop de verwachting verschijnt. */
let t=R.toestand("2026-10-05",kerst);
assert.equal(t.jaar,2026);
assert.equal(t.fase,"ver");
assert.equal(t.vanaf,"2026-12-19");
/* Audit 6 oktober (F03): eerste kerstdag verschijnt op 19, tweede op 20 december. */
assert.equal(R.meldingTekst(t,kerst),"Vanaf zaterdag 19 december verschijnt hier de verwachting voor eerste kerstdag. De verwachting voor tweede kerstdag volgt op zondag 20 december.");
assert.deepEqual(R.toestand("2026-12-19",kerst).dagen.map(d=>d.zichtbaar),[true,false],"19 december: alleen eerste kerstdag");
assert.deepEqual(R.toestand("2026-12-20",kerst).dagen.map(d=>d.zichtbaar),[true,true],"20 december: beide kerstdagen");
assert.equal(R.meldingTekst(R.toestand("2026-12-21",kerst),kerst),"","binnen het venster geen aparte melding boven de tabel");
assert.equal(R.aftelTekst(t,kerst),"Nog 81 dagen tot eerste kerstdag.");
/* Op de pagina staat het getal groot met de rest ernaast. */
assert.deepEqual(R.aftelGetal(t,kerst),{n:81,tekst:"dagen tot eerste kerstdag"});

/* Dag vóór het venster: nog niets zichtbaar. */
t=R.toestand("2026-12-18",kerst);
assert.equal(t.fase,"ver");

/* 19 december: alleen eerste kerstdag valt binnen 7 dagen (vandaag + 6). */
t=R.toestand("2026-12-19",kerst);
assert.equal(t.fase,"verwachting");
assert.deepEqual(t.dagen.map(d=>d.zichtbaar),[true,false]);
assert.equal(t.dagen[1].vanaf,"2026-12-20");

t=R.toestand("2026-12-20",kerst);
assert.deepEqual(t.dagen.map(d=>d.zichtbaar),[true,true]);

t=R.toestand("2026-12-24",kerst);
assert.equal(R.aftelTekst(t,kerst),"Morgen is het eerste kerstdag.");
assert.equal(R.aftelGetal(t,kerst),null,"morgen: de gewone zin, geen groot getal");
t=R.toestand("2026-12-25",kerst);
assert.equal(R.aftelTekst(t,kerst),"Vandaag is het eerste kerstdag.");
t=R.toestand("2026-12-26",kerst);
assert.equal(t.jaar,2026);
assert.deepEqual(t.dagen.map(d=>d.zichtbaar),[false,true],"op tweede kerstdag is eerste kerstdag voorbij");
assert.equal(R.aftelTekst(t,kerst),"Vandaag is het tweede kerstdag.");
assert.equal(R.aftelGetal(t,kerst),null,"vandaag: de gewone zin, geen groot getal");

/* Na kerst schuift de pagina door naar volgend jaar. */
t=R.toestand("2026-12-27",kerst);
assert.equal(t.jaar,2027);
assert.equal(t.fase,"ver");
assert.equal(t.vanaf,"2027-12-19");
assert.equal(R.aftelTekst(t,kerst),"Nog 363 dagen tot eerste kerstdag.");

/* Schrikkeljaar: de rekendagen kloppen over 29 februari heen. */
assert.equal(R.dagenTussen("2028-02-28","2028-03-01"),2);

/* Open-Meteo-antwoord per plaats en dag. Sneeuwhoogte komt in meters. */
function plaatsData(per){
  const dagen=["2026-12-20","2026-12-21","2026-12-22","2026-12-23","2026-12-24","2026-12-25","2026-12-26"];
  const uren=[],diepte=[];
  for(const d of dagen)for(let u=0;u<24;u++){uren.push(`${d}T${String(u).padStart(2,"0")}:00`);diepte.push(per[d]&&u===9?per[d].diepte:0);}
  return {
    daily:{time:dagen,temperature_2m_min:dagen.map(d=>per[d]?per[d].min:3),temperature_2m_max:dagen.map(d=>per[d]?per[d].max:7),snowfall_sum:dagen.map(d=>per[d]?per[d].val:0),precipitation_sum:dagen.map(d=>per[d]?per[d].nat:0)},
    hourly:{time:uren,snow_depth:diepte}
  };
}
const wit=plaatsData({"2026-12-25":{diepte:0.04,val:2.1,nat:1.5,min:-3.4,max:0.6},"2026-12-26":{diepte:0.03,val:0,nat:0,min:-5,max:-1}});
let w=R.dagWaarden(wit,"2026-12-25",kerst.ochtendUur);
assert.equal(Math.round(w.sneeuwdek),4);
assert.equal(R.sneeuwTekst(w),"Sneeuwdek, 4 cm");
assert.equal(R.sneeuwTekst({sneeuwdek:0,sneeuwval:0.4,neerslag:0.4}),"Wat sneeuw (minder dan 1 cm), geen sneeuwdek");
assert.equal(R.sneeuwTekst({sneeuwdek:0,sneeuwval:0,neerslag:3.14}),"Geen sneeuw, 3,1 mm regen");
assert.equal(R.sneeuwTekst({sneeuwdek:0,sneeuwval:0,neerslag:0}),"Geen sneeuw, droog");
assert.equal(R.sneeuwTekst({sneeuwdek:null,sneeuwval:null,neerslag:null}),"Geen gegevens","ontbrekende waarden worden niet stil 'droog'");
assert.equal(R.sneeuwTekst(null),"Geen gegevens");
assert.equal(R.dagWaarden(wit,"2026-12-31",9),null,"dag buiten het antwoord geeft geen waarden");

/* Samenvatting gaat over de officiële meetplaats (De Bilt). */
const groen=plaatsData({});
t=R.toestand("2026-12-20",kerst);
const lijst=kerst.plaatsen.map((p,i)=>i===0?wit:groen);
let res=R.verwerkAntwoord(lijst,t,kerst);
assert.equal(res.length,kerst.plaatsen.length);
assert.equal(R.samenvatting(t,res,kerst),"Volgens de huidige verwachting ligt er op beide kerstdagen sneeuw in De Bilt. Blijft dat zo, dan is het officieel een witte kerst.");
res=R.verwerkAntwoord(kerst.plaatsen.map(()=>groen),t,kerst);
assert.equal(R.samenvatting(t,res,kerst),"Volgens de huidige verwachting wordt het geen officiële witte kerst: in De Bilt ligt op eerste kerstdag geen sneeuwdek.");
t=R.toestand("2026-12-19",kerst);
res=R.verwerkAntwoord(lijst,t,kerst);
assert.equal(R.samenvatting(t,res,kerst),"Volgens de huidige verwachting ligt er op eerste kerstdag sneeuw in De Bilt. De verwachting voor tweede kerstdag verschijnt op 20 december.");
assert.throws(()=>R.verwerkAntwoord([wit],t,kerst),/aantal plaatsen/,"onvolledig antwoord faalt gesloten");

/* Eén plaats: Open-Meteo geeft dan een object in plaats van een lijst. */
const enkel={...kerst,plaatsen:[kerst.plaatsen[0]]};
assert.equal(R.verwerkAntwoord(wit,t,enkel).length,1);

const url=R.verwachtingUrl(kerst);
assert(url.startsWith("https://api.open-meteo.com/v1/forecast?latitude=52.0989,"),url);
assert(url.includes("&hourly=snow_depth")&&url.includes("&forecast_days=7")&&url.includes("&timezone=Europe%2FAmsterdam"),url);

/* Statische pagina op een builddag ver voor kerst. */
const html=pagina(kerst,"2026-10-05");
assert(html.includes("<title>Witte kerst 2026: kans op sneeuw met kerst | watishetweer.nl</title>"));
assert(html.includes('<link rel="canonical" href="https://watishetweer.nl/witte-kerst/">'));
assert(html.includes('<h1 id="seizoen-kop">Witte kerst 2026</h1>'));
assert(html.includes("Vanaf zaterdag 19 december verschijnt hier de verwachting voor eerste kerstdag. De verwachting voor tweede kerstdag volgt op zondag 20 december."));
assert(html.includes("Vanaf 19 december staat hier de verwachting"),"description noemt de startdatum");
assert(html.includes("gesloten sneeuwdek")&&html.includes("https://www.knmi.nl/"),"definitie met KNMI-bron");
const zichtbaar=html.split('<script type="application/json" id="seizoen-config">')[0];
assert(!/undefined|\{\w+\}|NaN/.test(zichtbaar),"geen lege plaatshouders in de statische pagina");
const cfgJson=html.match(/<script type="application\/json" id="seizoen-config">([\s\S]*?)<\/script>/);
assert(cfgJson,"runtimeconfig staat als data in de pagina");
assert.equal(JSON.parse(cfgJson[1]).plaatsen.length,kerst.plaatsen.length);
assert.equal(pagina(kerst,"2026-12-28").match(/<h1[^>]*>([^<]+)</)[1],"Witte kerst 2027","build na kerst toont volgend jaar");

/* ---------- Oud en nieuw: één nacht van 22:00 tot 02:00 ---------- */
const oud=SEIZOENSPAGINAS.find(p=>p.slug==="oud-en-nieuw");
assert(oud,"oud en nieuw staat in de config");
assert.equal(oud.soort,"middernacht");
assert.equal(new Set(SEIZOENSPAGINAS.map(p=>p.slug)).size,SEIZOENSPAGINAS.length,"slugs zijn uniek");
t=R.toestand("2026-10-05",oud);
assert.equal(t.fase,"ver");
assert.equal(t.vanaf,"2026-12-26","de nacht loopt tot 1 januari: zichtbaar vanaf 26 december");
assert.equal(R.aftelTekst(t,oud),"Nog 87 dagen tot oudejaarsdag.");
assert.equal(R.meldingTekst(t,oud),"De verwachting voor de nacht van oud en nieuw verschijnt hier op zaterdag 26 december, zodra die binnen de 7-daagse verwachting valt.");
assert.equal(R.toestand("2026-12-25",oud).fase,"ver","op 25 december valt 1 januari 02:00 nog buiten het venster");
assert.equal(R.toestand("2026-12-26",oud).fase,"verwachting");
assert.equal(R.aftelTekst(R.toestand("2026-12-31",oud),oud),"Vandaag is het oudejaarsdag.");
t=R.toestand("2027-01-01",oud);
assert.equal(t.jaar,2027,"na oudejaarsdag schuift de pagina door naar volgend jaar");
assert.equal(t.vanaf,"2027-12-26");
/* De nacht loopt door tot 1 januari 02:00: tot dat uur blijft de pagina bij
   deze jaarwisseling, met de verwachting en past_days=1 voor gisteravond. */
assert.equal(R.eindUur(oud),26);assert.equal(R.eindUur(kerst),24);
t=R.toestand("2027-01-01",oud,1);
assert.equal(t.jaar,2026,"om 01:00 op 1 januari loopt de nacht nog");
assert.equal(t.fase,"verwachting");
assert.deepEqual(t.dagen.map(d=>[d.iso,d.over,d.bezig,d.zichtbaar]),[["2026-12-31",-1,true,true]]);
assert.equal(R.aftelTekst(t,oud),"De nacht van oud en nieuw is nu bezig.");
assert.equal(R.aftelGetal(t,oud),null,"lopende nacht: de gewone zin, geen groot getal");
assert(R.verwachtingUrl(oud,t).endsWith("&forecast_days=7&past_days=1"),"lopende nacht haalt gisteravond erbij");
assert(!R.verwachtingUrl(oud,R.toestand("2026-12-31",oud,23)).includes("past_days"),"op oudejaarsavond zelf geen past_days");
t=R.toestand("2027-01-01",oud,2);
assert.equal(t.jaar,2027,"om 02:00 is de nacht voorbij en schuift de pagina door");
assert.equal(R.aftelTekst(t,oud),"Nog 364 dagen tot oudejaarsdag.");
assert.deepEqual(R.aftelGetal(t,oud),{n:364,tekst:"dagen tot oudejaarsdag"});
assert.equal(R.toestand("2026-12-31",oud,23).jaar,2026);
assert.equal(R.aftelTekst(R.toestand("2026-12-31",oud,23),oud),"Vandaag is het oudejaarsdag.");
assert.equal(R.toestand("2027-01-02",oud,1).jaar,2027,"de dag erna is de nacht nooit meer bezig");
assert.equal(R.toestand("2026-12-27",kerst,0).jaar,2027,"witte kerst (zonder uren) schuift om middernacht door");
assert.equal(R.toestand("2026-12-26",kerst,23).jaar,2026);
const nu=R.nuIn("Europe/Amsterdam",new Date("2026-12-31T23:30:00Z"));
assert.deepEqual(nu,{datum:"2027-01-01",uur:0},"nuIn geeft datum en uur in Nederlandse tijd (CET, UTC+1)");
assert.deepEqual(R.nuIn("Europe/Amsterdam",new Date("2026-10-25T00:30:00Z")),{datum:"2026-10-25",uur:2},"zomertijd: 00:30 UTC = 02:30 CEST");
assert.equal(R.uurStempel("2026-12-31",22),"2026-12-31T22:00");
assert.equal(R.uurStempel("2026-12-31",24),"2027-01-01T00:00","uur 24 is middernacht op 1 januari, over de jaargrens");
assert.equal(R.uurStempel("2026-12-31",26),"2027-01-01T02:00");
assert.deepEqual([0,44,90,180,225,350].map(R.richting),["N","NO","O","Z","ZW","N"]);
assert.equal(R.richting(null),"");
assert.equal(R.lijstTekst(["Amsterdam"]),"Amsterdam");
assert.equal(R.lijstTekst(["Amsterdam","Utrecht"]),"Amsterdam en Utrecht");
assert.equal(R.lijstTekst(["Amsterdam","Den Haag","Utrecht"]),"Amsterdam, Den Haag en Utrecht");

function nachtData(waarden){
  const uren=[],v={temperature_2m:[],precipitation:[],precipitation_probability:[],wind_speed_10m:[],wind_gusts_10m:[],wind_direction_10m:[],visibility:[]};
  for(const dag of ["2026-12-31","2027-01-01"])for(let u=0;u<24;u++){
    const stempel=`${dag}T${String(u).padStart(2,"0")}:00`;uren.push(stempel);
    const w=waarden[stempel]||{};
    v.temperature_2m.push(w.temp??4);v.precipitation.push(w.nat??0);v.precipitation_probability.push(w.kans??10);
    v.wind_speed_10m.push(w.wind??12);v.wind_gusts_10m.push(w.stoot??25);v.wind_direction_10m.push(w.dir??225);v.visibility.push(w.zicht??20000);
  }
  return {hourly:{time:uren,...v}};
}
const rustig=nachtData({"2027-01-01T00:00":{temp:3.4}});
let n=R.nachtWaarden(rustig,"2026-12-31",oud);
assert.equal(n.temp,3.4,"temperatuur op middernacht = 1 januari 00:00");
assert.equal(n.neerslag,0);assert.equal(n.kans,10);assert.equal(n.wind,12);assert.equal(n.stoot,25);assert.equal(n.richting,"ZW");
assert.equal(R.neerslagTekst(n),"Droog · kans 10%");
assert.equal(R.windTekst(n),"ZW 12 km/u · stoten 25");
const ruig=nachtData({"2026-12-31T23:00":{nat:0.8,kans:70,stoot:62},"2027-01-01T00:00":{nat:0.5,kans:60,zicht:600},"2027-01-01T03:00":{nat:9,stoot:99}});
n=R.nachtWaarden(ruig,"2026-12-31",oud);
assert.equal(Math.round(n.neerslag*10)/10,1.3,"alleen 22:00–02:00 telt mee, 03:00 niet");
assert.equal(n.stoot,62);
assert.equal(R.neerslagTekst(n),"1,3 mm · kans 70%");
assert.equal(R.neerslagTekst(null),"Geen gegevens");
assert.equal(R.windTekst({wind:null}),"Geen gegevens");
assert.equal(R.nachtWaarden({hourly:{time:[]}},"2026-12-31",oud),null,"geen uren: geen waarden, niet stil droog");

t=R.toestand("2026-12-27",oud);
res=R.verwerkAntwoord(oud.plaatsen.map(()=>rustig),t,oud);
assert.deepEqual(R.nachtSamenvatting(t,res,oud),["Rond middernacht blijft het volgens de huidige verwachting overal droog."]);
res=R.verwerkAntwoord(oud.plaatsen.map((p,i)=>i===1||i===2?ruig:rustig),t,oud);
assert.deepEqual(R.nachtSamenvatting(t,res,oud),[
  "Rond middernacht valt er volgens de huidige verwachting neerslag in Rotterdam en Den Haag.",
  "Windstoten van 50 km/u of meer in Rotterdam en Den Haag.",
  "Kans op mist (zicht onder 1 km) in Rotterdam en Den Haag."
]);
assert(R.verwachtingUrl(oud).includes("&hourly=temperature_2m,precipitation,precipitation_probability,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility"));
assert(!R.verwachtingUrl(oud).includes("daily="),"oud en nieuw vraagt alleen uurdata");

const htmlOud=pagina(oud,"2026-10-05");
assert(htmlOud.includes("<title>Weer oud en nieuw 2026: neerslag, wind en mist rond middernacht | watishetweer.nl</title>"));
assert(htmlOud.includes('<link rel="canonical" href="https://watishetweer.nl/oud-en-nieuw/">'));
assert(htmlOud.includes('<h1 id="seizoen-kop">Oud en nieuw 2026</h1>'));
assert(!htmlOud.includes("Bron: <a"),"zonder bron in de config geen bronregel");
assert(!/undefined|\{\w+\}|NaN/.test(htmlOud.split('<script type="application/json" id="seizoen-config">')[0]),"geen lege plaatshouders");
const oudCfg=JSON.parse(htmlOud.match(/<script type="application\/json" id="seizoen-config">([\s\S]*?)<\/script>/)[1]);
assert.equal(oudCfg.soort,"middernacht");assert.deepEqual(oudCfg.uren,[22,23,24,25,26]);assert.equal(oudCfg.extraDagen,1);
assert(!("intro" in oudCfg)&&!("uitleg" in oudCfg),"alleen runtimevelden in de pagina-config");

console.log("Seizoenspagina's: datumlogica (venster, aftelling, jaarwissel, tijdzone), sneeuwduiding, samenvatting, oud en nieuw (nacht over de jaargrens, neerslag/wind/mist) en statische pagina's OK.");

/* ---------- Herfstvakantie (soort "vakantie"): periode per regio, per jaar ---------- */
const herfst=SEIZOENSPAGINAS.find(p=>p.slug==="herfstvakantie");
assert(herfst&&herfst.soort==="vakantie","herfstvakantie staat in de config");
/* Adviesdata OCW (rijksoverheid.nl), gecontroleerd 12 oktober 2026. */
assert.deepEqual(herfst.perioden[2026].map(p=>[p.regio,p.van,p.tot]),[["noord","2026-10-10","2026-10-18"],["midden","2026-10-17","2026-10-25"],["zuid","2026-10-17","2026-10-25"]]);
assert.deepEqual(herfst.perioden[2027].map(p=>[p.regio,p.van,p.tot]),[["noord","2027-10-16","2027-10-24"],["midden","2027-10-16","2027-10-24"],["zuid","2027-10-23","2027-10-31"]]);
const hv=(d)=>{const t=R.toestand(d,herfst);return {t,a:R.aftelTekst(t,herfst),g:R.aftelGetal(t,herfst),m:R.meldingTekst(t,herfst),zicht:t.dagen.filter(x=>x.zichtbaar).map(x=>x.iso)};};
let h=hv("2026-09-20");
assert.equal(h.t.jaar,2026);assert.equal(h.t.fase,"ver");
assert.equal(h.a,"Nog 20 dagen tot de herfstvakantie in regio noord.");
assert.deepEqual(h.g,{n:20,tekst:"dagen tot de herfstvakantie in regio noord"});
assert.equal(h.m,"Vanaf zondag 4 oktober staat hier de verwachting voor de eerste vakantiedag.");
h=hv("2026-10-04");
assert.equal(h.t.fase,"verwachting");assert.deepEqual(h.zicht,["2026-10-10"],"4 oktober: alleen de eerste vakantiedag valt in het venster");
assert.equal(h.m,"");
assert.equal(hv("2026-10-09").a,"Morgen begint de herfstvakantie in regio noord.");
assert.equal(hv("2026-10-09").g,null,"morgen: geen groot getal");
assert.equal(hv("2026-10-10").a,"Vandaag begint de herfstvakantie in regio noord. In regio midden en zuid begint de vakantie op zaterdag 17 oktober.");
h=hv("2026-10-12");
assert.equal(h.a,"Het is herfstvakantie in regio noord. In regio midden en zuid begint de vakantie op zaterdag 17 oktober.");
assert.deepEqual(h.zicht,["2026-10-12","2026-10-13","2026-10-14","2026-10-15","2026-10-16","2026-10-17","2026-10-18"],"voorbije vakantiedagen vallen weg; zeven dagen vooruit");
assert.deepEqual(h.t.dagen.find(d=>d.iso==="2026-10-17").regios,["noord","midden","zuid"]);
assert.deepEqual(h.t.dagen.find(d=>d.iso==="2026-10-12").regios,["noord"]);
assert.equal(hv("2026-10-17").a,"Het is overal herfstvakantie.");
assert.equal(hv("2026-10-19").a,"Het is herfstvakantie in regio midden en zuid.");
assert.deepEqual(hv("2026-10-25").zicht,["2026-10-25"]);
h=hv("2026-10-26");
assert.equal(h.t.jaar,2027,"na de laatste vakantiedag schuift de pagina door naar volgend jaar");
assert.equal(h.a,"Nog 355 dagen tot de herfstvakantie in regio noord en midden.");
assert.equal(hv("2027-10-16").a,"Vandaag begint de herfstvakantie in regio noord en midden. In regio zuid begint de vakantie op zaterdag 23 oktober.");
h=hv("2027-11-01");
assert.equal(h.t.fase,"onbekend");assert.equal(h.t.jaar,2028);
assert.equal(h.a,"","onbekend jaar: geen aftelling");assert.equal(h.g,null);
assert.equal(h.m,"De data van de herfstvakantie 2028 zijn nog niet bekend.");
assert.equal(R.periodeTekst("2026-10-10","2026-10-18"),"10 t/m 18 oktober");
assert.equal(R.periodeTekst("2027-10-23","2027-11-01"),"23 oktober t/m 1 november");

/* Weerwaarden en samenvatting. */
assert(R.verwachtingUrl(herfst,R.toestand("2026-10-12",herfst)).includes("&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,precipitation_probability_max,sunshine_duration"));
assert.equal(R.vakantieWeerTekst({neerslag:1.46,kans:42,zon:3*3600/3600}),"1,5 mm regen · kans 42%");
assert.equal(R.vakantieWeerTekst({neerslag:0.1,kans:20,zon:9.4}),"Droog · 9 uur zon","0,1 mm telt als droog");
assert.equal(R.vakantieWeerTekst({neerslag:0,kans:5,zon:0.3}),"Droog · weinig zon");
assert.equal(R.vakantieWeerTekst(null),"Geen gegevens");
const dagdata=(iso,mm,cm)=>({daily:{time:[iso],temperature_2m_max:[15],temperature_2m_min:[8],precipitation_sum:[mm],snowfall_sum:[cm==null?0:cm],precipitation_probability_max:[50],sunshine_duration:[18000]}});
assert.deepEqual(R.vakantieWaarden(dagdata("2026-10-12",2),"2026-10-12"),{tmin:8,tmax:15,neerslag:2,sneeuw:0,kans:50,zon:5});
assert.equal(R.vakantieWeerTekst(R.vakantieWaarden(dagdata("2026-12-20",3.1,2.37),"2026-12-20")),"2,4 cm sneeuw · kans 50%","verse sneeuw gaat voor regen");
assert.equal(R.vakantieWeerTekst({neerslag:1.2,sneeuw:0.3,kans:40,zon:1}),"1,2 mm regen · kans 40%","minder dan een halve centimeter sneeuw telt als regen");
const vakRes=(regenPerPlaats)=>regenPerPlaats.map((mm,i)=>({plaats:herfst.plaatsen[i],dagen:{"2026-10-24":{neerslag:mm},"2026-10-25":{neerslag:0}}}));
const tLaat=R.toestand("2026-10-24",herfst);
assert.equal(R.vakantieSamenvatting(tLaat,vakRes([0,0,0,2,2,2,0]),herfst),"Volgens de huidige verwachting blijft het op alle 2 vakantiedagen in de verwachting overwegend droog.","3 van 7 plaatsen nat is nog overwegend droog");
assert.equal(R.vakantieSamenvatting(tLaat,vakRes([2,2,2,2,0,0,0]),herfst),"Volgens de huidige verwachting is 1 van de 2 vakantiedagen in de verwachting overwegend droog.");
assert.equal(R.vakantieSamenvatting(R.toestand("2026-10-25",herfst),vakRes([2,2,2,2,0,0,0]).map(r=>({...r,dagen:{"2026-10-25":{neerslag:3}}})),herfst),"Volgens de huidige verwachting valt er op zondag 25 oktober in een groot deel van het land regen.");

/* Statische HTML: vakantiedata per regio staan vast in de pagina. */
const htmlHerfst=pagina(herfst,"2026-10-12");
assert(htmlHerfst.includes("<title>Weer herfstvakantie 2026: regen, zon en temperatuur per dag | watishetweer.nl</title>"));
assert(htmlHerfst.includes('<link rel="canonical" href="https://watishetweer.nl/herfstvakantie/">'));
assert(htmlHerfst.includes('<tr><th scope="row">Regio noord</th><td>10 t/m 18 oktober</td></tr>')&&htmlHerfst.includes('<tr><th scope="row">Regio zuid</th><td>23 t/m 31 oktober</td></tr>'),"data 2026 en 2027 staan in de HTML");
assert(!pagina(herfst,"2026-10-26").includes('data-jaar="2026"'),"na de vakantie verdwijnt het voorbije jaar uit de tabel");
assert(pagina(herfst,"2027-11-01").includes("<h1 id=\"seizoen-kop\">Herfstvakantie 2028</h1>"),"onbekend jaar bouwt zonder fout");
assert.equal(R.regioKop({regios:["noord","midden","zuid"]},3),"alle regio's");
assert.equal(R.regioKop({regios:["midden","zuid"]},3),"regio midden en zuid");
console.log("Seizoenspagina herfstvakantie: perioden per regio, aftellen, venster, doorschuiven en samenvatting kloppen.");

/* ---------- Kerstvakantie: overal tegelijk, over de jaargrens ---------- */
const kerstVak=SEIZOENSPAGINAS.find(p=>p.slug==="kerstvakantie");
assert(kerst&&kerstVak.soort==="vakantie","kerstvakantie staat in de config");
assert.deepEqual([...new Set(kerstVak.perioden[2026].map(p=>p.van+"/"+p.tot))],["2026-12-19/2027-01-03"],"2026: overal 19 december t/m 3 januari (Rijksoverheid)");
assert.deepEqual([...new Set(kerstVak.perioden[2027].map(p=>p.van+"/"+p.tot))],["2027-12-25/2028-01-09"],"2027: overal 25 december t/m 9 januari (Rijksoverheid)");
const kv=(d)=>{const t=R.toestand(d,kerstVak);return {t,a:R.aftelTekst(t,kerstVak),m:R.meldingTekst(t,kerstVak),zicht:t.dagen.filter(x=>x.zichtbaar).map(x=>x.iso)};};
let k=kv("2026-10-12");
assert.equal(k.a,"Nog 68 dagen tot de kerstvakantie.","overal tegelijk: geen regio in het aftellen");
assert.equal(k.m,"Vanaf zondag 13 december staat hier de verwachting voor de eerste vakantiedag.");
assert.equal(kv("2026-12-18").a,"Morgen begint de kerstvakantie.");
assert.equal(kv("2026-12-19").a,"Vandaag begint de kerstvakantie.");
assert.equal(kv("2026-12-27").a,"Het is kerstvakantie.");
k=kv("2027-01-01");
assert.equal(k.t.jaar,2026,"op 1 januari loopt de kerstvakantie van 2026 nog");
assert.deepEqual(k.zicht,["2027-01-01","2027-01-02","2027-01-03"],"over de jaargrens: de laatste drie vakantiedagen");
k=kv("2027-01-04");
assert.equal(k.t.jaar,2027);assert.equal(k.a,"Nog 355 dagen tot de kerstvakantie.");
assert.equal(kv("2028-01-10").m,"De data van de kerstvakantie 2028 zijn nog niet bekend.");
assert.equal(R.periodeTekst("2026-12-19","2027-01-03"),"19 december 2026 t/m 3 januari 2027","over de jaargrens met jaartallen");
const kerstRes=(mm)=>mm.map((n,i)=>({plaats:kerstVak.plaatsen[i],dagen:{"2027-01-03":{neerslag:n}}}));
assert.equal(R.vakantieSamenvatting(R.toestand("2027-01-03",kerstVak),kerstRes([2,2,2,2,0,0,0]),kerstVak),"Volgens de huidige verwachting valt er op zondag 3 januari in een groot deel van het land neerslag.");
const htmlKerst=pagina(kerstVak,"2026-10-12");
assert(htmlKerst.includes("<title>Weer kerstvakantie 2026: regen, sneeuw en temperatuur per dag | watishetweer.nl</title>"));
assert(htmlKerst.includes('<tr><th scope="row">Alle regio\'s</th><td class="jaargrens">19 december 2026 t/m 3 januari 2027</td></tr>'),"gelijke data: één regel voor alle regio's");
assert(!htmlKerst.includes('<th scope="row">Regio noord</th>'),"geen drie gelijke regels");
assert(htmlHerfst.includes('<th scope="row">Regio noord</th>'),"verschillende data blijven per regio");
console.log("Seizoenspagina kerstvakantie: overal tegelijk, aftellen zonder regio, jaargrens, sneeuw en vakantiedata kloppen.");

/* ---------- Voorjaars-, mei- en zomervakantie (Rijksoverheid) en zie-ook-links ---------- */
const vak=slug=>SEIZOENSPAGINAS.find(p=>p.slug===slug);
const voorjaar=vak("voorjaarsvakantie"),mei=vak("meivakantie"),zomer=vak("zomervakantie");
assert(voorjaar&&mei&&zomer,"drie nieuwe vakantiepagina's staan in de config");
assert.deepEqual(voorjaar.perioden[2027].map(p=>[p.regio,p.van,p.tot]),[["noord","2027-02-20","2027-02-28"],["midden","2027-02-20","2027-02-28"],["zuid","2027-02-13","2027-02-21"]]);
assert.deepEqual(voorjaar.perioden[2028].map(p=>[p.regio,p.van,p.tot]),[["noord","2028-02-19","2028-02-27"],["midden","2028-02-26","2028-03-05"],["zuid","2028-02-26","2028-03-05"]]);
assert.deepEqual([...new Set(mei.perioden[2027].map(p=>p.van+"/"+p.tot))],["2027-04-24/2027-05-02"]);
assert.deepEqual([...new Set(mei.perioden[2028].map(p=>p.van+"/"+p.tot))],["2028-04-29/2028-05-07"]);
assert.deepEqual(zomer.perioden[2027].map(p=>[p.regio,p.van,p.tot]),[["noord","2027-07-10","2027-08-22"],["midden","2027-07-17","2027-08-29"],["zuid","2027-07-24","2027-09-05"]]);
assert.deepEqual(zomer.perioden[2028].map(p=>[p.regio,p.van,p.tot]),[["noord","2028-07-15","2028-08-27"],["midden","2028-07-08","2028-08-20"],["zuid","2028-07-22","2028-09-03"]]);
const at=(d,c)=>R.aftelTekst(R.toestand(d,c),c);
assert.equal(at("2026-10-12",voorjaar),"Nog 124 dagen tot de voorjaarsvakantie in regio zuid.","zuid begint in 2027 een week eerder");
assert.equal(at("2027-02-13",voorjaar),"Vandaag begint de voorjaarsvakantie in regio zuid. In regio noord en midden begint de vakantie op zaterdag 20 februari.");
assert.equal(at("2027-02-20",voorjaar),"Het is overal voorjaarsvakantie.");
assert.equal(at("2027-02-22",voorjaar),"Het is voorjaarsvakantie in regio noord en midden.");
assert.equal(at("2026-10-12",mei),"Nog 194 dagen tot de meivakantie.","overal tegelijk: geen regio");
assert.equal(at("2027-04-27",mei),"Het is meivakantie.");
assert.equal(at("2027-07-10",zomer),"Vandaag begint de zomervakantie in regio noord. In regio midden begint de vakantie op zaterdag 17 juli.");
assert.equal(at("2027-07-24",zomer),"Het is overal zomervakantie.");
assert.equal(at("2027-08-25",zomer),"Het is zomervakantie in regio midden en zuid.");
let tz=R.toestand("2027-08-01",zomer);
assert.equal(tz.dagen.filter(d=>d.zichtbaar).length,7,"zes weken vakantie: alleen de zeven dagen binnen de verwachting");
assert.equal(R.toestand("2027-09-06",zomer).jaar,2028,"na de laatste vakantiedag schuift de pagina door");
assert(R.verwachtingUrl(voorjaar,R.toestand("2027-02-15",voorjaar)).includes("snowfall_sum"),"voorjaar vraagt sneeuw op");
/* Zie-ook-links tussen de kerstpagina's (eigenaar, 12 oktober). */
const zieOok=slug=>{const m=pagina(vak(slug),"2026-10-12").match(/<p class="seizoen-zieook">([\s\S]*?)<\/p>/);return m?m[1]:"";};
assert.equal(zieOok("kerstvakantie"),'<span>Zie ook</span> <a href="/witte-kerst/">Witte kerst</a> · <a href="/oud-en-nieuw/">Oud en nieuw</a>');
assert.equal(zieOok("witte-kerst"),'<span>Zie ook</span> <a href="/kerstvakantie/">Kerstvakantie</a> · <a href="/oud-en-nieuw/">Oud en nieuw</a>');
assert.equal(zieOok("oud-en-nieuw"),'<span>Zie ook</span> <a href="/witte-kerst/">Witte kerst</a> · <a href="/kerstvakantie/">Kerstvakantie</a>');
assert.equal(zieOok("herfstvakantie"),"","geen zie-ook waar het niet is ingesteld");
assert.throws(()=>pagina({...vak("kerstvakantie"),zieOok:["bestaat-niet"]},"2026-10-12"),/onbekende seizoenspagina/);
/* Voet: op 12 oktober staan herfst, kerst en witte kerst ook op mobiel in beeld,
   oud en nieuw en voorjaar alleen op brede schermen, mei en zomer nergens in
   beeld (wel in de HTML). */
{
  const {voetKlasse}=require("./seo-foundation.js");
  const klasse=Object.fromEntries(SEIZOENSPAGINAS.map(p=>[p.slug,voetKlasse(p,"2026-10-12").trim()]));
  assert.deepEqual(klasse,{"witte-kerst":"","oud-en-nieuw":"voet-later","herfstvakantie":"","kerstvakantie":"","voorjaarsvakantie":"voet-later","meivakantie":"voet-ver","zomervakantie":"voet-ver"});
  assert.equal(voetKlasse(SEIZOENSPAGINAS.find(p=>p.slug==="zomervakantie"),"2027-07-01").trim(),"","in juli staat de zomervakantie vooraan");
}
console.log("Seizoenspagina's voorjaars-, mei- en zomervakantie: data, aftellen per regio, venster en doorschuiven kloppen; zie-ook-links tussen de kerstpagina's.");

/* Temperatuurbalkje (14 oktober): dezelfde kleurschaal als de app en één schaal per dag. */
{
  const fs=require("fs"),path=require("path");
  const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
  const blok=html.match(/const TEMP_SCHAAL=\{\s*licht:(\[[^\n]*\]),\s*donker:(\[[^\n]*\])\s*\};/);
  assert(blok,"TEMP_SCHAAL staat in index.html");
  assert.deepEqual(R.TEMP_SCHAAL,{licht:JSON.parse(blok[1]),donker:JSON.parse(blok[2])},"seizoenspagina's gebruiken dezelfde temperatuurschaal als de app");
  assert.equal(R.temperatuurKleur(15,"licht"),"rgb(175,172,164)","13–17 graden is neutraal");
  assert.equal(R.temperatuurKleur(-30,"donker"),"rgb(187,221,246)","onder de schaal: de koudste kleur");
  const dag={iso:"2026-10-14"},res=[{dagen:{"2026-10-14":{tmin:9,tmax:16}}},{dagen:{"2026-10-14":{tmin:14,tmax:19}}},{dagen:{"2026-10-14":null}},{dagen:{"2026-10-14":{tmin:null,tmax:20}}}];
  assert.deepEqual(R.dagBereik(dag,res),{lo:9,hi:19},"bereik over alle plaatsen met beide waarden");
  assert.equal(R.dagBereik(dag,[{dagen:{}}]),null,"zonder waarden geen bereik");
}
console.log("Seizoenspagina's temperatuurbalkje: zelfde schaal als de app, één bereik per dag.");
