"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path"),vm=require("vm");
const runtime=fs.readFileSync(path.join(__dirname,"ui-polish-20260813-runtime.js"),"utf8");
const apply=fs.readFileSync(path.join(__dirname,"apply-ui-polish-20260813.js"),"utf8");
const context={};vm.createContext(context);vm.runInContext(runtime,context);
const api=context.WeatherNowUiPolish20260813;
assert(api,"UI-polish helpercontract ontbreekt");

assert.equal(api.windstootTekst({t:"2026-08-13T02:00",v:52},"2026-08-13T16:00","Vandaag","02:00–03:00"),"Voor vandaag lag de hoogste verwachte windstoot rond 02:00–03:00 op 52 km/u.");
assert.equal(api.windstootTekst({t:"2026-08-13T18:00",v:44},"2026-08-13T16:00","Vandaag","18:00–19:00"),"Later vandaag worden rond 18:00–19:00 windstoten tot 44 km/u verwacht.");
assert.equal(api.windstootTekst({t:"2026-08-14T18:00",v:44},"2026-08-13T16:00","Morgen","18:00–19:00"),"Morgen worden rond 18:00–19:00 windstoten tot 44 km/u verwacht.");

assert.equal(api.zonurenWoord(13.8,14.83),"Naar verwachting bijna de hele dag zon.");
assert.equal(api.zonurenWoord(8,14),"Naar verwachting meerdere uren zon vandaag.");
assert.equal(api.zonurenWoord(2,14),"Naar verwachting weinig zon vandaag.");

assert.equal(api.luchtdrukTekst("Licht gestegen in de afgelopen drie uur."),"De luchtdruk is in de afgelopen drie uur licht gestegen.");
assert.equal(api.luchtdrukTekst("In de afgelopen drie uur 2,4 hPa gedaald."),"De luchtdruk is in de afgelopen drie uur 2,4 hPa gedaald.");
assert.equal(api.luchtdrukTekst("Vrijwel stabiel."),"Vrijwel stabiel.");

assert.equal(
  api.briefingBronSemantiek("Vandaag was het rond 13:00 het warmst, met <b>29 graden</b>."),
  "Het verwachte maximum lag vandaag rond 13:00 op <b>29 graden</b>."
);
assert.equal(
  api.briefingBronSemantiek("Vandaag wordt het rond 14:00 het warmst, met maximaal <b>24 graden</b>."),
  "Het verwachte maximum ligt vandaag rond 14:00 op <b>24 graden</b>."
);
assert.equal(
  api.briefingBronSemantiek("Morgen wordt het rond 15:00 het warmst, met maximaal <b>21&nbsp;graden</b>."),
  "Het verwachte maximum ligt morgen rond 15:00 op <b>21&nbsp;graden</b>."
);
assert.equal(api.uvPiekTekst({t:"2026-08-16T13:00",v:8},"2026-08-16T15:26"),"Verwachte UV-piek lag rond 13:00 · zeer hoog.");
assert.equal(api.uvPiekTekst({t:"2026-08-16T13:00",v:5},"2026-08-16T11:56"),"Verwachte UV-piek rond 13:00 · matig.");
assert.equal(api.uvPiekTekst({t:"2026-08-16T13:00",v:0.2},"2026-08-16T11:56"),"Nauwelijks UV verwacht vandaag.");
assert.equal(api.pollenTekst(true),"Modelverwachting voor dit uur.");
assert.equal(api.pollenTekst(false),"Model verwacht geen pollen voor dit uur.");
assert.equal(api.regenperiodeDagprefix("2026-08-17","2026-08-16"),"ma ");
assert.equal(api.regenperiodeDagprefix("2026-08-16","2026-08-16"),"");

const briefing="Vandaag wordt het warm. Vannacht koelt het af naar <b>16 graden</b>.";
assert.equal(api.briefingTijdtaal(briefing,"2026-08-16T00:03",19),"Vandaag wordt het warm. Later vannacht koelt het af naar <b>16 graden</b>.");
assert.equal(api.briefingTijdtaal(briefing,"2026-08-16T04:59",19),"Vandaag wordt het warm. Later vannacht koelt het af naar <b>16 graden</b>.");
assert.equal(api.briefingTijdtaal(briefing,"2026-08-16T04:28",16),"Vandaag wordt het warm. De minimumtemperatuur vannacht ligt rond <b>16 graden</b>.");
assert.equal(api.briefingTijdtaal(briefing,"2026-08-16T04:28",15.5),"Vandaag wordt het warm. De minimumtemperatuur vannacht ligt rond <b>16 graden</b>.");
assert.equal(api.briefingTijdtaal(briefing,"2026-08-16T05:00",19),briefing);
assert.equal(api.briefingTijdtaal(briefing,"2026-08-15T23:30",19),briefing);

assert.equal(api.dagNeerslagTekst(2,0),"Droog");
assert.equal(api.dagNeerslagTekst(9,0.05),"Droog");
assert.equal(api.dagNeerslagTekst(5,0.2),"5%");
assert.equal(api.isNwsStructuur("* WHAT...Heat index values. * WHERE...Dallas."),true);
assert.equal(api.isNwsStructuur("Plaatselijk zware buien mogelijk."),false);
assert(runtime.includes("data-ui-rain-period-probability"));
assert(runtime.includes('bereik.textContent="Bereik"'));
assert(runtime.includes("Geen officiële weerwaarschuwingen voor deze locatie."),"succesvolle nulwaarschuwingstatus ontbreekt");
assert(runtime.includes("Voor deze locatie kunnen we geen officiële weerwaarschuwingen tonen."),"niet-ondersteunde waarschuwingstatus is niet consumentvriendelijk");
assert(runtime.includes("Officiële weerwaarschuwingen konden tijdelijk niet worden opgehaald."),"tijdelijke waarschuwingstoring blijft onduidelijk");
assert(runtime.includes('data-ui-warning-loading="1"')&&runtime.includes("Officiële weerwaarschuwingen controleren…"),"lopende officiële waarschuwingcontrole mag niet stil leeg zijn");
assert(runtime.includes("uiPolishRegenperiodeDaglabel"),"regenperiode over de daggrens mist dagcontext");

/* Accessibility-regressies horen bij het artifactcontract, niet bij de
   weerdata. Bewaak daarom dat de final-polish exact de bestaande #app-container
   tot main maakt en mobiele footerdoelen een 44px-hitbox geeft. */
assert(apply.includes('const APP_OPEN=\'<div id="app" style="display:none">\''),"main-landmark moet vanuit exact de bestaande #app-container worden opgebouwd");
assert(apply.includes('html=html.replace(APP_OPEN,\'<main id="app" style="display:none">\')'),"#app wordt geen main-landmark");
assert(apply.includes('footer a,footer details summary{display:inline-flex;align-items:center;min-height:44px'),"mobiele footerdoelen missen de 44px-hitbox");
assert(apply.includes('if((html.match(/<main id="app" style="display:none">/g)||[]).length!==1)'),"definitieve main-landmark wordt niet op uniciteit geverifieerd");
console.log("UI-polish regressiecontract groen: bronsemantiek, waarschuwingstatus, tijdtaal, cijfers en accessibility.");