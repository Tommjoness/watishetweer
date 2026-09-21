"use strict";

const assert=require("assert");
const vm=require("vm");
const {
  STYLE_ID,
  THEMA_SESSIE_KEY,
  THEMA_LEGACY_KEY,
  CSS,
  WEATHER_RUNTIME,
  HUB_RUNTIME,
  patchWeatherHtml
}=require("./apply-theme-mobile-session-20260915.js");

assert.equal(THEMA_SESSIE_KEY,"weerbriefing.thema.sessie");
assert.equal(THEMA_LEGACY_KEY,"weerbriefing.thema");
assert(CSS.includes("grid-template-columns:repeat(2,minmax(0,1fr))!important"),"mobiele tools moeten twee actie-kolommen gebruiken");
assert(CSS.includes("grid-template-columns:repeat(3,minmax(0,1fr))!important"),"themakeuze moet visueel drie gelijke segmenten hebben");
assert(CSS.includes("grid-template-columns:subgrid!important"),"Licht en Donker delen niet exact de drie kolommen van de hoofdcontrol");
assert.equal((CSS.match(/display:contents!important/g)||[]).length,2,"de switchcontainer mag Auto niet geometrisch overlappen op desktop of mobiel");
assert.equal((CSS.match(/:has\(#thema-switch:focus-visible\)/g)||[]).length,2,"de inhoudsloze switchcontainer mist een zichtbare groepsfocus");
assert(CSS.includes("@media(min-width:431px)"),"desktop/tablet moeten dezelfde segmented-controlpresentatie krijgen");
assert(CSS.includes("width:192px!important"),"desktop segmented control mist een compacte, expliciete breedte");
assert(CSS.includes("grid-column:1 / 4!important"),"desktop Licht/Auto/Donker delen geen volledige driekolomscontrol");
assert(CSS.includes(".wiw-theme-auto{\n    grid-column:2!important"),"Auto staat niet in het middelste segment");
assert(CSS.includes(".wiw-theme-moon{\n    grid-column:3!important"),"Donker staat niet in het rechtersegment");
assert(CSS.includes('.wiw-theme-sun::after{content:"Licht";margin-left:8px}'),"Licht-label of icoonafstand ontbreekt");
assert(CSS.includes('.wiw-theme-moon::after{content:"Donker";margin-left:8px}'),"Donker-label of icoonafstand ontbreekt");
assert(!CSS.includes("font-weight:600!important"),"actieve optie mag typografisch niet zwaarder worden");
assert(CSS.includes("box-shadow:inset 0 -1px 0 var(--ink-45)!important"),"subtiele geselecteerde staat ontbreekt");
assert(CSS.includes("min-height:46px!important"),"mobiele themakeuze mist ruim touchdoel");
assert(WEATHER_RUNTIME.includes("sessionStorage.getItem(THEMA_SESSIE_KEY)"),"themakeuze leest niet uit sessionStorage");
assert(WEATHER_RUNTIME.includes("sessionStorage.setItem(THEMA_SESSIE_KEY"),"themakeuze schrijft niet naar sessionStorage");
assert(WEATHER_RUNTIME.includes("localStorage.removeItem(THEMA_LEGACY_KEY)"),"oude permanente voorkeur wordt niet geneutraliseerd");
assert(!WEATHER_RUNTIME.includes('ls.get("weerbriefing.thema"'),"weather runtime mag oude permanente voorkeur niet lezen");
assert(HUB_RUNTIME.includes("sessionStorage.getItem(SESSIE)"),"hub leest niet uit dezelfde sessievoorkeur");
assert(HUB_RUNTIME.includes("localStorage.removeItem(PREF)"),"hub neutraliseert oude permanente voorkeur niet");
new vm.Script(WEATHER_RUNTIME,{filename:"weather-theme-runtime"});
new vm.Script(HUB_RUNTIME,{filename:"hub-theme-runtime"});

const fixture=`<!doctype html><html><head></head><body><main id="app"><div id="thema" class="wiw-theme-control" role="group" aria-label="Weergave kiezen"><button id="thema-auto">Auto</button><button id="thema-switch"><span data-thema-handmatig="licht"></span><span data-thema-handmatig="donker"></span></button></div></main><script>${"/* ---------- thema ---------- */"}\nconst oud=true;\n${"/* ---------- stempel en verversen ---------- */"}\nconst later=true;</script></body></html>`;
const r=patchWeatherHtml(fixture,"fixture.html");
assert.equal(r.geraakt,true,"weather fixture moet geraakt worden");
assert(r.html.includes(`id="${STYLE_ID}"`),"finale style-id ontbreekt");
assert(r.html.includes("wiw-theme-segmented-20260915"),"segmented class ontbreekt");
assert(!r.html.includes("const oud=true"),"oude themaruntime bleef staan");
assert(r.html.includes("const later=true"),"runtime na thema-anker werd geraakt");

console.log("Theme control/session regressies groen: desktop en mobiel delen de 3-segmentpresentatie; sessieopslag, legacy-neutralisatie en runtimepatch geborgd.");
