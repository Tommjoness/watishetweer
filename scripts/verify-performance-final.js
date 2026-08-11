"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");

function exact(tekst,naam){
  const n=html.split(tekst).length-1;
  if(n!==1)throw new Error(naam+" moet exact één keer voorkomen; gevonden "+n);
}
exact("/* ===== PERFORMANCE FINAL 20260811 ===== */","performance-marker");
exact("&forecast_days=7&forecast_hours=168&timezone=auto&wind_speed_unit=kmh","begrensde forecast-horizon");
if(html.includes("&forecast_days=7&timezone=auto&wind_speed_unit=kmh"))throw new Error("Onbegrensde forecast-horizon staat nog in de finale artifact.");
for(const tekst of [
  "const zoneFormatterCache=new Map();",
  "zoneFormatterCache.size>24",
  "const lokaleMinutenCache=new Map();",
  "lokaleMinutenCache.size>4096",
  "zoneFormatter(tijdzone).formatToParts(new Date(ms))"
])if(!html.includes(tekst))throw new Error("Performance-invariant ontbreekt: "+tekst);

const begin=html.indexOf("/* ===== CENTRALE INTERPRETATIE-ENGINE ===== */"),eind=html.indexOf("/* ===== EINDE CENTRALE INTERPRETATIE-ENGINE ===== */",begin);
if(begin<0||eind<=begin)throw new Error("Centrale interpretatie-engine ontbreekt.");
const engine=html.slice(begin,eind);
const zoneStart=engine.indexOf("function zoneDelen(ms,tijdzone){"),zoneEind=engine.indexOf("function zoneOffset(ms,tijdzone){",zoneStart);
if(zoneStart<0||zoneEind<=zoneStart)throw new Error("zoneDelen ontbreekt in centrale engine.");
if(/new Intl\.DateTimeFormat/.test(engine.slice(zoneStart,zoneEind)))throw new Error("zoneDelen bouwt nog per conversie een formatter.");

const scripts=[...html.matchAll(/<script(?![^>]* src=)[^>]*>([^]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime gevonden.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:performance-verify-"+(i+1)}));
console.log("Performance-final geverifieerd: forecast begrensd en centrale tijdconversie hergebruikt formatter/cache.");