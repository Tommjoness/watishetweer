"use strict";

const assert=require("assert");
const {laadKern}=require("./kern.js");
const {bouw}=require("./data.js");

let geslaagd=0;
function ok(voorwaarde,naam,extra){
  assert.ok(voorwaarde,naam+(extra?" -> "+extra:""));
  geslaagd++;
  console.log("OK  "+naam);
}
function norm(t){return String(t==null?"":t).replace(/\u00a0/g," ");}

/* 1. Productie-integratie: geldige actuele neerslag en dagsom mogen na de
   geïnjecteerde interpretatielaag niet als ontbrekend eindigen. */
{
  const {api,bak}=laadKern(390);
  const d=bouw({nu:0.6,som:2.4});
  d.current.interval=900;
  const i=d.hourly.time.findIndex(t=>t.slice(0,13)===d.current.time.slice(0,13));
  Object.assign(api.S,{d,i0:i,op:Date.now(),lat:52.35,lon:5.26,label:"Productietest",dag:null,bereik:24,
    klokOverride:new Date("2026-07-22T12:00:00Z")});
  api.meters();
  ok(/0,6/.test(norm(bak.prec.innerHTML)),"actuele neerslag blijft zichtbaar",norm(bak.prec.innerHTML));
  ok(/2,4 mm/.test(norm(bak.precsub.textContent)),"dagelijkse neerslagsom blijft zichtbaar",norm(bak.precsub.textContent));
  ok(!/niet beschikbaar/i.test(norm(bak.precsub.textContent)),"geldige neerslag wordt niet als ontbrekend gemeld",norm(bak.precsub.textContent));
}

/* 2. Als de briefing na middernacht tekent, moet hij de echte lokale kalenderdag
   gebruiken en niet de datum van een nog net oude current-respons. */
{
  const {api,bak}=laadKern(390);
  const d=bouw({temp:(u,dag)=>dag===1&&u===15?31:18});
  d.current.time="2026-07-22T23:55";
  d.current.temperature_2m=18;
  const i=d.hourly.time.findIndex(t=>t==="2026-07-22T23:00");
  Object.assign(api.S,{d,i0:i,op:Date.now(),lat:52.35,lon:5.26,label:"Productietest",dag:null,bereik:24,
    klokOverride:new Date("2026-07-22T22:05:00Z")});
  api.briefing();
  const tekst=norm(bak.brief.innerHTML).replace(/<[^>]+>/g,"");
  ok(/Vandaag wordt het maximaal 31 graden/.test(tekst),"na lokale middernacht heet de nieuwe dag vandaag",tekst);
  ok(!/Morgen wordt het maximaal 31 graden/.test(tekst),"stale current.time houdt morgen niet kunstmatig vast",tekst);
}

/* 2b. Correcte semantiek moet ook zichtbaar worden zonder handmatig verversen.
   De minuutklok wordt eerst om 23:55 geïnitialiseerd; daarna verplaatsen we alleen
   de lokale klok over 00:00. klokBijwerken() moet dan uit zichzelf een stille
   weerrefresh starten. kern.js telt fetches ook wanneer de test ze bewust laat
   hangen, zodat we dit gedrag kunnen bewijzen zonder extern netwerk. */
{
  const {api,fetchStaat}=laadKern(390);
  const d=bouw({});
  d.current.time="2026-07-22T23:55";
  const i=d.hourly.time.findIndex(t=>t==="2026-07-22T23:00");
  Object.assign(api.S,{d,i0:i,op:Date.now(),lat:52.35,lon:5.26,label:"Productietest",dag:null,bereik:24,
    klokOverride:new Date("2026-07-22T21:55:00Z")});
  api.klokBijwerken();
  const voor=fetchStaat.teller;
  api.S.klokOverride=new Date("2026-07-22T22:00:05Z");
  api.klokBijwerken();
  ok(fetchStaat.teller>=voor+2,"lokale dagwisseling start automatisch een nieuwe weerfetch",
    "fetches voor="+voor+", na="+fetchStaat.teller);

  /* Een andere plaats kan door zijn tijdzone op een andere kalenderdag zitten.
     Dat is geen verstreken dag voor dezelfde locatie en mag dus niet nóg een
     automatische refresh veroorzaken. */
  const naMiddernacht=fetchStaat.teller;
  api.S.lat=35.68; api.S.lon=139.76; api.S.d.utc_offset_seconds=9*3600;
  api.klokBijwerken();
  ok(fetchStaat.teller===naMiddernacht,"locatiewissel wordt niet aangezien voor lokale dagwisseling",
    "fetches="+fetchStaat.teller);
}

/* 3. Geen UV-reeks betekent onbekend; alleen een echte lage waarde mag als
   nauwelijks UV worden beschreven. */
{
  const {api,bak}=laadKern(390);
  const d=bouw({});
  d.hourly.uv_index=d.hourly.uv_index.map(()=>null);
  const i=d.hourly.time.findIndex(t=>t.slice(0,13)===d.current.time.slice(0,13));
  Object.assign(api.S,{d,i0:i,op:Date.now(),lat:52.35,lon:5.26,label:"Productietest",dag:null,bereik:24,
    klokOverride:new Date("2026-07-22T12:00:00Z")});
  api.meters();
  ok(/UV-gegevens voor vandaag niet beschikbaar/.test(norm(bak.uvsub.textContent)),
    "ontbrekende UV-data wordt als onbekend gemeld",norm(bak.uvsub.textContent));
  ok(!/Nauwelijks UV vandaag/.test(norm(bak.uvsub.textContent)),
    "ontbrekende UV-data wordt niet als lage UV geïnterpreteerd",norm(bak.uvsub.textContent));
}

console.log("Gebouwde productie-regressies: "+geslaagd+" controles geslaagd.");
