"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const runtimePad=path.join(__dirname,"ui-polish-20260813-runtime.js");
const apply=fs.readFileSync(path.join(__dirname,"apply-ui-polish-20260813.js"),"utf8");
const q4=fs.readFileSync(path.join(__dirname,"q4-rain-runtime.js"),"utf8");

/* Na de ownermigraties heeft de historische UI-polishruntime geen productie-
   verantwoordelijkheid meer. Regenperiodedaglabels worden door Q4 zelf
   geformatteerd; houd dus geen losse compatibility-runtime in het artifact. */
assert(!fs.existsSync(runtimePad),"historische UI-polishruntime hoort verwijderd te zijn");
assert(!apply.includes("ui-polish-20260813-runtime.js"),"apply-stap mag de verwijderde runtime niet meer inlezen");
assert(!apply.includes("UI POLISH RUNTIME 20260813"),"apply-stap mag geen runtime-marker meer injecteren of bewaken");
assert(!apply.includes("WeatherNowUiPolish20260813"),"apply-stap mag geen historische globale helper-API meer verwachten");
assert(!apply.includes('runtime+"\\n"+START'),"apply-stap mag geen historische runtime meer vóór startup injecteren");

for(const invariant of [
  "const q4DagKort=",
  "function q4PeriodeTijdvak(g,p){",
  'const dag=vanDatum&&basisDatum&&vanDatum!==basisDatum?vanDag+" ":"";'
])assert(q4.includes(invariant),"Q4 mist eigen dag-/periodetijdformatter: "+invariant);

console.log("UI-polish runtime-retirement groen: dode compatibility-runtime verwijderd; Q4 blijft eigenaar van regenperiode-daglabels.");
