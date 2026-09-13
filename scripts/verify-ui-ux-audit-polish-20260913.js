"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-ui-ux-audit-polish-20260913";
const BRON=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");

function htmlBestanden(dir){
  const uit=[];
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,item.name);
    if(item.isDirectory())uit.push(...htmlBestanden(p));
    else if(item.isFile()&&item.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}
const tel=(bron,zoek)=>String(bron).split(zoek).length-1;

assert(BRON.includes("function zoekResultaatDetail(r)"),"zoekresultaten missen onderscheidende regio-opbouw");
assert(BRON.includes("function uniekeZoekResultaten(lijst)"),"exacte geocoderdubbelen worden niet afgevangen");
assert(BRON.includes('lat.toFixed(5),lon.toFixed(5)'),"deduplicatie mag gelijknamige plaatsen met andere coördinaten niet samenvoegen");
assert(BRON.includes('class="zoekresultaat-detail"'),"zoekresultaatdetail mist een stabiele presentatiehook");
assert(BRON.includes('class="mobile-section-nav" aria-label="Snel naar weersinformatie"'),"mobiele sectienavigatie ontbreekt in de semantische bron");
for(const doel of ["#chart","#days","#nights","#aq"])assert(BRON.includes(`href="${doel}"`),"mobiele sectienavigatie mist "+doel);

let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes('id="weather-now-route"')||!html.includes('id="app"'))continue;
  const rel=path.relative(OUT,p);
  assert.strictEqual(tel(html,`id="${STYLE_ID}"`),1,rel+": auditstylesheet niet exact eenmaal aanwezig");
  assert.strictEqual(tel(html,'class="mobile-section-nav"'),1,rel+": mobiele sectienavigatie niet exact eenmaal aanwezig");
  assert(html.includes('.results .zoekresultaat-detail{display:block'),rel+": zoekresultaten blijven visueel dubbelzinnig");
  assert(html.includes('outline:2px solid var(--ink)!important'),rel+": toetsenbordfocus is niet robuust zichtbaar");
  assert(html.includes('#thema .thema-status{'),rel+": zichtbare themastatus mist styling");
  assert(html.includes('.chip.add{border-style:solid!important'),rel+": plaats opslaan oogt op desktop nog als tijdelijke toestand");
  assert(html.includes('#days .row.day:not(.kop)::after{content:"›"'),rel+": weekrij mist desktop-affordance");
  assert(html.includes('.mobile-section-nav{display:grid;grid-template-columns:repeat(4'),rel+": mobiele sectienavigatie wordt niet compact zichtbaar");
  assert(html.includes('.row.kop>*{font-size:11px!important'),rel+": mobiele tabelkoppen blijven te klein");
  assert(html.includes('.hint,.data-uitleg{font-size:13px!important'),rel+": mobiele toelichting blijft te klein");
  assert(html.includes(':root{--warning-yellow:#856000;--warning-orange:#A34712}'),rel+": waarschuwingsernst mist lichte themakleuren");
  assert(/\.waarsch\[data-ui-severity=(?:"oranje"|oranje)\]\{border-left:3px solid var\(--warning-orange\)\}/.test(html),rel+": oranje waarschuwing mist accent");
  gezien++;
}
assert(gezien>0,"Geen finale weerartifacts gevonden voor UI/UX-auditcontrole.");
const cache=verifieerServiceworkerCache(OUT,"ui-ux-audit-polish-20260913");
assert(/^watishetweer-[0-9a-f]{12}$/.test(cache),"serviceworker-cache hoort bij de gewijzigde artifact");
console.log("UI/UX-auditcontrole groen voor "+gezien+" weerartifacts: locatie-identiteit, mobiel ritme, waarschuwingsernst en interactie-affordances geborgd; cache "+cache+".");
