"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const ROOT=__dirname;
const OUT=path.join(ROOT,"public");
const NIET_PUBLICEREN=new Set([
  ".git",".github","api","node_modules","public",
  "build-weather.js","interpretatie-engine.js","interpretatie-engine.test.js",
  "run.js","kern.js","data.js","package.json","package-lock.json","vercel.json"
]);

function kopieer(bron,doel){
  const stat=fs.statSync(bron);
  if(stat.isDirectory()){
    fs.mkdirSync(doel,{recursive:true});
    for(const naam of fs.readdirSync(bron)) kopieer(path.join(bron,naam),path.join(doel,naam));
  }else{
    fs.mkdirSync(path.dirname(doel),{recursive:true});
    fs.copyFileSync(bron,doel);
  }
}

fs.rmSync(OUT,{recursive:true,force:true});
fs.mkdirSync(OUT,{recursive:true});
for(const naam of fs.readdirSync(ROOT)){
  if(NIET_PUBLICEREN.has(naam)) continue;
  kopieer(path.join(ROOT,naam),path.join(OUT,naam));
}

const indexPad=path.join(ROOT,"index.html");
const enginePad=path.join(ROOT,"interpretatie-engine.js");
let html=fs.readFileSync(indexPad,"utf8");
const engine=fs.readFileSync(enginePad,"utf8");

const startMarker="/* ---------- start ---------- */";
if((html.match(/\/\* ---------- start ---------- \*\//g)||[]).length!==1){
  throw new Error("Startmarker ontbreekt of komt meer dan eenmaal voor; interpretatie-engine niet ingevoegd.");
}
if(html.includes("CENTRALE INTERPRETATIE-ENGINE")){
  throw new Error("Bron-index bevat de interpretatie-engine al; build zou dubbel invoegen.");
}

/* Verrijk uitsluitend de gegevens die de centrale interpretatie nodig heeft.
   De bestaande velden en Best Match-modelkeuze blijven ongewijzigd. */
html=html.replace(
  "current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,"
  +"\n    +\"weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m\"",
  "current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,"
  +"\n    +\"rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m\""
);
html=html.replace(
  "&minutely_15=precipitation&past_hours=24",
  "&minutely_15=precipitation,rain,showers,snowfall,weather_code&forecast_minutely_15=16&past_minutely_15=4&past_hours=24"
);
html=html.replace(
  "precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,",
  "precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,"
);
html=html.replace(
  "precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,",
  "precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,"
);

html=html.replace("<div class=\"eyebrow\">Neerslag afgelopen uur</div><div class=\"sval\" id=\"prec\">",
                  "<div class=\"eyebrow\">Neerslag recent</div><div class=\"sval\" id=\"prec\">");
html=html.replace("+rij(\"neerslagkans\",(heel(G.P&&G.P[i])?G.P[i]:\"–\")+\"%\",TEAL)",
                  "+rij(\"kans uur tot\",(heel(G.P&&G.P[i])?G.P[i]:\"–\")+\"%\",TEAL)");
html=html.replace(
  "<span class=\"bron\"><b>Weer</b> <a href=\"https://open-meteo.com\" target=\"_blank\" rel=\"noopener\">Open-Meteo</a>, ECMWF en DWD, CAMS</span>",
  "<span class=\"bron\"><b>Weer</b> <a href=\"https://open-meteo.com\" target=\"_blank\" rel=\"noopener\">Open-Meteo Best Match</a> · <b>Luchtkwaliteit</b> CAMS</span>"
);

html=html.replace(startMarker,
  "/* ===== CENTRALE INTERPRETATIE-ENGINE ===== */\n"+engine+"\n/* ===== EINDE CENTRALE INTERPRETATIE-ENGINE ===== */\n\n"+startMarker);

/* Compileer ieder inline scriptblok. Dit voert niets uit, maar blokkeert een
   deployment bij een syntaxisfout in de bestaande code of de invoeging. */
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length) throw new Error("Geen inline scriptblok gevonden in de gebouwde index.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:inline-"+(i+1)}));

if(!html.includes("WeatherNowInterpretatie")) throw new Error("Interpretatie-engine ontbreekt na build.");
if(!html.includes("forecast_minutely_15=16")) throw new Error("Uitgebreide kwartierdata ontbreekt na build.");
if(!html.includes("waarden links van ‘nu’ zijn voorbij")) throw new Error("Grafiekcontext ontbreekt na build.");

fs.writeFileSync(path.join(OUT,"index.html"),html,"utf8");

const swPad=path.join(OUT,"sw.js");
if(fs.existsSync(swPad)){
  let sw=fs.readFileSync(swPad,"utf8");
  sw=sw.replace(/weerbriefing-v\d+/g,"weerbriefing-v73");
  fs.writeFileSync(swPad,sw,"utf8");
}

console.log("WeatherNow-build geslaagd: centrale interpretatie-engine ingevoegd en syntactisch gecontroleerd.");
