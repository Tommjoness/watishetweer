"use strict";

const fs=require("fs");
const path=require("path");
const {
  OUT,BASIS_MARKER,MARKER,STYLE_ID,RIJ_FILTER_PRODUCTIE,
  UURKLOK_BRON,UURKLOK_PRODUCTIE,htmlBestanden,tel
}=require("./apply-mobile-final-polish-20260910.js");

function eis(ok,bericht){if(!ok)throw new Error(bericht);}

let gecontroleerd=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8"),rel=path.relative(OUT,p);
  if(!html.includes(BASIS_MARKER))continue;
  gecontroleerd++;
  eis(html.includes(MARKER),`${rel}: mobiele final-polishstijl ontbreekt`);
  eis(tel(html,`id="${STYLE_ID}"`)===1,`${rel}: mobiele final-polishstijl-id ontbreekt of is dubbel`);
  eis(html.includes(RIJ_FILTER_PRODUCTIE),`${rel}: verstreken-uurrijfilter ontbreekt`);
  eis(html.includes(UURKLOK_PRODUCTIE),`${rel}: actuele lokale klok wordt niet aan de mobiele uurtabel doorgegeven`);
  eis(!html.includes(UURKLOK_BRON),`${rel}: oude provider-current klokroute staat nog actief in de mobiele uurtabel`);
  eis(html.includes("#minibar.aan::after"),`${rel}: zachte overgang onder de fixed mobiele locatiebalk ontbreekt`);
  eis(html.includes("linear-gradient(to bottom,var(--sheet),transparent)"),`${rel}: mobiele headerfade is niet thema-eigen`);
  eis(html.includes("#wiw-hour-title{font-size:18px!important;line-height:1.18!important;scroll-margin-top:64px}"),`${rel}: subtiel compactere mobiele uurtabeltitel ontbreekt`);
  eis(html.includes("@media(max-width:900px)"),`${rel}: mobiele polish is niet tot de bestaande mobiele breakpoint begrensd`);
  eis(!html.includes("@media(max-width:430px){\n  #wiw-hour-title"),`${rel}: extra smalle titelbreakpoint hoort niet meer actief te zijn`);
}

eis(gecontroleerd>0,"Geen finale weerartifacts gevonden om mobiele final-polish te verifiëren.");
console.log(`Mobiele final-polish geverifieerd in ${gecontroleerd} artifacts: geen verstreken lopend uur in komende-uurtabel, actuele lokale klok, zachte fixed-headerovergang en compactere uurtitel.`);
