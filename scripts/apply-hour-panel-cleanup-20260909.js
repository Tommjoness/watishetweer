"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const BASIS_MARKER="/* ===== DESKTOP FINISHING 20260907 ===== */";
const MARKER="/* ===== HOUR PANEL CLEANUP 20260909 ===== */";
const STYLE=`
${MARKER}
/* Gerichte desktoppresentatie: de tabeldata en mobiele layout blijven intact. */
@media(min-width:1100px){
  #wiw-hour-panel h3{text-align:center!important}
  .wiw-hour-table th:nth-child(1),.wiw-hour-table td:nth-child(1){width:14%!important}
  .wiw-hour-table th:nth-child(2),.wiw-hour-table td:nth-child(2){width:7%!important;text-align:center!important}
  .wiw-hour-table th:nth-child(3),.wiw-hour-table td:nth-child(3){width:22%!important}
  .wiw-hour-table th:nth-child(4),.wiw-hour-table td:nth-child(4){width:30%!important}
  .wiw-hour-table th:nth-child(5),.wiw-hour-table td:nth-child(5){width:27%!important}
  .wiw-hour-temp .wiw-hour-secondary{display:none!important}
}
`;

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
  if(bron.includes(MARKER))return {html:bron,geraakt:true};
  const headEinde=bron.indexOf("</head>");
  if(headEinde<0)throw new Error(`${label}: </head> ontbreekt voor uurpaneelcleanup.`);
  const stylePos=bron.lastIndexOf("</style>",headEinde);
  if(stylePos<0)throw new Error(`${label}: actief head-stijlblok ontbreekt voor uurpaneelcleanup.`);
  return {html:bron.slice(0,stylePos)+STYLE+"\n"+bron.slice(stylePos),geraakt:true};
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
  console.log(`Uurpaneelcleanup toegepast op ${geraakt} weerartifacts (${geschreven} gewijzigd): gecentreerde kop, compactere kolommen en verborgen gevoelstemperatuur op desktop; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,BASIS_MARKER,MARKER,STYLE,htmlBestanden,pasTekstAan,main};
