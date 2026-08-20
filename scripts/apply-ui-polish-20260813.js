"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");
const {START_BRON,START_PRODUCTIE,EIND_BRON,EIND_PRODUCTIE}=require("./warning-render-state.js");
const {GUST_BRON,GUST_PRODUCTIE,HELPER_PRODUCTIE}=require("./wind-gust-copy-owner.js");
const {ZONUREN_BRON,ZONUREN_PRODUCTIE,HELPER_PRODUCTIE:ZON_HELPER_PRODUCTIE}=require("./sunshine-copy-owner.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
let html=fs.readFileSync(htmlPad,"utf8");
const runtime=fs.readFileSync(path.join(__dirname,"ui-polish-20260813-runtime.js"),"utf8");
const RUNTIME_MARK="/* ===== UI POLISH RUNTIME 20260813 ===== */";
const CSS_MARK="/* ===== UI POLISH CSS 20260813 ===== */";

if(html.includes(RUNTIME_MARK)||html.includes(CSS_MARK))throw new Error("UI-polish is al toegepast.");
if(!runtime.includes(RUNTIME_MARK))throw new Error("UI-polish runtime mist versie-marker.");

/* Q4 is de enige eigenaar van de regenperiodepresentatie. De historische
   UI-polish etmaal-wrapper is uit de bronruntime verwijderd; deze assemblagestap
   verifieert dat contract alleen nog fail-fast en herschrijft zijn eigen bron
   niet meer tijdens de build. */
for(const verouderd of ["uiPolishRegenperiodeKansen","uiPolishRegenperiodeDaglabel","data-ui-rain-period-probability"]){
  if(runtime.includes(verouderd))throw new Error("Verouderde UI-polish regenperiode-owner staat weer in de bronruntime: "+verouderd);
}
if(!runtime.includes("/* Regenperiodepresentatie wordt volledig beheerd door Q4. */"))
  throw new Error("UI-polish runtime mist het expliciete Q4-ownershipcontract.");

/* Windstootcopy is al in de base-build door de pure wind-gust owner gezet.
   UI-polish mag meters() niet opnieuw wrappen of gustsub achteraf herschrijven. */
if((html.split(GUST_PRODUCTIE).length-1)!==1)throw new Error("Base-build windstootcopy-call ontbreekt of is dubbel vóór UI-polish.");
if((html.split(HELPER_PRODUCTIE).length-1)!==1)throw new Error("Base-build windstootcopy-helper ontbreekt of is dubbel vóór UI-polish.");
if(html.includes(GUST_BRON))throw new Error("Oude windstootcopy heeft de base-build overleefd.");
for(const verouderd of ["uiWindstootTekst","uiBasisMeters",'piek("wind_gusts_10m")','zetTekst("gustsub"']){
  if(runtime.includes(verouderd))throw new Error("Verouderde UI-polish windstootowner staat weer in de bronruntime: "+verouderd);
}
if(!runtime.includes("UI-polish wrapt meters() daarom niet meer."))
  throw new Error("UI-polish runtime mist het expliciete windstoot/pressure ownershipcontract.");

/* Ook zonurencopy is vóór deze late presentatielaag al definitief. De base-owner
   bewaart exact dezelfde lokale dag- en zondata; UI-polish mag de tegel niet
   opnieuw wrappen of zelf daglichturen en copy berekenen. */
if((html.split(ZONUREN_PRODUCTIE).length-1)!==1)throw new Error("Base-build zonurentegel ontbreekt of is dubbel vóór UI-polish.");
if((html.split(ZON_HELPER_PRODUCTIE).length-1)!==1)throw new Error("Base-build zonurencopy-helper ontbreekt of is dubbel vóór UI-polish.");
if(html.includes(ZONUREN_BRON))throw new Error("Oude zonurentegel heeft de base-build overleefd.");
for(const verouderd of ["uiZonurenWoord","uiBasisZonurenTegel","zonurenTegel=function"]){
  if(runtime.includes(verouderd))throw new Error("Verouderde UI-polish zonurenowner staat weer in de bronruntime: "+verouderd);
}
if(!runtime.includes("UI-polish wrapt zonurenTegel() daarom niet meer."))
  throw new Error("UI-polish runtime mist het expliciete zonuren-ownershipcontract.");

/* Accessibility hoort in het definitieve artifact, zonder de dashboardstructuur
   of weerlogica te herschikken. #app is al de ene container van alle primaire
   weersinhoud; maak precies die bestaande container het main-landmark. De
   laadstatus en bediening erboven blijven bewust buiten main. */
const APP_OPEN='<div id="app" style="display:none">';
const APP_CLOSE='    </footer>\n  </div>\n</div>\n\n<script>';
if(html.split(APP_OPEN).length-1!==1)throw new Error("#app-opening ontbreekt of is dubbel voor main-landmark.");
if(html.split(APP_CLOSE).length-1!==1)throw new Error("#app-afsluiting ontbreekt of is dubbel voor main-landmark.");
html=html.replace(APP_OPEN,'<main id="app" style="display:none">');
html=html.replace(APP_CLOSE,'    </footer>\n  </main>\n</div>\n\n<script>');

/* Loading en de bewezen lege waarschuwingstate zijn al eigendom van de pure
   base-build owner. UI-polish mag die requeststatussen niet opnieuw schrijven;
   bewaak hier alleen dat precies het verwachte renderercontract is aangeleverd. */
if((html.split(START_PRODUCTIE).length-1)!==1)throw new Error("Base-build waarschuwing-laadstatus ontbreekt of is dubbel vóór UI-polish.");
if((html.split(EIND_PRODUCTIE).length-1)!==1)throw new Error("Base-build waarschuwing-leegstatus ontbreekt of is dubbel vóór UI-polish.");
if(html.includes(START_BRON))throw new Error("Oude lege startstate van waarschuwingrenderer heeft base-build overleefd.");
if(html.includes(EIND_BRON))throw new Error("Oude impliciete lege eindstate van waarschuwingrenderer heeft base-build overleefd.");

const css=`
${CSS_MARK}
/* Waarschuwingen zijn belangrijk, maar een gewone advisory hoeft niet dezelfde
   visuele urgentie te krijgen als een rode waarschuwing. Alleen niveau rood
   houdt daarom de carmine-accentkleur; de overige niveaus blijven rustig. */
#waarschuwingen>.msg{font-size:12.5px;color:var(--ink-45);padding:7px 0}
.waarsch{border-left:1px solid var(--rule);padding:8px 0 8px 12px;margin-top:var(--s2)}
.waarsch h3{font-family:var(--sans);font-weight:500;font-size:14px;line-height:1.35;margin:0 0 3px;color:var(--ink)}
.waarsch p{margin:0;font-size:13px;line-height:1.45;color:var(--ink-70)}
.waarsch[data-ui-severity="rood"]{border-left:3px solid var(--carmine)}
.waarsch[data-ui-severity="rood"] h3{color:var(--carmine)}
.waarsch-details{margin-top:6px;font-size:12px;color:var(--ink-45)}
.waarsch-details summary{display:inline;cursor:pointer;color:var(--ink-45);box-shadow:inset 0 -1px 0 var(--rule)}
.waarsch-details summary:hover{color:var(--ink)}
.waarsch-details p{margin-top:7px;font-size:12px;color:var(--ink-45);max-width:92ch}
.row.day.kop .bar{text-align:center}
/* De bronfooter blijft typografisch compact. Alleen op aanraakbreedtes krijgen
   links en het uitklapbare locatie-item een fysieke 44px-hoge hitbox en extra
   horizontale scheiding. Zo wordt de klikruimte groter zonder grotere letters,
   pills of extra visuele knoppen te introduceren. */
@media(max-width:900px){
  footer a,footer details summary{display:inline-flex;align-items:center;min-height:44px;padding:0 4px;margin-right:4px}
}
`;

const HEAD_EIND="</head>";
if(html.split(HEAD_EIND).length-1!==1)throw new Error("Exact één head-einde vereist voor UI-polish.");
html=html.replace(HEAD_EIND,"<style>"+css+"</style>\n"+HEAD_EIND);

const START="/* ---------- start ---------- */";
const aantal=html.split(START).length-1;
if(aantal!==1)throw new Error("Algemene startmarker ontbreekt of is dubbel: "+aantal);
html=html.replace(START,runtime+"\n"+START);

/* Bouwcontract: precies één main-landmark, geen oude #app-div en de mobiele
   targetmaat moet in het uiteindelijke stylesheet aanwezig zijn. */
if((html.match(/<main id="app" style="display:none">/g)||[]).length!==1)throw new Error("Definitief main-landmark ontbreekt of is dubbel.");
if(html.includes(APP_OPEN))throw new Error("Oude #app-div is na accessibility-polish blijven staan.");
if(!html.includes("footer a,footer details summary{display:inline-flex;align-items:center;min-height:44px"))throw new Error("Mobiele footer-hitbox ontbreekt uit definitief artifact.");
if(!html.includes('data-ui-warning-loading="1">Officiële weerwaarschuwingen controleren…'))throw new Error("Waarschuwing-laadstatus ontbreekt uit definitief artifact.");
if(!html.includes("Geen officiële weerwaarschuwingen voor deze locatie."))throw new Error("Lege waarschuwing-eindstate ontbreekt uit definitief artifact.");
if(html.includes("uiPolishRegenperiodeKansen")||html.includes("uiPolishRegenperiodeDaglabel")||html.includes("data-ui-rain-period-probability"))throw new Error("UI-polish overschrijft de Q4-regenperiodepresentatie nog steeds.");
if(html.includes("function uiWindstootTekst(pg,nu,dag,vak){")||html.includes("const uiBasisMeters=meters;"))throw new Error("UI-polish bezit na assemblage opnieuw windstootcopy of meters().");
if(html.includes("function uiZonurenWoord(uur,daglichtUur){")||html.includes("const uiBasisZonurenTegel=zonurenTegel;"))throw new Error("UI-polish bezit na assemblage opnieuw zonurencopy of zonurenTegel().");
if((html.split(ZONUREN_PRODUCTIE).length-1)!==1||(html.split(ZON_HELPER_PRODUCTIE).length-1)!==1)throw new Error("Finale zonuren-owner is niet uniek in het artifact.");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime gevonden na UI-polish.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:ui-polish-"+(i+1)}));
fs.writeFileSync(htmlPad,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"ui-polish-20260813");
console.log("UI-polish toegepast: rustige waarschuwingpresentatie, bereik-kop, Q4 als enige regenperiode-owner, base zonuren-owner geverifieerd, main-landmark en mobiele footer-hitboxes; cache "+versie+".\n");