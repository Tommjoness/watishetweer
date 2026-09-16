"use strict";

const fs=require("fs");
const path=require("path");
const {OUT,BASIS_MARKER,MARKER,UURKOP_BRON,UURKOP_NIEUW,htmlBestanden}=require("./apply-hour-panel-cleanup-20260909.js");

function eis(ok,msg){if(!ok)throw new Error(msg);}
function tel(bron,zoek){return String(bron).split(zoek).length-1;}

let geraakt=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(BASIS_MARKER))continue;
  geraakt++;
  const rel=path.relative(OUT,p);
  eis(tel(html,MARKER)===1,`${rel}: uurpaneelcleanup-marker ontbreekt of is dubbel`);
  eis(html.indexOf(MARKER)>html.indexOf(BASIS_MARKER),`${rel}: cleanup moet na de bewezen 20260907-laag staan`);
  eis(tel(html,UURKOP_BRON)===0&&tel(html,UURKOP_NIEUW)===1,`${rel}: desktop-uurtabelkop is niet volledig gewijzigd naar Temperatuur`);
  eis(/#wiw-hour-panel h3\{text-align:center!important\}/.test(html),`${rel}: Komende-uren-kop is niet gecentreerd`);
  eis(/\.wiw-hour-table th:nth-child\(1\),\.wiw-hour-table td:nth-child\(1\)\{width:14%!important\}/.test(html),`${rel}: tijdkolom is niet compact genoeg`);
  eis(/\.wiw-hour-table th:nth-child\(2\),\.wiw-hour-table td:nth-child\(2\)\{width:7%!important;text-align:center!important\}/.test(html),`${rel}: weerkolom is niet compact genoeg`);
  eis(/\.wiw-hour-table th:nth-child\(3\),\.wiw-hour-table td:nth-child\(3\)\{width:25%!important\}/.test(html),`${rel}: temperatuurkolom heeft niet genoeg ruimte voor de volledige kop`);
  eis(/\.wiw-hour-table th:nth-child\(4\),\.wiw-hour-table td:nth-child\(4\)\{width:29%!important\}/.test(html),`${rel}: neerslagkolom heeft niet de gebalanceerde breedte`);
  eis(/\.wiw-hour-table th:nth-child\(5\),\.wiw-hour-table td:nth-child\(5\)\{width:25%!important\}/.test(html),`${rel}: windkolom heeft niet de gebalanceerde breedte`);
  eis(/\.wiw-hour-table thead th:nth-child\(3\)\{white-space:nowrap!important\}/.test(html),`${rel}: volledige temperatuurkop kan nog afbreken`);
  eis(/\.wiw-hour-temp \.wiw-hour-secondary\{display:none!important\}/.test(html),`${rel}: zichtbare gevoelstemperatuur is niet verwijderd uit de uurregels`);
  eis(html.includes('.final-top-grid #t{font-size:clamp(94px,7vw,108px)!important;line-height:.86!important}'),`${rel}: actuele temperatuur gebruikt niet de echte final-top-grid-selector of de rustigere maat`);
  eis(html.includes('.final-top-grid .deg{font-size:28px!important;margin-top:4px!important}'),`${rel}: temperatuurunit sluit niet aan op de rustigere hero`);
  eis(html.includes('#suntimes.senior-zoninfo .zonregel .zondag{display:none!important}'),`${rel}: los Vandaag/Morgen-label is op desktop nog zichtbaar`);
  eis(html.includes('tempSub.className="wiw-hour-secondary"'),`${rel}: bronwaarde voor gevoelstemperatuur is onbedoeld uit de runtime verwijderd`);
  eis(html.includes('regenSub.className="wiw-hour-secondary"')&&html.includes('windSub.className="wiw-hour-secondary"'),`${rel}: neerslagkans of windsnelheid is onbedoeld geraakt`);
}

eis(geraakt>0,"Geen uurpaneel-artifacts gevonden voor cleanupverificatie.");
console.log(`Uurpaneelcleanup geverifieerd op ${geraakt} weerartifacts: volledige Temperatuur-kop zonder wrapping, rustigere actuele temperatuur op de actuele hero-selector, geen los Vandaag/Morgen-label en overige rijke data intact.`);
