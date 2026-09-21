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
assert(/\.stats \.eyebrow\{font-size:9\.5px;letter-spacing:\.075em;line-height:1\.15\}/.test(css),"metrieklabels houden hun compacte regelhoogte ook nadat de finale runtime het statistiekgrid uit dashrow-hero heeft verplaatst");
assert(css.includes('.seo-plaatsnav-links a:nth-child(n+7):not(.seo-plaatsnav-alles){display:none}'),"mobiele hoofdweergave toont een korte plaatsselectie terwijl Meer plaatsen zichtbaar blijft");
assert(css.includes(".seo-plaatsnav p{display:none}"),"SEO-uitleg neemt op de mobiele hoofdweergave geen extra schermhoogte in");
assert(css.includes(".dashrow-chart #charthint{margin:0 0 3px;text-align:center}"),"grafiekhint krijgt een rustige, gecentreerde mobiele overgang");
assert(css.includes(".wiw-chart-layout{gap:16px!important}")&&css.includes(".wiw-hour-panel{padding-top:14px!important}"),"grafiek en uurtabel sluiten mobiel met één compact sectieritme op elkaar aan");
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

const temp=[18,18,19,20,21,22,22,21,20,19,18,18,17,16,16,17,18,19,20,21,22,22,21,20];
const kandidaten=[0,3,6,9,12,15,18,21,23];
assert.equal(ux.mobieleTemperatuurLabelLimiet(320),5,"smalste telefoon houdt vijf temperatuurankers");
assert.equal(ux.mobieleTemperatuurLabelLimiet(390),7,"gangbare iPhone-breedte houdt zeven temperatuurankers");
assert.equal(ux.mobieleTemperatuurLabelLimiet(430),8,"breedste compacte mobiele plot houdt acht temperatuurankers");
const gekozen=ux.kiesMobieleTemperatuurLabelIndices(temp,kandidaten,7);
assert.equal(gekozen.length,7,"mobiele 24-uursgrafiek benut zeven rustige temperatuurankers waar kandidaten beschikbaar zijn");
assert(gekozen.includes(13)===false,"alleen werkelijk bestaande labelkandidaten mogen gekozen worden");
assert(gekozen.includes(12),"zichtbaar minimum blijft als betekenisvol label behouden");
assert(gekozen.includes(3)||gekozen.includes(6)||gekozen.includes(18)||gekozen.includes(21),"zichtbaar maximum blijft als betekenisvol label behouden");
assert(gekozen.includes(23),"laatste zichtbare punt blijft als vaste prioriteit behouden");
const prioriteit=ux.prioriteerMobieleTemperatuurLabelIndices(temp,gekozen);
assert.equal(prioriteit[0],12,"minimum wordt vóór aanvullende tussenlabels geplaatst");
assert([3,6,18,21].includes(prioriteit[1]),"maximum wordt vóór aanvullende tussenlabels geplaatst");
assert.equal(prioriteit[2],23,"eindpunt wordt vóór aanvullende tussenlabels geplaatst");
assert.deepEqual(ux.kiesMobieleTemperatuurLabelIndices([null,18,19],[0,1,2],5),[1,2],"null wordt niet als kunstmatige 0 °C-extreme behandeld");
const uren25=Array.from({length:25},(_,i)=>"2026-09-"+String(i<2?19:20).padStart(2,"0")+"T"+String((22+i)%24).padStart(2,"0")+":00");
assert.deepEqual(ux.kiesKalenderUurLabelIndices(uren25,3,24).map(i=>ux.uurUitIso(uren25[i])),[0,3,6,9,12,15,18,21],"smalle etmaalgrafiek gebruikt alle acht echte lokale drie-uursankers");
assert.equal(ux.mobieleGrafiekCompactHoogte(220,340,246),256,"mobiele SVG-reserve wordt tot zichtbare inhoud plus veilige ondermarge teruggebracht");
assert.equal(ux.mobieleGrafiekCompactHoogte(220,250,246),250,"een al compactere grafiek wordt nooit opnieuw vergroot");
assert.equal(ux.mobieleGrafiekCompactHoogte(220,296,286),296,"zichtbare regenperiode-labels behouden hun benodigde mobiele SVG-reserve");
assert(js.includes('if(el.closest("#scrub"))return;')&&!js.includes("el.closest('g[data-q4-rain-periods]')||el.closest(\"#scrub\")"),"mobiele compactie telt regenperiode-tijden en -bedragen mee in de zichtbare onderrand");
assert(js.includes("if(svg.querySelector(\'g[data-q4-rain-periods] text\'))zichtbaarOnder=Math.max(zichtbaarOnder,286);"),"natte mobiele grafiek bewaart exact de canonieke 296px-reserve voor bracketlabels");
assert(js.includes('data-mobile-temp-index')&&js.includes('data-mobile-point-aligned')&&js.includes('data-mobile-point-shifted')&&js.includes('rechthoekenBotsen(b,box,minAfstand)'),"mobiele temperatuurselectie blijft aan echte datapunten gekoppeld, mag licht uitwijken en houdt een geometrische collision-pass");
assert(js.includes('mobieleTemperatuurLabelPlan(g.TI,g.T,24)')&&js.includes('data-mobile-temp-priority')&&js.includes('data-mobile-temp-visible'),"mobiele temperatuurwaarden volgen het vaste anchor-first plan met extra extrema");
assert(js.includes('nuTekst.textContent="nu "+Math.round(Number(actueleTemperatuur))+"°"'),"de rode huidige markering houdt zijn actuele temperatuurwaarde");
assert(js.includes('kiesKalenderUurLabelIndices(g.TI,3,24)')&&js.includes('data-mobile-hour-rhythm')&&js.includes('three-hour'),"smalle mobiele uuras wordt vanuit één deterministische lokale drie-uursowner opgebouwd");
assert(js.includes('data-mobile-sun-band-compact')&&js.includes('^zon (?:op|onder)'),"dubbele zonsopkomst/-ondergangtekst wordt alleen binnen de mobiele SVG opgeruimd");
assert(js.includes('data-mobile-compact-height'),"mobiele grafiekhoogte krijgt een expliciete post-render compactiemarker");
assert(js.includes('WeatherNowMobileScreenshotPolish.structureerBronnen')&&js.includes('wiw-source-last-odd'),"dynamische bronnen worden na providerupdates genormaliseerd en oneven gecentreerd");

console.log("Finale consumentenpolish 20260828: mobiel, desktop, bronprovenance, drie-uursas, anchor-first temperatuurselectie, extrema, compacte zonband, Nu-collision en wrapperarchitectuur geborgd.");
