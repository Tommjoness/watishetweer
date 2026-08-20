"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path"),vm=require("vm");
const runtime=fs.readFileSync(path.join(__dirname,"ui-polish-20260813-runtime.js"),"utf8");
const apply=fs.readFileSync(path.join(__dirname,"apply-ui-polish-20260813.js"),"utf8");
const context={};vm.createContext(context);vm.runInContext(runtime,context);
const api=context.WeatherNowUiPolish20260813;
assert(api,"UI-polish helpercontract ontbreekt");

assert.equal(api.regenperiodeDagprefix("2026-08-17","2026-08-16"),"ma ");
assert.equal(api.regenperiodeDagprefix("2026-08-16","2026-08-16"),"");
assert.equal(api.isNwsStructuur("* WHAT...Heat index values. * WHERE...Dallas."),true);
assert.equal(api.isNwsStructuur("Plaatselijk zware buien mogelijk."),false);

/* Briefing bron- en tijdsemantiek worden door de pure briefing-copy owner in de
   base-build gezet. UI-polish mag briefing() niet meer wrappen of #brief-HTML
   achteraf herschrijven; neerslagpresentatie blijft bewust een andere owner. */
assert.equal(api.briefingBronSemantiek,undefined,"UI-polish mag geen briefing-broncopyhelper meer exporteren");
assert.equal(api.briefingTijdtaal,undefined,"UI-polish mag geen briefing-tijdcopyhelper meer exporteren");
assert(!runtime.includes("uiBriefingBronSemantiek"),"UI-polish mag geen late briefing-broncopyhelper meer bevatten");
assert(!runtime.includes("uiBriefingTijdtaal"),"UI-polish mag geen late briefing-tijdcopyhelper meer bevatten");
assert(!runtime.includes("uiBasisBriefing"),"UI-polish mag briefing() niet meer wrappen");
assert(!runtime.includes('document.getElementById("brief")'),"UI-polish mag briefing-HTML niet meer achteraf herschrijven");
assert(!runtime.includes("De officiële waarschuwing heeft voorrang op de modelverwachting."),"UI-polish mag stale briefingcopy niet meer defensief verbergen");
assert(runtime.includes("UI-polish wrapt briefing() daarom niet meer."),"UI-polish mist expliciet briefingcopy-ownershipcontract");
assert(apply.includes('require("./briefing-copy-owner.js")'),"UI-polish apply-stap moet briefingcopy-ownercontract hergebruiken");
assert(apply.includes("BRIEF_HELPER_PRODUCTIE")&&apply.includes("VANDAAG_PIEK_PRODUCTIE")&&apply.includes("MORGEN_PRODUCTIE"),"UI-polish verifieert de base briefingcopy-owner niet");
assert(apply.includes("Verouderde briefing-waarschuwingcopy heeft de base briefingowner overleefd"),"stale waarschuwingzin moet upstream fail-fast worden bewaakt");

/* Q3/senior meters() is de enige eigenaar van de UV-presentatie. UI-polish
   mag die zichtbare copy niet opnieuw berekenen of na Q3 overschrijven. */
assert.equal(api.uvPiekTekst,undefined,"UI-polish mag geen UV-copyhelper meer exporteren");
assert(!runtime.includes("uiUvOordeel"),"UI-polish mag geen eigen UV-oordeelschaal meer bevatten");
assert(!runtime.includes("uiUvPiekTekst"),"UI-polish mag geen late UV-copy-owner meer bevatten");
assert(!runtime.includes('piek("uv_index")'),"UI-polish meters-wrapper mag UV niet opnieuw ophalen");

/* Pollen-modelcopy wordt door de pure pollen-owner in de base-build gezet.
   UI-polish mag lucht() daarom niet opnieuw voor dezelfde zichtbare status wrappen. */
assert.equal(api.pollenTekst,undefined,"UI-polish mag geen pollen-copyhelper meer exporteren");
assert(!runtime.includes("uiPollenTekst"),"UI-polish mag geen eigen pollen-copyhelper meer bevatten");
assert(!runtime.includes("uiPolishLuchtModelstatus"),"UI-polish mag geen late pollen-DOM-owner meer bevatten");
assert(!runtime.includes("uiBasisLucht"),"UI-polish mag lucht() niet meer voor pollen wrappen");

