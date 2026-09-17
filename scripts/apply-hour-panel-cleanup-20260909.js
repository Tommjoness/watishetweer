"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const BASIS_MARKER="/* ===== DESKTOP FINISHING 20260907 ===== */";
const MARKER="/* ===== HOUR PANEL CLEANUP 20260909 ===== */";
const UURKOP_BRON='<tr><th scope="col">Tijd</th><th scope="col"><span class="wiw-visually-hidden">Weer</span></th><th scope="col">Temp.</th><th scope="col">Neerslag</th><th scope="col">Wind</th></tr>';
const UURKOP_NIEUW='<tr><th scope="col">Tijd</th><th scope="col"><span class="wiw-visually-hidden">Weer</span></th><th scope="col">Temperatuur</th><th scope="col">Neerslag</th><th scope="col">Wind</th></tr>';
const STYLE=`
${MARKER}
/* Gerichte desktoppresentatie: de tabeldata en mobiele layout blijven intact. */
@media(min-width:1100px){
  #wiw-hour-panel h3{text-align:center!important}
  .wiw-hour-table th:nth-child(1),.wiw-hour-table td:nth-child(1){width:14%!important}
  .wiw-hour-table th:nth-child(2),.wiw-hour-table td:nth-child(2){width:7%!important;text-align:center!important}
  .wiw-hour-table th:nth-child(3),.wiw-hour-table td:nth-child(3){width:29%!important;text-align:center!important}
  .wiw-hour-table th:nth-child(4),.wiw-hour-table td:nth-child(4){width:28%!important}
  .wiw-hour-table th:nth-child(5),.wiw-hour-table td:nth-child(5){width:22%!important}
  .wiw-hour-table thead th:nth-child(3){white-space:nowrap!important}
  .wiw-hour-temp .wiw-hour-secondary{display:none!important}

  /* De eerdere readability-regel wees nog naar de verwijderde .dashrow-hero-
     structuur. Richt de maat nu op de actuele final-top-grid hero en houd het
     hoofdgegeven bewust compact naast de briefing en metriekblokken. */
  .final-top-grid #t{font-size:60px!important;line-height:.86!important}
  .final-top-grid .deg{font-size:18px!important;margin-top:4px!important}

  /* De dagcontext zit al in de lokale tijden en grafiek. Het losse Vandaag/Morgen-
     label boven de grafiek voegt daar op desktop geen bruikbare context meer toe. */
  #suntimes.senior-zoninfo .zonregel .zondag{display:none!important}
}
`;

function tel(bron,zoek){return String(bron).split(zoek).length-1;}
function werkDesktopUurkopBij(bron,label="artifact"){
  const oud=tel(bron,UURKOP_BRON),nieuw=tel(bron,UURKOP_NIEUW);
  if(oud===1&&nieuw===0)return String(bron).replace(UURKOP_BRON,UURKOP_NIEUW);
  if(oud===0&&nieuw===1)return String(bron);
  throw new Error(`${label}: desktop-uurtabelkop verwacht exact één oude of nieuwe variant; oud=${oud}, nieuw=${nieuw}.`);
}

function htmlBestanden(dir){
  const uit=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())uit.push(...htmlBestanden(p));
    else if(ent.isFile()&&ent.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function pasTekstAan(html,label="artifact"){
  const bron=String(html||"");
  if(!bron.includes(BASIS_MARKER))return {html:bron,geraakt:false};
  const metUurkop=werkDesktopUurkopBij(bron,label);
  if(metUurkop.includes(MARKER))return {html:metUurkop,geraakt:true};
  const headEinde=metUurkop.indexOf("</head>");
  if(headEinde<0)throw new Error(`${label}: </head> ontbreekt voor uurpaneelcleanup.`);
  const stylePos=metUurkop.lastIndexOf("</style>",headEinde);
  if(stylePos<0)throw new Error(`${label}: actief head-stijlblok ontbreekt voor uurpaneelcleanup.`);
  return {html:metUurkop.slice(0,stylePos)+STYLE+"\n"+metUurkop.slice(stylePos),geraakt:true};
}

function main(){
  let geraakt=0,geschreven=0;
  for(const p of htmlBestanden(OUT)){
    const voor=fs.readFileSync(p,"utf8"),r=pasTekstAan(voor,path.relative(OUT,p));
    if(!r.geraakt)continue;
    geraakt++;
    if(r.html!==voor){fs.writeFileSync(p,r.html,"utf8");geschreven++;}
  }
  if(!geraakt)throw new Error("Geen uurpaneel-artifacts gevonden voor desktopcleanup.");
  const cache=vernieuwServiceworkerCache(OUT,"hour-panel-cleanup-20260909");
  console.log(`Uurpaneelcleanup toegepast op ${geraakt} weerartifacts (${geschreven} gewijzigd): volledige temperatuurkop, gecentreerde temperatuurkolom, actuele temperatuur vast op 60px, verwijderd los daglabel en compacte desktopkolommen; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,BASIS_MARKER,MARKER,UURKOP_BRON,UURKOP_NIEUW,STYLE,werkDesktopUurkopBij,htmlBestanden,pasTekstAan,main};
