"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {execFileSync}=require("child_process");

const bron=fs.readFileSync(path.join(__dirname,"apply-weather-fallback-hedge.js"),"utf8");
const route=fs.readFileSync(path.join(__dirname,"..","api","forecast.mjs"),"utf8");
const hedge=/const WEER_HEDGE_MS=(\d+);/.exec(bron);
const fallback=/const WEER_FALLBACK_TIMEOUT_MS=(\d+);/.exec(bron);
const vcTimeout=/const VISUAL_CROSSING_TIMEOUT_MS = (\d+);/.exec(route);
const weatherTimeout=/const WEATHERAPI_EMERGENCY_TIMEOUT_MS = (\d+);/.exec(route);
const historyTimeout=/const WEATHERAPI_EMERGENCY_HISTORY_TIMEOUT_MS = (\d+);/.exec(route);

assert(hedge,"weerhedge-budget moet expliciet in de productie-owner staan");
assert(fallback,"fallback-timeout moet expliciet in de productie-owner staan");
assert(vcTimeout&&weatherTimeout&&historyTimeout,"serverfallback moet expliciete providerbudgetten hebben");

const hedgeMs=Number(hedge[1]);
const fallbackMs=Number(fallback[1]);
const vcMs=Number(vcTimeout[1]);
const weatherMs=Number(weatherTimeout[1]);
const historyMs=Number(historyTimeout[1]);
assert.equal(hedgeMs,5000,"trage volledige forecast start de lichte fallback na vijf seconden");
assert.equal(fallbackMs,5000,"lichte fallback krijgt vijf seconden eigen budget");
assert(hedgeMs+fallbackMs<=10000,"dubbele providerhang moet rond tien seconden beslissen");
assert(12000-(hedgeMs+fallbackMs)>=2000,"acceptancetest moet minstens twee seconden browser-/UI-marge houden");
assert(vcMs+weatherMs+historyMs<=fallbackMs,"Visual Crossing plus WeatherAPI-noodpad moet binnen het bestaande vijfseconden-clientbudget blijven");
assert(bron.includes("weatherNowEisGeldigeForecast(j(f,{timeoutMs:10000,signal:volledigeRequest.signal}))"),"volledige Open-Meteo-forecast behoudt de bestaande tienseconden-cap en datavalidatie");
assert(bron.includes("weatherNowEisGeldigeForecast(j(fmin,{timeoutMs:WEER_FALLBACK_TIMEOUT_MS,signal:openMeteoRequest.signal}))"),"lichte Open-Meteo-fallback gebruikt de korte cap en een eigen abortsignaal");
assert(bron.includes("weatherNowEisGeldigeForecast(j(w,{timeoutMs:WEER_FALLBACK_TIMEOUT_MS,signal:weatherApiRequest.signal}))"),"same-origin providerfallback gebruikt dezelfde korte cap, validatie en een eigen abortsignaal");
assert(bron.includes("annuleerFallback"),"verliezende fallbackrequests moeten actief worden afgebroken");
assert(bron.indexOf("const volledigeBelofte=")<bron.indexOf("const startFallback="),"normale snelle load moet uitsluitend met Open-Meteo beginnen");
assert(route.indexOf("if (visualCrossingKey)")<route.indexOf("if (weatherApiKey)"),"serverroute moet Visual Crossing vóór WeatherAPI proberen");
assert(route.includes('X-WIW-Weather-Source\": \"visualcrossing')||route.includes('"X-WIW-Weather-Source": "visualcrossing"'),"Visual Crossing bronbewijs ontbreekt");
assert(route.includes('"X-WIW-Weather-Source": "weatherapi"'),"WeatherAPI noodbronbewijs ontbreekt");

execFileSync(process.execPath,[path.join(__dirname,"visualcrossing-forecast.test.mjs")],{stdio:"inherit"});

console.log(`Weather fallback budget groen: normale load start enkelvoudig; na ${hedgeMs} ms delen lichte Open-Meteo en de same-origin providerroute een ${fallbackMs} ms venster; serverketen Visual Crossing ${vcMs} ms -> WeatherAPI ${weatherMs}+${historyMs} ms blijft binnen dat budget.`);