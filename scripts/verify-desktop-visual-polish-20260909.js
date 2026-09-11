"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {OUT,MARKER,RUNTIME_ID,LATE_STYLE_ID,htmlBestanden}=require("./apply-desktop-visual-polish-20260909.js");
const {UREN_NIEUW,GRAFIEK_SYNC_NIEUW}=require("./apply-hour-panel-refinement-20260907.js");

function eis(ok,bericht){if(!ok)throw new Error(bericht);}

let geraakt=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(MARKER))continue;
  geraakt++;
  const rel=path.relative(OUT,p);
  eis(html.includes(UREN_NIEUW),rel+": uur-owner begrenst desktop niet op maximaal 11 uur");
  eis(html.includes(GRAFIEK_SYNC_NIEUW),rel+": uur-owner synchroniseert grafiek niet met de zichtbare tabelrange");
  eis(!html.includes('.wiw-hour-table tbody tr{height:29px!important}'),rel+": desktop-polish forceert opnieuw een tweede rijhoogte-owner");
  eis(html.includes('grid-template-columns:\n      100px 26px minmax(260px,380px)'),rel+": weekmetriekgroep is niet gericht begrensd");
  eis(html.includes('112px minmax(140px,180px) 112px minmax(118px,148px) minmax(360px,1fr)'),rel+": vijf Nachtzicht-kolommen ontbreken");
  eis(/#nights \.row\.night:not\(\.kop\)>\.nachtvenster\{[^}]*white-space:normal!important[^}]*\}/.test(html),rel+": zichtperiode mag op desktop niet meer buiten de eigen kolom doorlopen");
  eis(html.includes('@media(min-width:1600px)'),rel+": brede Nachtzicht-breakpoint is niet 1600px");
  eis(html.includes('minmax(300px,.82fr) minmax(240px,.68fr)'),rel+": finale brede Nachtzicht-verdeling over zes kolommen ontbreekt");
  eis(html.includes('grid-column:5!important;grid-row:1!important;\n    white-space:normal!important'),rel+": brede zichtperiode kan tekst niet veilig binnen de eigen kolom wrappen");
  eis(html.includes('.wiw-hour-table .wiw-hour-primary{line-height:1.15!important}'),rel+": uurtypografie ontbreekt");
  eis(html.includes(LATE_STYLE_ID),rel+": finale runtime-cascadeowner voor desktoppolish ontbreekt");
  eis(html.includes('#t,.deg,#minitemp,.sval,.score,'),rel+": gedeelde selector voor consumentencijfers ontbreekt");
  eis(html.includes('font-variant-numeric:lining-nums tabular-nums!important'),rel+": consumentencijfers missen lining/tabular nums");
  eis(html.includes('font-feature-settings:\\"lnum\\" 1,\\"tnum\\" 1!important'),rel+": consumentencijfers missen expliciete OpenType-normalisatie");
  eis(html.includes('footer{font-size:12px!important;color:var(--ink-70)!important}'),rel+": basis desktopbronnenstijl ontbreekt");
  eis(html.includes('.dashrow-days .nachtkop,.dashrow-days + h2{margin-top:24px!important}'),rel+": brede onderste secties missen het compactere ritme");
  eis(html.includes('.sheet{padding-bottom:32px!important}'),rel+": brede overgang naar plaatsnavigatie blijft te ruim");
  eis(html.includes('.seo-plaatsnav{margin-top:0!important;padding:1px 0!important;min-height:54px!important}'),rel+": brede plaatsnavigatie blijft onnodig hoog");
  eis(!html.includes('regel.textContent=\"Nederlandse LKI '),rel+": verwijderde Nederlandse LKI-subcopy staat nog in de artifact");
  eis(html.includes('.wiw-night-assessment-head{display:block}'),rel+": zichtbare Beoordeling-header ontbreekt");
  eis(html.includes('.wiw-night-moon-head{')&&html.includes('grid-column:6'),rel+": brede Maan-kolom ontbreekt");
  eis(html.includes('.wiw-night-visibility-detail{display:none!important}'),rel+": dubbele zichtregel wordt niet uit de brede Maan-kolom gehouden");
  eis(html.includes('markeerDubbelZichtInMaan()'),rel+": semantische markering van de dubbele zichtregel ontbreekt");
  eis(html.includes('#aq{width:min(1320px,100%)!important;margin-left:auto!important;margin-right:auto!important}'),rel+": brede luchtkwaliteit-/pollengroep is niet compact gecentreerd");
  eis(html.includes('id="'+RUNTIME_ID+'"'),rel+": Nachtzicht-header-runtime ontbreekt");
  eis(html.includes('label.textContent="Beoordeling"'),rel+": Nachtzicht-headercopy ontbreekt");
  eis(html.includes('label.textContent="Maan"'),rel+": Nachtzicht-maankop ontbreekt");
  eis(html.includes('--wiw-section-gap:28px'),rel+": gedeeld sectieritme ontbreekt");

  /* Laatste desktop-readability pass: borg precies de vijf visuele klachten uit
     de live screenshots zonder mobiele layout of weerdata te muteren. */
  eis(html.includes('body{font-size:16px!important;padding-bottom:0!important}'),rel+": loze desktop-bodyruimte of leesbaarheidsoverride ontbreekt");
  eis(html.includes('.dashrow-hero #t{font-size:clamp(88px,6vw,102px)!important;line-height:.82!important}'),rel+": huidige temperatuur is nog te dominant op desktop");
  eis(html.includes('#suntimes .zondag + span,')&&html.includes('#suntimes > span:first-child:nth-last-child(3)'),rel+": redundante zonsopkomst/-ondergangcopy naast de grafiek wordt niet veilig verborgen");
  eis(html.includes('.wiw-hour-date{font-size:11px!important;color:var(--ink-70)!important'),rel+": datumlabel in de uurtabel blijft te klein");
  eis(html.includes('.wiw-hour-table{font-size:13.25px!important}')&&html.includes('#days .dcond{font-size:14px!important}'),rel+": kerngegevens op desktop hebben geen leesbaarheidspass gekregen");
  eis(html.includes('html body footer{font-size:13px!important}'),rel+": footer blijft te klein op breed desktop");

  const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
  scripts.forEach((bron,i)=>new vm.Script(bron,{filename:rel+":desktop-polish-"+(i+1)}));
}
eis(geraakt>0,"Geen desktop-polishartifacts gevonden.");
console.log(`Desktop-polish geverifieerd op ${geraakt} weerartifacts: één uurhoogte-owner, maximaal 11 gedeelde uren, compacte weekmetriekgroep, finale brede Nachtzicht-maanverdeling zonder dubbele zichtregel of tekstuitloop, compactere huidige temperatuur, ruimere kleine tekst en geen loze desktopondermarge.`);
