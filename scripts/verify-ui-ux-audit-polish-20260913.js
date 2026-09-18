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
  assert(html.includes('html body footer:nth-of-type(n){display:grid!important;grid-template-columns:minmax(0,1fr) max-content max-content max-content minmax(0,1fr)!important'),rel+": finale runtime-flex wordt niet door de desktopgrid-owner overstemd");
  assert(html.includes('html body footer:nth-of-type(n) > span.bron:first-of-type{white-space:normal!important;min-width:0!important;max-width:100%!important'),rel+": bronnenregel kan op tussenbrede desktop niet binnen de footer afbreken");
  assert(html.includes('footer > span.bron:first-of-type{grid-column:1 / -1!important;grid-row:1!important'),rel+": bronnenregel heeft geen vaste eerste footerrij");
  assert(html.includes('footer > span.bron:nth-of-type(2){grid-column:1 / -1!important;grid-row:2!important'),rel+": disclaimer heeft geen vaste tweede footerrij");
  assert(html.includes('footer > span.bron:nth-last-of-type(2){grid-column:2!important;grid-row:3!important'),rel+": Over-link heeft geen vaste utilityrij");
  assert(html.includes('footer > span.bron:last-of-type{grid-column:3!important;grid-row:3!important'),rel+": Privacy-link heeft geen vaste utilityrij");
  assert(html.includes('footer > details.footer-details{grid-column:4!important;grid-row:3!important'),rel+": technische locatiegegevens hebben geen vaste utilityrij");
  assert.strictEqual(tel(html,'class="footer-contact"'),1,rel+": supportcontact moet exact één losse footerregel zijn");
  assert(html.includes('<p class="footer-contact"><span class="footer-contact-question">Opmerkingen, vragen of feedback?</span> <span class="footer-contact-mail">Mail naar <a href="mailto:support@watishetweer.nl">support@watishetweer.nl</a></span></p>'),rel+": supportcontact mist gegroepeerde vraag/mailregel of klikbare mailto-link");
  assert(html.includes('.footer-contact{grid-column:1 / -1;justify-self:center;margin:6px 0 0;text-align:center'),rel+": supportcontact is niet als eigen gecentreerde footerrij vastgelegd");
  assert(!html.includes('<span class="bron footer-contact"'),rel+": supportcontact mag de bestaande Over/Privacy utilityselectors niet verstoren");
  assert(html.includes('html body footer:nth-of-type(n){column-gap:14px!important;row-gap:0!important}'),rel+": mobiele footerutilityrij houdt geen compact horizontaal ritme");
  assert(html.includes('footer > span.bron:nth-last-of-type(2) a,')&&html.includes('footer > details.footer-details>summary{display:inline-flex;align-items:center;justify-content:center;min-height:44px}'),rel+": footerhulplinks hebben niet zelf een 44px tap-zone");
  assert(html.includes('.footer-contact{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;column-gap:6px;row-gap:0;line-height:1.35}'),rel+": mobiel supportcontact groepeert de twee tekstsegmenten niet");
  assert(html.includes('.footer-contact-mail{white-space:nowrap}'),rel+": 'Mail naar' en het e-mailadres kunnen mobiel nog los van elkaar afbreken");
  assert(html.includes('@media(max-width:600px){\n  .footer-contact-mail{margin-top:-8px}\n}'),rel+": smalle mobielweergave houdt nog te veel visuele ruimte tussen contactvraag en mailregel");
  assert(!html.includes('support@watishetweer.nl</a>.</p>'),rel+": losse afsluitende punt staat nog achter het supportadres");
  assert(html.includes('body > .seo-plaatsnav{padding-top:14px!important;padding-bottom:4px!important}'),rel+": populaire-plaatsenblok mist compacte mobiele afsluiting");
  assert(html.includes('.seo-plaatsnav-kop{font-size:19px!important;line-height:1.2!important;letter-spacing:-.01em}'),rel+": populaire-plaatsenkop mist mobiele typografiepolish");
  assert(html.includes('.seo-plaatsnav-links{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:16px!important;row-gap:0!important;width:100%}'),rel+": populaire plaatsen missen de mobiele tweekolomsgrid");
  assert(html.includes('.seo-plaatsnav-links a:nth-child(n+7):not(.seo-plaatsnav-alles){display:none!important}'),rel+": finale polish mag de compacte populaire-plaatsenselectie niet onbedoeld weer tonen");
  assert(html.includes('@media(min-width:600px) and (max-width:900px){')&&html.includes('.seo-plaatsnav-links{grid-template-columns:repeat(3,minmax(0,1fr))}'),rel+": tabletvariant van populaire plaatsen ontbreekt");
  assert(html.includes('html[data-thema="donker"] body > .seo-plaatsnav{background:var(--sheet)!important}'),rel+": donkere plaatsnavigatie mist expliciete themaveilige achtergrond");
  assert(html.includes('@media(prefers-reduced-motion:no-preference){'),rel+": subtiele micro-interacties missen reduced-motion begrenzing");
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
console.log("UI/UX-auditcontrole groen voor "+gezien+" weerartifacts: locatie-identiteit, mobiel ritme, waarschuwingsernst, vaste footerrijen, losse supportregel en interactie-affordances geborgd; cache "+cache+".");