"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {BRON,PRODUCTIE,VISUAL_CROSSING_LABEL}=require("./apply-weather-fallback-hedge.js");

const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
const aantal=(tekst)=>html.split(tekst).length-1;

if(aantal(BRON)!==0)throw new Error("Oud sequentieel weerfallbackblok staat nog in artifact.");
if(aantal(PRODUCTIE)!==1)throw new Error("Hedged weerfallback ontbreekt of staat dubbel: "+aantal(PRODUCTIE));
for(const invariant of [
  "const WEER_HEDGE_MS=5000;",
  "const WEER_FALLBACK_TIMEOUT_MS=5000;",
  "const volledigeRequest=weatherNowChildRequest(weerController.signal);",
  "weatherNowEisGeldigeForecast(j(f,{timeoutMs:10000,signal:volledigeRequest.signal}))",
  "weatherNowEisGeldigeForecast(j(fmin,{timeoutMs:WEER_FALLBACK_TIMEOUT_MS,signal:openMeteoRequest.signal}))",
  "weatherNowEisGeldigeForecast(j(w,{timeoutMs:WEER_FALLBACK_TIMEOUT_MS,signal:weatherApiRequest.signal}))",
  "weatherNowEersteGeslaagdeForecast([",
  "annuleerFallback",
  "if(mijnBeurt!==laadTeller) return;",
  "function weatherNowGeldigeForecast(data)",
  "function weatherNowEisGeldigeForecast(belofte)",
  "function weatherNowChildRequest(parentSignal)",
  "const w=\"/api/forecast?lat=\"",
  `>${VISUAL_CROSSING_LABEL}</a>`,
  `visualCrossing=pak(\"${VISUAL_CROSSING_LABEL}\")`,
  "visualCrossing.outerHTML",
  ">WeatherAPI.com</a>",
  "weatherApi=pak(\"WeatherAPI.com\")",
  "weatherApi.outerHTML",
  "Weersinformatie is algemeen en probabilistisch."
]){
  if(!html.includes(invariant))throw new Error("Weerfallback-invariant ontbreekt: "+invariant);
}

if(html.includes("https://api.weatherapi.com"))throw new Error("WeatherAPI-keyroute mag nooit rechtstreeks vanuit de browser worden aangeroepen.");
if(html.includes("https://weather.visualcrossing.com"))throw new Error("Visual Crossing-keyroute mag nooit rechtstreeks vanuit de browser worden aangeroepen.");
if((html.match(/\/api\/forecast\?lat=/g)||[]).length!==1)throw new Error("Same-origin providerfallbackroute ontbreekt of staat dubbel.");
if((html.match(/Weather Data Provided by Visual Crossing/g)||[]).length<1)throw new Error("Visual Crossing-verplichte bronvermelding ontbreekt.");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime in definitief artifact.");
scripts.forEach((code,i)=>new vm.Script(code,{filename:"public/index.html:verify-weather-fallback-"+(i+1)}));
console.log("Weather fallback artifact: normale Open-Meteo-load enkelvoudig, 5s hedge, lichte Open-Meteo/same-origin provider-race, Visual Crossing server-side vóór WeatherAPI, loser-abort, stale-load guards, keybescherming en verplichte bronvermelding aanwezig.");
