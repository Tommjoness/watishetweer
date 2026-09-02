"use strict";

const fs=require("fs"),path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="/* ===== FINAL VISUAL POLISH 20260902 ===== */";
const STYLE=`
${MARKER}
/* Laatste visuele polish: gecentreerde meetwaarden, rustige scrollbars en een
   optisch uitgebalanceerd Nachtzicht-raster. Geen functionele of datawijziging. */
.final-top-grid>.stats .stat .sval{justify-content:center!important;align-items:baseline!important;margin-left:auto!important;margin-right:auto!important}

html{scrollbar-width:thin;scrollbar-color:var(--ink-45) var(--paper)}
html::-webkit-scrollbar{width:10px;height:10px}
html::-webkit-scrollbar-track{background:var(--paper)}
html::-webkit-scrollbar-thumb{background:var(--ink-45);border:3px solid var(--paper);border-radius:999px}
html::-webkit-scrollbar-thumb:hover{background:var(--ink-70)}
.wiw-hour-table-scroll{scrollbar-width:thin;scrollbar-color:var(--ink-45) transparent;scrollbar-gutter:stable}
.wiw-hour-table-scroll::-webkit-scrollbar{width:8px}
.wiw-hour-table-scroll::-webkit-scrollbar-track{background:transparent}
.wiw-hour-table-scroll::-webkit-scrollbar-thumb{background:var(--ink-45);border:2px solid var(--sheet);border-radius:999px}
.wiw-hour-table-scroll::-webkit-scrollbar-thumb:hover{background:var(--ink-70)}

@media(min-width:1100px){
  #nights .row.night{grid-template-columns:112px 72px minmax(220px,1fr) 112px minmax(300px,360px)!important;column-gap:20px!important}
  #nights .row.night .score,#nights .row.night .nmeta:not(.wide){justify-self:stretch;text-align:center}
  #nights .row.night .sbar{align-self:center;min-width:0;width:100%}
  #nights .row.night .nmeta .perc{min-width:0;text-align:center}
  #nights .row.night .nmeta.wide{display:flex;flex-direction:column;align-items:center;justify-content:center;justify-self:stretch;min-width:0;width:100%;max-width:none;text-align:center;white-space:normal;overflow-wrap:break-word}
  #nights .row.night.kop .nmeta.wide{display:flex}
  #nights .row.night .nachtadvies,#nights .row.night .nachtmaan{width:100%;max-width:32ch;margin-left:auto;margin-right:auto;text-align:center}
  #nights .row.night .nachtmaan{white-space:normal}
}

@media(forced-colors:active){
  html,.wiw-hour-table-scroll{scrollbar-color:auto}
}
`;

function htmlBestanden(dir){
  const uit=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())uit.push(...htmlBestanden(p));
    else if(e.isFile()&&e.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function pasToe(pad){
  let html=fs.readFileSync(pad,"utf8");
  if(!html.includes("/* ===== FINAL RELEASE HARDENING 20260902 ===== */"))return false;
  if(html.includes(MARKER))throw new Error("Final visual polish staat al in "+pad);
  const pos=html.lastIndexOf("</style>");
  if(pos<0)throw new Error("Geen stijlblok gevonden in "+pad);
  html=html.slice(0,pos)+STYLE+"\n"+html.slice(pos);
  fs.writeFileSync(pad,html,"utf8");
  return true;
}

function main(){
  let n=0;
  for(const p of htmlBestanden(OUT))if(pasToe(p))n++;
  if(!n)throw new Error("Geen finale weerartifacts gevonden voor visual polish.");
  const cache=vernieuwServiceworkerCache(OUT,"final-visual-polish-20260902");
  console.log(`Final visual polish toegepast op ${n} weerpagina's: meetwaarden gecentreerd, scrollbars gethematiseerd en Nachtzicht-raster uitgebalanceerd; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,MARKER,STYLE,htmlBestanden,pasToe,main};
