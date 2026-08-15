"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const registry=fs.readFileSync(path.join(__dirname,"..","lib","neerslag-provider-registry.cjs"),"utf8");
const index=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");

assert(!/haalNowcastPunt\s*\(/.test(registry),"productieregister mag de onbetrouwbare KNMI forecast-WMS niet aanroepen");
assert(/nowcast:\s*false/.test(registry),"KNMI-provider moet nowcast expliciet als niet actief publiceren");
assert(/nowcastMinuten:\s*0/.test(registry),"KNMI-provider mag geen 120-minuten-capability meer claimen");
assert(/minutely_15=precipitation,rain,showers,snowfall,weather_code/.test(index),"bestaande 15-minutenneerslagfallback ontbreekt uit de hoofdforecast");
assert(/forecast_minutely_15=16/.test(index),"korte-termijnforecast moet voldoende kwartierpunten blijven ophalen");

console.log("KNMI nowcast-route: fail-closed; bestaande kwartierforecast blijft actief.");