/* De base-build pressure-copy-owner produceert de finale luchtdruksubtekst.
   UI-polish mag pressub daarom niet meer achteraf lezen of herschrijven. */
assert.equal(api.luchtdrukTekst,undefined,"UI-polish mag geen luchtdrukcopyhelper meer exporteren");
assert(!runtime.includes("uiLuchtdrukTekst"),"UI-polish mag geen late luchtdrukcopyhelper meer bevatten");
assert(!runtime.includes('document.getElementById("pressub")'),"UI-polish mag pressub niet meer herschrijven");

/* De wind-gust-copy-owner produceert ook gustsub al in de base-build.
   Daarmee heeft UI-polish geen enkele reden meer om meters() te wrappen. */
assert.equal(api.windstootTekst,undefined,"UI-polish mag geen windstootcopyhelper meer exporteren");
assert(!runtime.includes("uiWindstootTekst"),"UI-polish mag geen late windstootcopyhelper meer bevatten");
assert(!runtime.includes("uiBasisMeters"),"UI-polish mag meters() niet meer wrappen");
assert(!runtime.includes('piek("wind_gusts_10m")'),"UI-polish mag windstootpiek niet opnieuw ophalen");
assert(!runtime.includes('zetTekst("gustsub"'),"UI-polish mag gustsub niet opnieuw schrijven");
assert(runtime.includes("UI-polish wrapt meters() daarom niet meer."),"UI-polish mist expliciet windstoot/pressure ownershipcontract");
assert(apply.includes('require("./wind-gust-copy-owner.js")'),"UI-polish apply-stap moet windstoot-ownercontract hergebruiken");
assert(apply.includes("GUST_PRODUCTIE")&&apply.includes("HELPER_PRODUCTIE"),"UI-polish verifieert de base windstootowner niet");

/* De sunshine-copy-owner produceert de finale daglichtbewuste zonurentegel al
   in de base-build. UI-polish mag dezelfde lokale dag- en zonsdata niet opnieuw lezen. */
assert.equal(api.zonurenWoord,undefined,"UI-polish mag geen zonurencopyhelper meer exporteren");
assert(!runtime.includes("uiZonurenWoord"),"UI-polish mag geen eigen zonurencopyhelper meer bevatten");
assert(!runtime.includes("uiBasisZonurenTegel"),"UI-polish mag zonurenTegel() niet meer wrappen");
assert(!runtime.includes("zonurenTegel=function"),"UI-polish mag zonurenTegel() niet opnieuw definiëren");
assert(!runtime.includes("day.sunshine_duration"),"UI-polish mag zonurendata niet opnieuw uitlezen");
assert(!runtime.includes("day.sunrise")&&!runtime.includes("day.sunset"),"UI-polish mag daglichtduur niet opnieuw berekenen");
assert(runtime.includes("UI-polish wrapt zonurenTegel() daarom niet meer."),"UI-polish mist expliciet zonuren-ownershipcontract");
assert(apply.includes('require("./sunshine-copy-owner.js")'),"UI-polish apply-stap moet zonuren-ownercontract hergebruiken");
assert(apply.includes("ZONUREN_PRODUCTIE")&&apply.includes("ZON_HELPER_PRODUCTIE"),"UI-polish verifieert de base zonurenowner niet");

/* De daily-forecast owner produceert de zichtbare zeven-dagenpresentatie al in
   de base-build. UI-polish mag daily data niet opnieuw lezen en dagen() niet wrappen. */
assert.equal(api.dagNeerslagTekst,undefined,"UI-polish mag geen daily-forecast copyhelper meer exporteren");
assert(!runtime.includes("uiDagNeerslagTekst"),"UI-polish mag geen eigen daily-forecast copyhelper meer bevatten");
assert(!runtime.includes("uiPolishDagen"),"UI-polish mag geen late daily DOM-owner meer bevatten");
assert(!runtime.includes("uiBasisDagen"),"UI-polish mag dagen() niet meer wrappen");
assert(!runtime.includes("precipitation_probability_max"),"UI-polish mag daily neerslagkans niet opnieuw uitlezen");
assert(!runtime.includes("precipitation_sum"),"UI-polish mag daily neerslagsom niet opnieuw uitlezen");
assert(runtime.includes("UI-polish wrapt dagen() daarom niet meer."),"UI-polish mist expliciet daily-forecast ownershipcontract");
assert(apply.includes('require("./daily-forecast-owner.js")'),"UI-polish apply-stap moet daily-forecast ownercontract hergebruiken");
assert(apply.includes("DAILY_HELPER_PRODUCTIE")&&apply.includes("DCOND_PRODUCTIE")&&apply.includes("DRAIN_PRODUCTIE")&&apply.includes("KOP_PRODUCTIE"),"UI-polish verifieert de base daily-forecast owner niet");

