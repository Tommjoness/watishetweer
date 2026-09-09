"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {
  OUT,MARKER,RUNTIME_ID,UREN_NIEUW,GRAFIEK_START_NIEUW,GRAFIEK_SYNC_NIEUW,htmlBestanden
}=require("./apply-desktop-visual-polish-20260909.js");

function eis(ok,bericht){if(!ok)throw new Error(bericht);}

let geraakt=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(MARKER))continue;
  geraakt++;
  const rel=path.relative(OUT,p);
  eis(html.includes(UREN_NIEUW),rel+": desktopvenster is niet exact 11 uur");
  eis(html.includes(GRAFIEK_START_NIEUW)&&html.includes(GRAFIEK_SYNC_NIEUW),rel+": grafiek en tabel delen niet dezelfde 11-uursrange");
  eis(html.includes('grid-template-columns:\n      100px 26px minmax(260px,380px)'),rel+": weekmetriekgroep is niet gericht begrensd");
  eis(html.includes('112px minmax(140px,180px) 112px minmax(118px,148px) minmax(360px,1fr)'),rel+": vijf Nachtzicht-kolommen ontbreken");
  eis(html.includes('.wiw-hour-table .wiw-hour-primary{line-height:1.15!important}'),rel+": elf comfortabele uurregels zijn niet hoogteveilig");
  eis(html.includes('const onderdelen=[".nachtadvies",".nachtvenster",".nachtmaan"]'),rel+": Nachtzicht-inhoud wordt niet expliciet over de vijf desktopkolommen verdeeld");
  eis(html.includes('window.addEventListener("resize",plan,{passive:true})'),rel+": Nachtzicht-kolommen herstellen niet veilig bij responsive resize");
  eis(html.includes('.wiw-night-assessment-head{display:block}'),rel+": zichtbare Beoordeling-header ontbreekt");
  eis(html.includes('id="'+RUNTIME_ID+'"'),rel+": Nachtzicht-header-runtime ontbreekt");
  eis(html.includes('label.textContent="Beoordeling"'),rel+": Nachtzicht-headercopy ontbreekt");
  eis(html.includes('if(desktop&&vak.nextElementSibling!==periode)kop.insertBefore(vak,periode)'),rel+": semantische Nachtzicht-kopvolgorde is niet gelijk aan de visuele kolomvolgorde");
  eis(html.includes('--wiw-section-gap:28px'),rel+": gedeeld sectieritme ontbreekt");
  const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
  scripts.forEach((bron,i)=>new vm.Script(bron,{filename:rel+":desktop-polish-"+(i+1)}));
}
eis(geraakt>0,"Geen desktop-polishartifacts gevonden.");
console.log(`Desktop-polish geverifieerd op ${geraakt} weerartifacts: 11 identieke grafiek-/tabeluren, compacte weekmetriekgroep, expliciete Nachtzicht-header en gelijk sectieritme.`);
