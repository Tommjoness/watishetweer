"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path"),vm=require("vm");
const runtime=fs.readFileSync(path.join(__dirname,"ui-polish-20260813-runtime.js"),"utf8");
const apply=fs.readFileSync(path.join(__dirname,"apply-ui-polish-20260813.js"),"utf8");
const context={};vm.createContext(context);vm.runInContext(runtime,context);
const api=context.WeatherNowUiPolish20260813;
assert(api,"UI-polish helpercontract ontbreekt");

assert.equal(api.windstootTekst({t:"2026-08-13T02:00",v:52},"2026-08-13T16:00","Vandaag","02:00–03:00"),"Volgens de verwachting kwam de sterkste windstoot vandaag rond 02:00–03:00 uit op 52 km/u.");
assert.equal(api.windstootTekst({t:"2026-08-13T18:00",v:44},"2026-08-13T16:00","Vandaag","18:00–19:00"),"Later vandaag kunnen rond 18:00–19:00 windstoten tot 44 km/u voorkomen.");
assert.equal(api.windstootTekst({t:"2026-08-14T18:00",v:44},"2026-08-13T16:00","Morgen","18:00–19:00"),"Morgen kunnen rond 18:00–19:00 windstoten tot 44 km/u voorkomen.");

assert.equal(api.zonurenWoord(13.8,14.83),"De zon schijnt bijna de hele dag.");
assert.equal(api.zonurenWoord(8,14),"Vandaag zijn er meerdere uren zon.");
assert.equal(api.zonurenWoord(2,14),"Vandaag is er weinig zon.");

assert.equal(api.luchtdrukTekst("Licht gestegen in de afgelopen drie uur."),"De luchtdruk is in de afgelopen drie uur licht gestegen.");
assert.equal(api.luchtdrukTekst("In de afgelopen drie uur 2,4 hPa gedaald."),"De luchtdruk is in de afgelopen drie uur 2,4 hPa gedaald.");
assert.equal(api.luchtdrukTekst("Vrijwel stabiel."),"Vrijwel stabiel.");

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

/* Accessibility-regressies horen bij het artifactcontract, niet bij de
   weerdata. Bewaak daarom dat de final-polish exact de bestaande #app-container
   tot main maakt en mobiele footerdoelen een 44px-hitbox geeft. */
assert(apply.includes('const APP_OPEN=\'<div id="app" style="display:none">\''),"main-landmark moet vanuit exact de bestaande #app-container worden opgebouwd");
assert(apply.includes('html=html.replace(APP_OPEN,\'<main id="app" style="display:none">\')'),"#app wordt geen main-landmark");
assert(apply.includes('footer a,footer details summary{display:inline-flex;align-items:center;min-height:44px'),"mobiele footerdoelen missen de 44px-hitbox");
assert(apply.includes('if((html.match(/<main id="app" style="display:none">/g)||[]).length!==1)'),"definitieve main-landmark wordt niet op uniciteit geverifieerd");
console.log("UI-polish regressiecontract groen: copy, tijdtaal, cijfers en accessibility.");