"use strict";

const assert=require("assert");
const {isProviderStoring,isProviderStoringBericht,beschrijf}=require("./provider-storing.js");

const FOUT503="Failed to load resource: the server responded with a status of 503 (Service Unavailable)";
const FOUT429="Failed to load resource: the server responded with a status of 429 (Too Many Requests)";
const FOUT404="Failed to load resource: the server responded with a status of 404 (Not Found)";
const OM="https://api.open-meteo.com/v1/forecast?latitude=52.37&longitude=4.9&current=temperature_2m";

/* Tijdelijke storing bij Open-Meteo: opgevangen door de app. */
assert.equal(isProviderStoring(FOUT503,OM),true);
assert.equal(isProviderStoring(FOUT429,OM),true);
assert.equal(isProviderStoring("Failed to load resource: the server responded with a status of 502 (Bad Gateway)","https://air-quality-api.open-meteo.com/v1/air-quality?x=1"),true);
assert.equal(isProviderStoring(FOUT503,"https://geocoding-api.open-meteo.com/v1/search?name=Utrecht"),true);

/* Alles daarbuiten blijft een echte fout. */
assert.equal(isProviderStoring(FOUT503,"https://watishetweer.nl/api/forecast?lat=1&lon=2"),false,"5xx van de eigen site is een fout");
assert.equal(isProviderStoring(FOUT503,"https://watishetweer.nl/app-abc.min.js"),false);
assert.equal(isProviderStoring(FOUT404,OM),false,"4xx van Open-Meteo is een fout in de aanvraag");
assert.equal(isProviderStoring(FOUT503,"https://api.open-meteo.com.evil.example/v1/forecast"),false,"alleen de echte Open-Meteo-host");
assert.equal(isProviderStoring(FOUT503,"http://api.open-meteo.com/v1/forecast"),false,"alleen https");
assert.equal(isProviderStoring("Uncaught TypeError: x is undefined",OM),false,"scriptfouten tellen altijd");
assert.equal(isProviderStoring(FOUT503,""),false,"zonder URL geen uitzondering");

/* Playwright-consolebericht. */
const bericht=(tekst,url)=>({text:()=>tekst,location:()=>({url})});
assert.equal(isProviderStoringBericht(bericht(FOUT503,OM)),true);
assert.equal(isProviderStoringBericht(bericht(FOUT503,"https://watishetweer.nl/api/waarschuwingen?lat=1")),false);
assert.equal(isProviderStoringBericht({text:()=>FOUT503,location:()=>{throw new Error("x");}}),false);
assert.deepEqual(beschrijf(bericht(FOUT503,OM)),{status:503,url:"https://api.open-meteo.com/v1/forecast"});

console.log("Provider-storing: alleen 429/5xx van Open-Meteo-hosts is een opvangbare storing; eigen 5xx, 4xx, scriptfouten en andere hosts blijven fouten.");
