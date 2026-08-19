"use strict";

const fs=require("fs");
const path=require("path");
const PRODUCT_CONFIG=require("../product-config.js");

const ROOT=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(ROOT,"public","index.html"),"utf8");
const build=fs.readFileSync(path.join(ROOT,"build-weather.js"),"utf8");
const correctness=fs.readFileSync(path.join(ROOT,"senior-correctness-v2.js"),"utf8");

if(!correctness.includes("function zonDaglichtInfo(sunrise,sunset,isDagWaarden)"))throw new Error("Canonieke zonDaglichtInfo-owner ontbreekt.");
if(!PRODUCT_CONFIG.POLAR_GRAFIEK_PRODUCTIE.includes("WeatherNowCorrectnessV2")||!PRODUCT_CONFIG.POLAR_GRAFIEK_PRODUCTIE.includes("owner.zonDaglichtInfo(sr,ss)"))throw new Error("Poolgrafiek delegeert niet aan de canonieke zonowner.");
if(PRODUCT_CONFIG.POLAR_GRAFIEK_PRODUCTIE.includes("Date.parse")||PRODUCT_CONFIG.POLAR_GRAFIEK_PRODUCTIE.includes("86400000"))throw new Error("Poolgrafiek dupliceert nog datum-/dagverschilsemantiek.");
if(!build.includes("PRODUCT_CONFIG.POLAR_GRAFIEK_BRON")||!build.includes("PRODUCT_CONFIG.POLAR_GRAFIEK_PRODUCTIE"))throw new Error("Base-build assembleert de poolgrafiek-owner niet aantoonbaar.");

const marker="const poolZonSentinel=(sr,ss)=>";
const aantal=html.split(marker).length-1;
if(aantal!==1)throw new Error("Definitief artifact moet exact één poolZonSentinel-integratie bevatten; gevonden: "+aantal);
if(!html.includes('if(poolZonSentinel(sr,ss)) continue;'))throw new Error("Grafiekfilter voor poolzon-sentinels ontbreekt.");
if(!html.includes('hhmm(sr)!=="00:00"||hhmm(ss)!=="00:00"'))throw new Error("Grafiekfilter bewaakt niet expliciet de provider-sentinelvorm.");
if(!html.includes("owner.zonDaglichtInfo(sr,ss)"))throw new Error("Finale grafiek gebruikt de canonieke zonowner niet.");
if(html.includes('const a=Date.parse(String(sr).slice(0,10)+"T00:00:00Z")')||html.includes('const dagen=Math.round((b-a)/86400000)'))throw new Error("Oude dubbele polar-datumsemantiek zit nog in het artifact.");

console.log("Definitief artifact filtert pooldag/poolnacht-sentinels via WeatherNowCorrectnessV2; geen zelfstandige datumsemantiek in de grafiek.");
