"use strict";

const fs=require("fs");
const path=require("path");

const doel=path.join(__dirname,"..","public","index.html");
if(!fs.existsSync(doel))throw new Error("public/index.html ontbreekt.");
const html=fs.readFileSync(doel,"utf8");

const marker="const poolZonSentinel=(sr,ss)=>";
const aantal=html.split(marker).length-1;
if(aantal!==1)throw new Error("Definitief artifact moet exact één poolZonSentinel-helper bevatten; gevonden: "+aantal);
if(!html.includes('if(poolZonSentinel(sr,ss)) continue;'))throw new Error("Grafiekfilter voor poolzon-sentinels ontbreekt.");
if(!html.includes('hhmm(sr)!=="00:00"||hhmm(ss)!=="00:00"'))throw new Error("Poolfilter bewaakt niet expliciet het 00:00-sentinelpaar.");
if(!html.includes('return dagen===0||dagen===1;'))throw new Error("Poolfilter bewaakt niet de nul-/24-uurs sentinelvormen.");

console.log("Definitief artifact filtert pooldag/poolnacht-sentinels uit de 24-uurgrafiek.");
