"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const ux=require("./mobile-graph-ux-20260828.js");

const css=fs.readFileSync(path.join(__dirname,"mobile-graph-ux-20260828.css"),"utf8");
const js=fs.readFileSync(path.join(__dirname,"mobile-graph-ux-20260828.js"),"utf8");

assert(/@media\(max-width:430px\)[\s\S]*?#t\{font-size:78px\}/.test(css),"mobiele hero-temperatuur is bewust teruggebracht naar 78px");
assert(/#chart \[data-q4-rain-period-range\],[\s\S]*?opacity:\.76;[\s\S]*?font-size:9\.5px!important/.test(css),"regenperioden blijven zichtbaar maar krijgen een rustiger labelgewicht");
assert(/#chart g\[data-q4-rain-periods\] line\{opacity:\.72\}/.test(css),"regenbrackets blijven zichtbaar met lagere visuele nadruk");
assert(/#nights \.row\.night:not\(\.kop\)\{[\s\S]*?padding-top:10px!important;[\s\S]*?padding-bottom:10px!important;[\s\S]*?row-gap:3px!important/.test(css),"Nachtzicht is mobiel compacter zonder rijen of data te verwijderen");
assert(/\.dashrow-hero \.stats \.eyebrow\{font-size:9\.5px;letter-spacing:\.10em;line-height:1\.3\}/.test(css),"metrieklabels zijn compacter en wrappen minder snel");
assert(css.includes('.seo-plaatsnav-links a:nth-child(n+7):not(.seo-plaatsnav-alles){display:none}'),"mobiele hoofdweergave toont een korte plaatsselectie terwijl Meer plaatsen zichtbaar blijft");
assert(css.includes(".seo-plaatsnav p{display:none}"),"SEO-uitleg neemt op de mobiele hoofdweergave geen extra schermhoogte in");
assert(css.includes('footer .bron-bronnen .bronitem[hidden]{display:none!important}'),"dynamische bronprovenance wordt op mobiel en desktop echt verborgen");
assert(/@media\(min-width:901px\)[\s\S]*?\.brief\{max-width:72ch\}/.test(css),"desktopbriefing houdt een leesbare regellengte");
assert(js.includes('const zichtbareSleutel=tekst==="kans · verwachte hoeveelheid"?"kans · totaal komend uur":tekst;'),"zichtbare uurtegel benoemt mm expliciet als totaal voor het komende uur");
assert(!js.includes('Windstoot rond nu')&&!js.includes('function werkStatKoppenBij'),"mobiele grafieklaag overschrijft de canonieke windstootkop niet meer");
assert(js.includes("Windstootkop en -subtekst hebben één eigenaar in de base-build"),"mobiele laag documenteert expliciet dat de windstoottegel bij de base-owner blijft");
assert(js.includes("het verwachte totaal in het komende uur"),"toegankelijke neerslagbeschrijving maakt kans versus uurhoeveelheid expliciet");
assert(js.includes("function naRender(basis,nawerk)"),"render-nawerk gebruikt één gedeelde wrapper in plaats van drie losse wrapperpatronen");
assert(!js.includes("mobile-chart-return")&&!js.includes("mobile-rain-return")&&!js.includes("mobile-days-return"),"consumentenpolish verplaatst geen bestaande dashboardsecties");

const zonderTiming=ux.bronGebruikUitResources([],"NL");
assert.equal(zonderTiming.openmeteo,true,"Open-Meteo blijft als kernbron geattribueerd wanneer resource timing nog leeg is");
assert.equal(zonderTiming.cams,false,"optionele CAMS-bron blijft zonder request verborgen");
assert.equal(zonderTiming.knmi,false,"optionele KNMI-bron blijft zonder request verborgen");

const bronnen=ux.bronGebruikUitResources([
  {name:"https://api.open-meteo.com/v1/forecast?x=1"},
  {name:"https://air-quality-api.open-meteo.com/v1/air-quality?x=1"},
  {name:"https://watishetweer.nl/api/neerslag?lat=52&lon=5"},
  {name:"https://watishetweer.nl/api/waarschuwingen?lat=52&lon=5"},
  {name:"https://watishetweer.nl/api/plaatsnaam?lat=52&lon=5"}
],"NL");
assert.equal(bronnen.openmeteo,true,"forecastbron wordt herkend");
assert.equal(bronnen.cams,true,"CAMS wordt alleen bij air-quality-request actief");
assert.equal(bronnen.knmi,true,"KNMI wordt alleen bij neerslagroute actief");
assert.equal(bronnen.meteoalarm,true,"MeteoAlarm wordt bij NL-waarschuwingroute actief");
assert.equal(bronnen.nws,false,"NWS wordt in Nederland niet getoond");
assert.equal(bronnen.osm,true,"Nominatim/OSM-fallbackroute wordt als OSM-provenance herkend");
assert.equal(bronnen.bigdatacloud,false,"BigDataCloud blijft verborgen zonder echte request");

const us=ux.bronGebruikUitResources([{name:"https://watishetweer.nl/api/waarschuwingen?lat=40&lon=-74"}],"US");
assert.equal(us.nws,true,"NWS wordt in de VS aan de waarschuwingroute gekoppeld");
assert.equal(us.meteoalarm,false,"MeteoAlarm wordt in de VS niet foutief getoond");

assert.equal(ux.rechthoekenBotsen({x:10,y:10,width:20,height:10},{x:28,y:12,width:15,height:10},0),true,"grafiekbotsing wordt gedetecteerd");
assert.equal(ux.rechthoekenBotsen({x:10,y:10,width:20,height:10},{x:40,y:12,width:15,height:10},3),false,"gescheiden labels blijven ongemoeid");
assert(js.includes('data-now-collision-adjusted'),"Nu-label krijgt alleen bij echte overlap een expliciete correctiemarker");

console.log("Finale consumentenpolish 20260828: mobiel, desktop, bronprovenance, Nu-collision en wrapperarchitectuur geborgd.");
