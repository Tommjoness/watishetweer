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
  assert(html.includes('<p class="footer-contact"><span class="footer-contact-question">Vragen of feedback?</span> <span class="footer-contact-mail">Mail naar <a href="mailto:support@watishetweer.nl">support@watishetweer.nl</a></span></p>'),rel+": supportcontact mist de compacte vraag/mailregel of klikbare mailto-link");
  assert(html.includes('.footer-contact{grid-column:1 / -1;justify-self:center;margin:6px 0 0;text-align:center'),rel+": supportcontact is niet als eigen gecentreerde footerrij vastgelegd");
  assert(!html.includes('<span class="bron footer-contact"'),rel+": supportcontact mag de bestaande Over/Privacy utilityselectors niet verstoren");
  assert(html.includes('html body footer:nth-of-type(n){margin-top:6px!important;padding-top:0!important;padding-bottom:0!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;justify-content:center!important;align-items:start!important;column-gap:12px!important;row-gap:0!important}'),rel+": mobiele footer heeft geen expliciete tweekoloms grid-owner");
  assert(html.includes('html body footer:nth-of-type(n) > span.bron.bron-bronnen{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-flow:row!important;align-items:stretch!important;width:100%;column-gap:16px!important;row-gap:4px!important')&&html.includes('footer .bron-bronnen .bronlabel{grid-column:1 / -1;margin:0!important;text-align:center}'),rel+": mobiele bronlijst heeft geen harde 2-koloms row-flow override op de late runtime-flexowner");
  assert(html.includes('footer .bron-bronnen .bronitem a{display:flex!important;align-items:center!important;justify-content:center!important;width:100%;min-height:44px!important;margin:0!important;padding:0!important;line-height:1.2!important;text-align:center}'),rel+": mobiele bronlinks verliezen hun 44px touchdoel of de compacte rijgeometrie");
  assert(html.includes('footer > span.bron:nth-last-of-type(2) a,')&&html.includes('footer > details.footer-details>summary{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0;margin-right:0}'),rel+": footerhulplinks hebben niet zelf een 44px tap-zone");
  assert(html.includes('footer > span.bron:nth-of-type(2){grid-column:1 / -1!important;grid-row:2!important;justify-self:center!important;width:calc(100% + 42px);max-width:calc(100vw - 8px);min-height:0!important;margin:0!important;line-height:1.35!important}'),rel+": disclaimer benut mobiel niet de bredere compacte leesregel");
  assert(html.includes('footer > span.bron:nth-last-of-type(2){grid-column:1!important;grid-row:3!important;justify-self:center!important}')&&html.includes('footer > span.bron:last-of-type{grid-column:2!important;grid-row:3!important;justify-self:center!important}')&&html.includes('footer > details.footer-details{grid-column:1 / -1!important;grid-row:4!important;justify-self:center!important}'),rel+": mobiele utilitylinks volgen niet de rustige 2+1-indeling");
  assert(html.includes('@media(max-width:370px){\n  html body footer:nth-of-type(n) > span.bron.bron-bronnen{column-gap:12px!important}\n  .footer-contact{flex-wrap:wrap}\n  .footer-contact-mail{margin-top:-10px}'),rel+": smalle mobielfooter mist de specifieke bron/contactfallback");
  assert(html.includes('.footer-contact{grid-column:1 / -1;justify-self:center;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;width:calc(100% + 42px);max-width:calc(100vw - 8px);column-gap:8px;row-gap:0;margin-top:0!important;line-height:1.3}'),rel+": mobiel supportcontact benut de bredere compacte footerregel niet");
  assert(html.includes('.footer-contact-question,.footer-contact-mail{display:inline-flex;align-items:center;justify-content:center;white-space:nowrap}'),rel+": contactvraag of mailgroep kan mobiel intern afbreken");
  assert(html.includes('@media(min-width:371px) and (max-width:900px){\n  .footer-contact{flex-wrap:nowrap}\n  .footer-contact-mail{margin-top:0}\n}'),rel+": 371–900px footer houdt contactvraag en mail niet op één compacte rij");
  assert(!html.includes('support@watishetweer.nl</a>.</p>'),rel+": losse afsluitende punt staat nog achter het supportadres");
  assert(html.includes('body{padding-bottom:env(safe-area-inset-bottom,0px)!important}'),rel+": mobiel document houdt nog extra basisruimte onder de laatste sectie");
  assert(html.includes('body > .sheet{padding-bottom:4px!important}'),rel+": mobiele sheet houdt onder het footercontact nog te veel loze ruimte");
  assert(html.includes('body > .seo-plaatsnav{margin-top:8px!important;padding-top:8px!important;padding-bottom:0!important}'),rel+": overgang naar populaire plaatsen is niet compact of gelijkmatig");
  assert(html.includes('.seo-plaatsnav-kop{font-size:19px!important;line-height:1.2!important;letter-spacing:-.01em}'),rel+": populaire-plaatsenkop mist mobiele typografiepolish");
  assert(html.includes('.seo-plaatsnav-links{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:16px!important;row-gap:0!important;width:100%}'),rel+": populaire plaatsen missen de mobiele tweekolomsgrid");
  assert(html.includes('.seo-plaatsnav-links a{display:flex!important;align-items:center;justify-content:center;min-width:0;min-height:44px!important;padding:4px 0;line-height:1.25!important;text-align:center;border-bottom:1px solid var(--rule-soft)!important}'),rel+": mobiele plaatslinks zijn niet gecentreerd binnen hun eigen gridkolom of verliezen hun 44px touchdoel");
  assert(html.includes('.seo-plaatsnav-links .seo-plaatsnav-alles{grid-column:1 / -1;justify-content:center;text-align:center;border-bottom-color:transparent!important}'),rel+": Meer plaatsen spant niet gecentreerd over beide mobiele kolommen");
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