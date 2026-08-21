"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  START_BRON,START_PRODUCTIE,DEKKING_BRON,DEKKING_PRODUCTIE,
  EIND_BRON,EIND_PRODUCTIE,FOUT_BRON,FOUT_PRODUCTIE,
  CSS_BRON,CSS_PRODUCTIE,pasWarningRenderStateToe
}=require("./warning-render-state.js");

const bron=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
for(const [label,anker] of [
  ["oude laadstatus",START_BRON],["oude dekkingpresentatie",DEKKING_BRON],
  ["oude kaartpresentatie",EIND_BRON],["oude foutpresentatie",FOUT_BRON],
  ["oude warningstijl",CSS_BRON]
])assert.equal(bron.split(anker).length-1,1,"ontwikkeltemplate moet exact één "+label+"-anker hebben");
assert(!bron.includes(CSS_PRODUCTIE),"ontwikkeltemplate mag finale warningstijl nog niet bevatten");

const uit=pasWarningRenderStateToe(bron);
for(const [label,productie] of [
  ["laadstatus",START_PRODUCTIE],["dekkingpresentatie",DEKKING_PRODUCTIE],
  ["kaartpresentatie",EIND_PRODUCTIE],["foutpresentatie",FOUT_PRODUCTIE],
  ["warningstijl",CSS_PRODUCTIE]
])assert.equal(uit.split(productie).length-1,1,"base-build moet exact één finale "+label+" bezitten");
for(const oud of [START_BRON,DEKKING_BRON,EIND_BRON,FOUT_BRON,CSS_BRON])assert(!uit.includes(oud),"oude waarschuwingpresentatie mag niet in het base-artifact blijven");

/* Request-, scope- en selectiegedrag blijft eigendom van dezelfde bestaande
   renderer. Alleen de uiteindelijke DOM/copy/CSS verandert van eigenaar. */
for(const invariant of [
  'const d=await j("/api/waarschuwingen?lat="+lat+"&lon="+lon+landParam,{timeoutMs:7000,signal:waarschuwingController.signal});',
  'if(mijnBeurt!==waarschuwingTeller||S.lat!==lat||S.lon!==lon) return;',
  'const nu=Date.now(),rang={rood:3,oranje:2,geel:1},uniek=new Map();',
  'const sleutel=[w.titel||"",w.tot||"",w.gebied||""].join("|").toLowerCase();',
  'const lijst=[...uniek.values()].sort((a,b)=>(rang[b.niveau]||0)-(rang[a.niveau]||0)',
  'S.actieveWaarschuwingen=lijst;',
  'lijst.slice(0,3).map(w=>',
  'waarschuwingGeldigTot(w.tot)'
])assert(uit.includes(invariant),"waarschuwingowner veranderde bestaand request/selectiecontract: "+invariant);

for(const zichtbaar of [
  'data-ui-warning-loading="1">Officiële weerwaarschuwingen controleren…',
  "Geen officiële weerwaarschuwingen voor deze locatie.",
  "Voor deze locatie kunnen we geen officiële weerwaarschuwingen tonen.",
  "Officiële weerwaarschuwingen konden tijdelijk niet worden opgehaald.",
  'data-ui-severity="${ernst}"',
  'class="waarsch-meta"',
  'class="waarsch-details"',
  "Details van de waarschuwing",
  '<p lang="en">${esc(nwsTekst)}</p>',
  '/\\*\\s*(?:WHAT|WHERE|WHEN|IMPACTS)\\.\\.\\./i.test(nwsTekst)'
])assert(uit.includes(zichtbaar),"finale waarschuwingpresentatie ontbreekt: "+zichtbaar);

/* De CSS-migratie bevriest letterlijk de al zichtbare productiestijl. Geen
   selector, maat, font, kleur, border of NWS-detailpresentatie mag hier stiekem
   mee veranderen: alleen de eigenaar verhuist naar de warning-base-owner. */
for(const regel of [
  '#waarschuwingen>.msg{font-size:12.5px;color:var(--ink-45);padding:7px 0}',
  '.waarsch{border-left:1px solid var(--rule);padding:8px 0 8px 12px;margin-top:var(--s2)}',
  '.waarsch h3{font-family:var(--sans);font-weight:500;font-size:14px;line-height:1.35;margin:0 0 3px;color:var(--ink)}',
  '.waarsch p{margin:0;font-size:13px;line-height:1.45;color:var(--ink-70)}',
  '.waarsch[data-ui-severity="rood"]{border-left:3px solid var(--carmine)}',
  '.waarsch[data-ui-severity="rood"] h3{color:var(--carmine)}',
  '.waarsch-details{margin-top:6px;font-size:12px;color:var(--ink-45)}',
  '.waarsch-details summary{display:inline;cursor:pointer;color:var(--ink-45);box-shadow:inset 0 -1px 0 var(--rule)}',
  '.waarsch-details summary:hover{color:var(--ink)}',
  '.waarsch-details p{margin-top:7px;font-size:12px;color:var(--ink-45);max-width:92ch}'
]){
  assert(CSS_PRODUCTIE.includes(regel),"warning CSS-contract mist bestaande productieregel: "+regel);
  assert.equal(uit.split(regel).length-1,1,"finale warning CSS-regel moet exact één keer voorkomen: "+regel);
}

/* De oude tussenformuleringen en oude rode-standaardstijl mogen nergens meer
   als finale base-output leven. */
assert(!uit.includes("Officiële weerwaarschuwingen zijn voor deze locatie niet beschikbaar."));
assert(!uit.includes("Officiële weerwaarschuwingen konden niet worden gecontroleerd."));
assert(!uit.includes('.waarsch{border-left:3px solid var(--carmine);padding:10px 0 10px 14px'));

/* De owner mag niet stil nogmaals op een reeds gemigreerd artifact muteren. */
assert.throws(()=>pasWarningRenderStateToe(uit),/bronanker ontbreekt of is dubbel/);

console.log("Warning-render contract groen: requeststates, kaartpresentatie en finale CSS hebben één base-build owner; bron, scope, filtering en sortering blijven ongewijzigd.");