assert(!runtime.includes("uiPolishRegenperiodeKansen"),"UI-polish bronruntime mag de oude regenkans-owner niet meer bevatten");
assert(!runtime.includes("uiPolishRegenperiodeDaglabel"),"UI-polish bronruntime mag de oude regendaglabel-owner niet meer bevatten");
assert(!runtime.includes("data-ui-rain-period-probability"),"UI-polish bronruntime mag geen oude statische periodekanslabels meer bezitten");
assert(runtime.includes("/* Regenperiodepresentatie wordt volledig beheerd door Q4. */"),"UI-polish bronruntime mist expliciet Q4-ownership");
assert(!apply.includes("VEROUDE_REGEN_START")&&!apply.includes("runtime=runtime.slice"),"apply-stap mag zijn eigen regenowner niet meer tijdens buildtijd uitsnijden");
assert(apply.includes("Verouderde UI-polish regenperiode-owner staat weer in de bronruntime"),"apply-stap bewaakt Q4-ownership niet fail-fast");
assert(runtime.includes("Voor deze locatie kunnen we geen officiële weerwaarschuwingen tonen."),"niet-ondersteunde waarschuwingstatus is niet consumentvriendelijk");
assert(runtime.includes("Officiële weerwaarschuwingen konden tijdelijk niet worden opgehaald."),"tijdelijke waarschuwingstoring blijft onduidelijk");

/* Loading en de succesvolle nulwaarschuwingstatus zijn requeststates en hebben
   nu één base-build owner. UI-polish mag ze niet meer zelf injecteren of als
   lege-DOM-fallback aanmaken. */
assert(!runtime.includes("Geen officiële weerwaarschuwingen voor deze locatie."),"UI-polish runtime mag de lege warning-state niet meer bezitten");
assert(!runtime.includes('data-ui-warning-loading="1"'),"UI-polish runtime mag de warning-loadingstate niet meer bezitten");
assert(!runtime.includes("Officiële weerwaarschuwingen controleren…"),"UI-polish runtime mag de warning-loadingcopy niet meer bezitten");
assert(runtime.includes("De base-build waarschuwingrenderer bezit loading en de expliciete lege"),"UI-polish mist expliciet warning-state ownershipcontract");
assert(apply.includes('require("./warning-render-state.js")'),"UI-polish apply-stap moet de base-owner contracten hergebruiken");
assert(apply.includes("START_PRODUCTIE")&&apply.includes("EIND_PRODUCTIE"),"UI-polish verifieert de base warning-state owner niet");
assert(!apply.includes("WAARSCHUWING_START")&&!apply.includes("WAARSCHUWING_EIND"),"UI-polish apply-stap mag warning states niet meer muteren");

/* Accessibility-regressies horen bij het artifactcontract, niet bij de
   weerdata. Bewaak daarom dat de final-polish exact de bestaande #app-container
   tot main maakt en mobiele footerdoelen een 44px-hitbox geeft. */
assert(apply.includes('const APP_OPEN=\'<div id="app" style="display:none">\''),"main-landmark moet vanuit exact de bestaande #app-container worden opgebouwd");
assert(apply.includes('html=html.replace(APP_OPEN,\'<main id="app" style="display:none">\')'),"#app wordt geen main-landmark");
assert(apply.includes('footer a,footer details summary{display:inline-flex;align-items:center;min-height:44px'),"mobiele footerdoelen missen de 44px-hitbox");
assert(apply.includes('if((html.match(/<main id="app" style="display:none">/g)||[]).length!==1)'),"definitieve main-landmark wordt niet op uniciteit geverifieerd");
console.log("UI-polish regressiecontract groen: warning-state/Q4/accessibility blijven, en UV-/pollen-/luchtdruk-/windstoot-/zonuren-/daily-forecast-/briefingcopy hebben geen dubbele owner meer.");