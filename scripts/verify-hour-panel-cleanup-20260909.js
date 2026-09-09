"use strict";

const fs=require("fs");
const path=require("path");
const {OUT,BASIS_MARKER,MARKER,htmlBestanden}=require("./apply-hour-panel-cleanup-20260909.js");

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
  eis(/#wiw-hour-panel h3\{text-align:center!important\}/.test(html),`${rel}: Komende-uren-kop is niet gecentreerd`);
  eis(/\.wiw-hour-table th:nth-child\(1\),\.wiw-hour-table td:nth-child\(1\)\{width:14%!important\}/.test(html),`${rel}: tijdkolom is niet compact genoeg`);
  eis(/\.wiw-hour-table th:nth-child\(2\),\.wiw-hour-table td:nth-child\(2\)\{width:7%!important;text-align:center!important\}/.test(html),`${rel}: weerkolom is niet compact genoeg`);
  eis(/\.wiw-hour-table th:nth-child\(3\),\.wiw-hour-table td:nth-child\(3\)\{width:22%!important\}/.test(html),`${rel}: temperatuurkolom heeft niet de nieuwe positie/breedte`);
  eis(/\.wiw-hour-table th:nth-child\(4\),\.wiw-hour-table td:nth-child\(4\)\{width:30%!important\}/.test(html),`${rel}: neerslagkolom mist teruggewonnen ruimte`);
  eis(/\.wiw-hour-table th:nth-child\(5\),\.wiw-hour-table td:nth-child\(5\)\{width:27%!important\}/.test(html),`${rel}: windkolom mist teruggewonnen ruimte`);
  eis(/\.wiw-hour-temp \.wiw-hour-secondary\{display:none!important\}/.test(html),`${rel}: zichtbare gevoelstemperatuur is niet verwijderd uit de uurregels`);
  eis(html.includes('tempSub.className="wiw-hour-secondary"'),`${rel}: bronwaarde voor gevoelstemperatuur is onbedoeld uit de runtime verwijderd`);
  eis(html.includes('regenSub.className="wiw-hour-secondary"')&&html.includes('windSub.className="wiw-hour-secondary"'),`${rel}: neerslagkans of windsnelheid is onbedoeld geraakt`);
}

eis(geraakt>0,"Geen uurpaneel-artifacts gevonden voor cleanupverificatie.");
console.log(`Uurpaneelcleanup geverifieerd op ${geraakt} weerartifacts: titel gecentreerd, TEMP. eerder, gevoelstemperatuur visueel weg en overige rijke data intact.`);
