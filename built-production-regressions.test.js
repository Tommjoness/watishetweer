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

/* 2. Een open pagina die lokaal over middernacht heen gaat moet onmiddellijk de
   nieuwe kalenderdag als vandaag behandelen, ook als current.time nog van vlak
   voor middernacht is. */
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
