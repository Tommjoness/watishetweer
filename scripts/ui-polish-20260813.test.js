"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const apply=fs.readFileSync(path.join(__dirname,"apply-ui-polish-20260813.js"),"utf8");
const warningOwner=fs.readFileSync(path.join(__dirname,"warning-render-state.js"),"utf8");
const dailyOwner=fs.readFileSync(path.join(__dirname,"daily-forecast-owner.js"),"utf8");
const q4=fs.readFileSync(path.join(__dirname,"q4-rain-runtime.js"),"utf8");
const runtimePad=path.join(__dirname,"ui-polish-20260813-runtime.js");

/* De historische runtime is na de ownermigraties volledig verdwenen. Deze test
   bewaakt alleen nog wat apply-ui-polish werkelijk bezit: accessibility en
   fail-fast contracten richting de inhoudelijke owners. */
assert(!fs.existsSync(runtimePad),"UI-polish compatibility-runtime hoort verwijderd te zijn");
assert(!apply.includes("ui-polish-20260813-runtime.js"),"apply-stap mag de verwijderde runtime niet meer lezen");
assert(!apply.includes('runtime+"\\n"+START'),"apply-stap mag geen historische runtime meer injecteren");
assert(apply.includes('if(html.includes("WeatherNowUiPolish20260813")||html.includes("UI POLISH RUNTIME 20260813"))'),"finale applyguard tegen terugkeer runtime ontbreekt");

/* Regenperiode-daglabels horen aantoonbaar bij Q4 zelf. */
for(const invariant of [
  "const q4DagKort=",
  "function q4PeriodeTijdvak(g,p){",
  'const dag=vanDatum&&basisDatum&&vanDatum!==basisDatum?vanDag+" ":"";'
])assert(q4.includes(invariant),"Q4 mist eigen regenperiodeformatter: "+invariant);
assert(apply.includes("Q4-regenperiode-owner ontbreekt vóór UI-polish"),"statische applylaag bewaakt Q4 niet fail-fast");
for(const verouderd of ["uiPolishRegenperiodeKansen","uiPolishRegenperiodeDaglabel","data-ui-rain-period-probability"])
  assert(apply.includes(verouderd),"applylaag bewaakt verouderde regenowner niet: "+verouderd);

/* De inhoudelijke base-build owners blijven vóór deze statische laag verplicht. */
for(const invariant of [
  'require("./warning-render-state.js")',"START_PRODUCTIE","EIND_PRODUCTIE","WARNING_CSS_PRODUCTIE",
  'require("./wind-gust-copy-owner.js")',"GUST_PRODUCTIE","HELPER_PRODUCTIE",
  'require("./sunshine-copy-owner.js")',"ZONUREN_PRODUCTIE","ZON_HELPER_PRODUCTIE",
  'require("./daily-forecast-owner.js")',"DAILY_HELPER_PRODUCTIE","DCOND_PRODUCTIE","DRAIN_PRODUCTIE","KOP_PRODUCTIE","KOP_CSS_PRODUCTIE",
  'require("./briefing-copy-owner.js")',"BRIEF_HELPER_PRODUCTIE","VANDAAG_PIEK_PRODUCTIE","MORGEN_PRODUCTIE"
])assert(apply.includes(invariant),"UI-polish applylaag mist upstream ownercontract: "+invariant);

/* De Bereik-kopuitlijning hoort nu bij dezelfde daily owner als de koptekst.
   UI-polish mag de selector niet nogmaals in zijn eigen CSS-template schrijven. */
assert(dailyOwner.includes("KOP_CSS_PRODUCTIE"),"daily owner mist expliciet weekkop-CSScontract");
assert(dailyOwner.includes('.row.day.kop .bar{text-align:center}'),"daily owner mist finale Bereik-uitlijning");
assert(!apply.includes('\n.row.day.kop .bar{text-align:center}\n'),"UI-polish mag Bereik-uitlijning niet meer laat toevoegen");
assert(apply.includes('[KOP_CSS_PRODUCTIE,"weekkop-uitlijning"]'),"UI-polish moet de upstream weekkopowner nog wel fail-fast verifiëren");

/* Warning DOM, copy én CSS hebben één base-owner. De generieke applylaag mag
   alleen verifiëren dat die owner vóór postbuild volledig is toegepast. */
for(const invariant of [
  "Voor deze locatie kunnen we geen officiële weerwaarschuwingen tonen.",
  "Officiële weerwaarschuwingen konden tijdelijk niet worden opgehaald.",
  "Details van de waarschuwing","data-ui-severity","waarsch-details","waarsch-meta",
  "function pasWarningRenderStateToe(html){","CSS_PRODUCTIE",
  '#waarschuwingen>.msg{font-size:12.5px;color:var(--ink-45);padding:7px 0}',
  '.waarsch[data-ui-severity="rood"]{border-left:3px solid var(--carmine)}'
])assert(warningOwner.includes(invariant),"Base warning-owner mist finale presentatieregel: "+invariant);
assert(!apply.includes('\n#waarschuwingen>.msg{font-size:12.5px;color:var(--ink-45);padding:7px 0}\n'),"UI-polish mag warning-CSS niet meer laat injecteren");
assert(!apply.includes('\n.waarsch{border-left:1px solid var(--rule);padding:8px 0 8px 12px;margin-top:var(--s2)}\n'),"UI-polish mag warningkaartstijl niet meer bezitten");
assert(apply.includes('html.split(WARNING_CSS_PRODUCTIE)'),"UI-polish moet de upstream warning-CSS fail-fast verifiëren");
assert(apply.includes('html.includes(WARNING_CSS_BRON)'),"UI-polish moet terugkeer van oude warning-CSS blokkeren");

/* De overgebleven apply-verantwoordelijkheden zijn uitsluitend accessibility. */
assert(apply.includes('const APP_OPEN=\'<div id="app" style="display:none">\''),"main-landmark moet vanuit bestaande #app-container worden opgebouwd");
assert(apply.includes('html=html.replace(APP_OPEN,\'<main id="app" style="display:none">\')'),"#app wordt geen main-landmark");
assert(apply.includes('footer a,footer details summary{display:inline-flex;align-items:center;min-height:44px'),"mobiele footerdoelen missen de 44px-hitbox");

console.log("UI-polish statisch contract groen: geen runtime/weekkop/warning-CSS-owner meer; alleen accessibility blijft en inhoudelijke owners worden upstream bewaakt.");
