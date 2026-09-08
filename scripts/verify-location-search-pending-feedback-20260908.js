"use strict";

const fs=require("fs"),path=require("path");
const apply=require("./apply-location-search-pending-feedback-20260908.js");

const root=path.join(__dirname,"..","public","index.html");
if(!fs.existsSync(root))throw new Error("public/index.html ontbreekt voor location-search verifier.");

const html=fs.readFileSync(root,"utf8");
const begin=html.indexOf(apply.SECTIE_START),eind=html.indexOf(apply.SECTIE_EIND,begin+apply.SECTIE_START.length);
if(begin<0||eind<0)throw new Error("Zoeksectie ontbreekt in gebouwd artifact.");
const sectie=html.slice(begin,eind);

function eis(conditie,tekst){if(!conditie)throw new Error(tekst);}
function tel(bron,zoek){return String(bron).split(zoek).length-1;}

const pending='zoekMeldingToon("Plaatsen zoeken…");';
const guard='if(generatie!==zoekGeneratie)return;';
const cleanup='zoekMelding.classList.remove("on");zoekMelding.textContent="";';
const resultaten='const resultaten=Array.isArray(d.results)?d.results:[];';
const succesPad=guard+'\n      '+cleanup+'\n      '+resultaten;

eis(tel(sectie,apply.MARKER)===1,"Pending-feedbackmarker ontbreekt of is dubbel.");
eis(tel(sectie,pending)===1,"Plaatsen zoeken-wachtstatus ontbreekt of is dubbel.");
eis(tel(sectie,succesPad)===1,"Latest-wins guard, succes-cleanup en result-rendering staan niet exact één keer in de vereiste volgorde.");
eis(sectie.indexOf(pending)>sectie.indexOf("timer=setTimeout(async()=>{"),"Wachtstatus staat niet binnen de bestaande debouncecallback.");
eis(sectie.includes('zoekMeldingToon("Niets gevonden")'),"Bestaande niets-gevondenstatus is verdwenen.");
eis(sectie.includes('zoekMeldingToon("Zoeken is niet gelukt. Probeer het opnieuw.")'),"Bestaande zoekfoutstatus is verdwenen.");
eis(sectie.includes('zoekPanelenSluit(true);zoekStatus.textContent="";'),"Nieuwe invoer ruimt oude zoekstatus/resultaten niet meer direct op.");

const applyBron=fs.readFileSync(path.join(__dirname,"apply-location-search-pending-feedback-20260908.js"),"utf8");
eis(!applyBron.includes("aria-busy"),"Deze laag mag de bestaande forecast aria-busy-owner niet overnemen.");
eis(!applyBron.includes("api.open-meteo.com/v1/forecast"),"Deze laag mag geen forecastrequest toevoegen.");

console.log("Location-search pending feedback: bestaande zoekmelding toont Plaatsen zoeken tijdens de geocoder-wacht; latest-wins, niets-gevonden/fout en forecast-busy ownership blijven intact.");
