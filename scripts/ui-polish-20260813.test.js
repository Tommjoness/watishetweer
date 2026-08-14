"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path"),vm=require("vm");
const runtime=fs.readFileSync(path.join(__dirname,"ui-polish-20260813-runtime.js"),"utf8");
const apply=fs.readFileSync(path.join(__dirname,"apply-ui-polish-20260813.js"),"utf8");
const context={};vm.createContext(context);vm.runInContext(runtime,context);
const api=context.WeatherNowUiPolish20260813;
assert(api,"UI-polish helpercontract ontbreekt");
assert.equal(api.windstootTekst({t:"2026-08-13T02:00",v:52},"2026-08-13T16:00","Vandaag","02:00–03:00"),"Eerder vandaag lag de hoogste verwachte windstoot rond 02:00–03:00 op 52 km/u.");
assert.equal(api.windstootTekst({t:"2026-08-13T18:00",v:44},"2026-08-13T16:00","Vandaag","18:00–19:00"),"Later vandaag kunnen windstoten tot 44 km/u voorkomen, rond 18:00–19:00.");
assert.equal(api.zonurenWoord(13.8,14.83),"Bijna de hele dag zon");
assert.equal(api.zonurenWoord(8,14),"Regelmatig zon vandaag");
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
console.log("UI-polish regressiecontract groen.");
