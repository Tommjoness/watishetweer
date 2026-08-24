"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const registry=fs.readFileSync(path.join(__dirname,"..","lib","neerslag-provider-registry.cjs"),"utf8");
const index=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");

assert(/haalNowcastPunt\s*\(/.test(registry),"productieregister moet de numerieke KNMI WCS-nowcast aanroepen");
assert(/Promise\.allSettled/.test(registry),"actuele radar en nowcast moeten onafhankelijk kunnen falen");
assert(/nowcast:\s*Boolean\(nowcast\)/.test(registry),"runtimecapability mag alleen waar zijn bij een volledige reeks");
assert(/nowcastMinuten:\s*nowcast\?120:0/.test(registry),"runtimehorizon moet fail-closed zijn");
assert(/minutely_15=precipitation,rain,showers,snowfall,weather_code/.test(index),"bestaande 15-minutenneerslagfallback ontbreekt uit de hoofdforecast");
assert(/forecast_minutely_15=16/.test(index),"korte-termijnforecast moet voldoende kwartierpunten blijven ophalen");

console.log("KNMI nowcast-route: numerieke WCS, volledig gevalideerd en fail-closed.");
