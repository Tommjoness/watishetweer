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
exact("&forecast_days=7&forecast_hours=170&timezone=auto&wind_speed_unit=kmh","begrensde forecast-horizon");
exact("const zoneFormatterCache=new Map();","centrale timezone-formattercache");
exact("const zoneDelenCache=new Map();","centrale instant-zonecache");
if(html.includes("&forecast_days=7&timezone=auto&wind_speed_unit=kmh"))throw new Error("Onbegrensde forecast-horizon staat nog in de finale artifact.");
if(html.includes("forecast_hours=168"))throw new Error("Te krappe 168-uurs horizon staat nog in de finale artifact.");
for(const tekst of [
  "zoneFormatterCache.size>24",
  "zoneDelenCache.size>2048",
  "const sleutel=String(tijdzone)+\"|\"+epoch;",
  "if(bewaard)return zoneDelenObject(bewaard);",
  "zoneFormatter(tijdzone).formatToParts(instant)",
  "const lokaleMinutenCache=new Map();",
  "lokaleMinutenCache.size>4096",
  "let gok=doel,zoneGeldig=true;",
  "if(off===null){zoneGeldig=false;break;}",
  "if(zoneGeldig)return gok;",
  "function providerNaarMinuten(tijd,utcOffsetSeconden){"
])if(!html.includes(tekst))throw new Error("Performance-invariant ontbreekt: "+tekst);

const begin=html.indexOf("/* ===== CENTRALE INTERPRETATIE-ENGINE ===== */"),eind=html.indexOf("/* ===== EINDE CENTRALE INTERPRETATIE-ENGINE ===== */",begin);
if(begin<0||eind<=begin)throw new Error("Centrale interpretatie-engine ontbreekt.");
const engine=html.slice(begin,eind);
const zoneStart=engine.indexOf("function zoneDelen(ms,tijdzone){"),zoneEind=engine.indexOf("function zoneOffset(ms,tijdzone){",zoneStart);
if(zoneStart<0||zoneEind<=zoneStart)throw new Error("zoneDelen ontbreekt in centrale engine.");
const zoneBlok=engine.slice(zoneStart,zoneEind);
if(/new Intl\.DateTimeFormat/.test(zoneBlok))throw new Error("zoneDelen bouwt nog per conversie een formatter.");
if(!zoneBlok.includes("new Date(ms),epoch=instant.getTime()"))throw new Error("zoneDelen cachet niet op de canonieke instant.");
if(!zoneBlok.includes("return zoneDelenObject(bewaard)"))throw new Error("zoneDelen geeft op cache-hit geen vers resultaatobject terug.");
if(zoneBlok.includes("return bewaard"))throw new Error("zoneDelen mag geen gedeeld mutable cacheobject teruggeven.");
if(!engine.includes('  statusRang,\n  zoneDelen\n};'))throw new Error("Centrale pure zoneDelen-helper is niet beschikbaar voor gedeeld hergebruik.");

const q1Begin=html.indexOf("/* ===== CHECKPOINT 25 Q1 ===== */");
const q1ZoneStart=html.indexOf("function zoneDelen(ms,tijdzone){",q1Begin);
const q1ZoneEind=html.indexOf("function zoneOffset(ms,tijdzone){",q1ZoneStart);
if(q1Begin<0||q1ZoneStart<0||q1ZoneEind<=q1ZoneStart)throw new Error("Q1 zoneDelen ontbreekt of is niet eenduidig begrensd.");
const q1Zone=html.slice(q1ZoneStart,q1ZoneEind);
const delegatie='if(centraal&&typeof centraal.zoneDelen==="function")return centraal.zoneDelen(ms,tijdzone);';
if(!q1Zone.includes("const centraal=root.WeatherNowInterpretatie;")||!q1Zone.includes(delegatie))throw new Error("Q1 hergebruikt de centrale timezoneconversie niet.");
if(!q1Zone.includes('new Intl.DateTimeFormat("en-CA"'))throw new Error("Q1 standalone fallback is onbedoeld verwijderd.");
if(q1Zone.indexOf(delegatie)>q1Zone.indexOf('new Intl.DateTimeFormat("en-CA"'))throw new Error("Q1 probeert de dure fallback vóór de centrale cache.");
if(q1Zone.includes("zoneDelenCache"))throw new Error("Q1 mag geen tweede instant-zonecache bezitten.");

const lokaalStart=engine.indexOf("function lokaalNaarMinuten(tijd,tijdzone,utcOffsetSeconden){");
const lokaalSluit=engine.indexOf("\n}\n",lokaalStart);
const providerStart=engine.indexOf("function providerNaarMinuten(tijd,utcOffsetSeconden){");
if(lokaalStart<0||lokaalSluit<=lokaalStart)throw new Error("lokaalNaarMinuten ontbreekt of is niet eenduidig begrensd.");
if(providerStart<=lokaalSluit)throw new Error("providerNaarMinuten is door de performancepatch in lokaalNaarMinuten genest geraakt.");
const lokaalBlok=engine.slice(lokaalStart,lokaalSluit+2);
if(lokaalBlok.includes("providerNaarMinuten"))throw new Error("Provider-tijdhelper hoort niet in de civiele-tijdcachefunctie.");

const naarUtcStart=html.indexOf("function naarUTC(lokaal){"),naarUtcEind=html.indexOf("function naarLokaal(msUTC){",naarUtcStart);
if(naarUtcStart<0||naarUtcEind<=naarUtcStart)throw new Error("naarUTC ontbreekt in finale artifact.");
const naarUtc=html.slice(naarUtcStart,naarUtcEind);
if(!naarUtc.includes("zoneGeldig=false")||!naarUtc.includes("utc_offset_seconds"))throw new Error("naarUTC mist de veilige numerieke offsetfallback.");
if((naarUtc.match(/return doel-off;/g)||[]).length!==1)throw new Error("naarUTC numerieke fallback is niet eenduidig.");

const scripts=[...html.matchAll(/<script(?![^>]* src=)[^>]*>([^]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime gevonden.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:performance-verify-"+(i+1)}));
console.log("Performance-final geverifieerd: veilige 170-uurs horizon, één centrale begrensde instant-zonecache gedeeld met Q1, verse hit-objecten, top-level provider-as en consistente tijdzonefallback.");