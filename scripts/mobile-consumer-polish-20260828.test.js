"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const css=fs.readFileSync(path.join(__dirname,"mobile-graph-ux-20260828.css"),"utf8");
const js=fs.readFileSync(path.join(__dirname,"mobile-graph-ux-20260828.js"),"utf8");

assert(/@media\(max-width:430px\)[\s\S]*?#t\{font-size:78px\}/.test(css),"mobiele hero-temperatuur is bewust teruggebracht naar 78px");
assert(/#chart \[data-q4-rain-period-range\],[\s\S]*?opacity:\.76;[\s\S]*?font-size:9\.5px!important/.test(css),"regenperioden blijven zichtbaar maar krijgen een rustiger labelgewicht");
assert(/#chart g\[data-q4-rain-periods\] line\{opacity:\.72\}/.test(css),"regenbrackets blijven zichtbaar met lagere visuele nadruk");
assert(/#nights \.row\.night:not\(\.kop\)\{[\s\S]*?padding-top:10px!important;[\s\S]*?padding-bottom:10px!important;[\s\S]*?row-gap:3px!important/.test(css),"Nachtzicht is mobiel compacter zonder rijen of data te verwijderen");
assert(/\.dashrow-hero \.stats \.eyebrow\{font-size:9\.5px;letter-spacing:\.10em;line-height:1\.3\}/.test(css),"metrieklabels zijn compacter en wrappen minder snel");
assert(css.includes('.seo-plaatsnav-links a:nth-child(n+7):not(.seo-plaatsnav-alles){display:none}'),"mobiele hoofdweergave toont een korte plaatsselectie terwijl Meer plaatsen zichtbaar blijft");
assert(css.includes(".seo-plaatsnav p{display:none}"),"SEO-uitleg neemt op de mobiele hoofdweergave geen extra schermhoogte in");
assert(js.includes('const zichtbareSleutel=tekst==="kans · verwachte hoeveelheid"?"kans · totaal komend uur":tekst;'),"zichtbare uurtegel benoemt mm expliciet als totaal voor het komende uur");
assert(js.includes('kop.textContent="Windstoot nu"'),"mobiele windstootkop gebruikt een kort consumentlabel");
assert(js.includes("het verwachte totaal in het komende uur"),"toegankelijke neerslagbeschrijving maakt kans versus uurhoeveelheid expliciet");
assert(!js.includes("mobile-chart-return")&&!js.includes("mobile-rain-return")&&!js.includes("mobile-days-return"),"consumentenpolish verplaatst geen bestaande dashboardsecties");

console.log("Mobiele consumentenpolish 20260828: hero, metriekgrid, neerslagsemantiek, grafiek, Nachtzicht en plaatsfooter geborgd.");
