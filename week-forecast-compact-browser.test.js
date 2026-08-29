"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

/* Deze standaard npm-test bewaakt het definitieve gebouwde artifact zonder een
 * extra Playwright-package te vereisen. De echte browsercontrole draait in de
 * quality/checkpoint-omgevingen en, na merge, expliciet op productie voor zowel
 * Amsterdam als Malargüe. */
const html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");

for(const vereist of [
  "WeatherNowWeekForecastCompact20260829",
  "function ruimWeekNeerslagNotitiesOp(){",
  'days.querySelectorAll(".row.day:not(.kop)").forEach(rij=>{',
  'rij.classList.remove("heeft-neerslagnotitie")',
  'rij.removeAttribute("aria-describedby")',
  'const uitleg=document.getElementById("dagenneerslaguitleg");',
  'const basisDagenWeekForecastCompact=dagen;',
  "ruimWeekNeerslagNotitiesOp();"
]){
  assert(html.includes(vereist),"compacte weekverwachting invariant ontbreekt: "+vereist);
}

/* De cleanup moet generiek op de week-DOM werken en mag niet aan een land,
 * continent, provider, tijdzone of plaatsnaam gekoppeld zijn. */
const markerStart=html.indexOf("/* Compacte weekverwachting 2026-08-29.");
const markerEind=html.indexOf("/* ===== EINDE COMPACTE WEEKVERWACHTING 20260829 ===== */",markerStart);
assert(markerStart>=0&&markerEind>markerStart,"compacte weekruntime kon niet worden afgebakend");
const runtime=html.slice(markerStart,markerEind);
for(const ongewenst of ["Malargüe","Amsterdam","land===","S.land","timezone","provider"]){
  assert(!runtime.includes(ongewenst),"compacte weekcleanup mag niet locatie/provider-specifiek zijn: "+ongewenst);
}

console.log("Compacte weekverwachting artifactcontract groen: globale late cleanupowner aanwezig zonder extra npm-browserdependency.");
