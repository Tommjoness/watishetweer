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
  assert(cfg.dagen.length>=1,`${cfg.slug}: minstens één dag`);
  for(let i=1;i<cfg.dagen.length;i++){
    const a=cfg.dagen[i-1],b=cfg.dagen[i];
    assert(b.maand*100+b.dag>a.maand*100+a.dag,`${cfg.slug}: dagen staan oplopend binnen één kalenderjaar`);
  }
  assert.equal(cfg.vensterDagen,7,`${cfg.slug}: venster gelijk aan de 7-daagse verwachting van de site`);
  assert.equal(cfg.plaatsen.filter(p=>p.officieel).length,1,`${cfg.slug}: precies één officiële meetplaats`);
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
assert.equal(R.meldingTekst(t,kerst),"De verwachting voor eerste en tweede kerstdag verschijnt hier op zaterdag 19 december, zeven dagen van tevoren.");
assert.equal(R.meldingTekst(R.toestand("2026-12-21",kerst),kerst),"","binnen het venster geen aparte melding boven de tabel");
assert.equal(R.aftelTekst(t,kerst),"Nog 81 dagen tot eerste kerstdag.");

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
t=R.toestand("2026-12-25",kerst);
assert.equal(R.aftelTekst(t,kerst),"Vandaag is het eerste kerstdag.");
t=R.toestand("2026-12-26",kerst);
assert.equal(t.jaar,2026);
assert.deepEqual(t.dagen.map(d=>d.zichtbaar),[false,true],"op tweede kerstdag is eerste kerstdag voorbij");
assert.equal(R.aftelTekst(t,kerst),"Vandaag is het tweede kerstdag.");

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
assert(html.includes("verschijnt hier op zaterdag 19 december"));
assert(html.includes("Vanaf 19 december staat hier de verwachting"),"description noemt de startdatum");
assert(html.includes("gesloten sneeuwdek")&&html.includes("https://www.knmi.nl/"),"definitie met KNMI-bron");
const zichtbaar=html.split('<script type="application/json" id="seizoen-config">')[0];
assert(!/undefined|\{\w+\}|NaN/.test(zichtbaar),"geen lege plaatshouders in de statische pagina");
const cfgJson=html.match(/<script type="application\/json" id="seizoen-config">([\s\S]*?)<\/script>/);
assert(cfgJson,"runtimeconfig staat als data in de pagina");
assert.equal(JSON.parse(cfgJson[1]).plaatsen.length,kerst.plaatsen.length);
assert.equal(pagina(kerst,"2026-12-28").match(/<h1[^>]*>([^<]+)</)[1],"Witte kerst 2027","build na kerst toont volgend jaar");

console.log("Seizoenspagina's: datumlogica (venster, aftelling, jaarwissel, tijdzone), sneeuwduiding, samenvatting en statische pagina OK.");
