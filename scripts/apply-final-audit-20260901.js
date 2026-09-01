"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");
const OUT=path.join(__dirname,"..","public");
const START="/* ---------- start ---------- */";
const PRIMARY="<!-- ===== PRIMARY METRIC GRID 20260901 ===== -->";
const MARKER="/* ===== FINAL AUDIT 20260901 ===== */";
const PURE=fs.readFileSync(path.join(__dirname,"final-audit-20260901.js"),"utf8");
const RUNTIME=fs.readFileSync(path.join(__dirname,"final-audit-runtime-20260901.js"),"utf8");
const PLATEAU_OUD='?"De temperatuur blijft tot rond "+hhmm(volledigePiekVandaag.t)+" ongeveer <b>"+huidigAfgerond+" graden</b>."+(nachtZin?" "+nachtZin:"")';
const PLATEAU_NIEUW='?"De temperatuur blijft tot rond "+hhmm(volledigePiekVandaag.t)+" ongeveer <b>"+weatherNowBriefingGraden(huidigAfgerond)+"</b>."+(nachtZin?" "+nachtZin:"")';
const PIEK_OUD=':"Het verwachte maximum ligt vandaag rond "+hhmm(volledigePiekVandaag.t)+" op <b>"+piekAfgerond+" graden</b>."+(nachtZin?" "+nachtZin:"");';
const PIEK_NIEUW=':"Het verwachte maximum ligt vandaag rond "+hhmm(volledigePiekVandaag.t)+" op <b>"+weatherNowBriefingGraden(piekAfgerond)+"</b>."+(nachtZin?" "+nachtZin:"");';
const STYLE=`<style id="weather-final-audit-20260901">
/* Kleine secundaire tekst krijgt in het lichte thema duidelijke AA-marge. */
:root{--ink-45:#5F6B66;--ink-25:#606C67;--teal:#5F6B66}
.final-top-grid,.final-top-left{display:contents}
#chart g[data-q4-rain-periods]{display:none!important}
.final-rain-summary{font-family:var(--sans);font-size:12px;line-height:1.45;color:var(--ink-70);margin:8px 0 0;max-width:90ch}
.final-rain-summary[hidden]{display:none!important}
.final-warning-explanation{margin:6px 0!important;color:var(--ink-70)!important}
.final-warning-explanation strong{font-weight:600;color:var(--ink)}
.final-warning-source{display:inline-flex;align-items:center;min-height:44px;margin-top:4px;font-size:12px;color:var(--ink-70);text-underline-offset:2px}
.final-warning-source:hover,.final-warning-source:focus-visible{color:var(--ink)}
@media(max-width:900px){
  .tools input,.tools button{min-height:44px}
  .results>div{min-height:44px;display:flex;align-items:center}
  .chip{min-height:44px}
  .chipplaats{min-height:40px;display:inline-flex;align-items:center}
  .chip .x{min-width:36px;min-height:40px;display:inline-flex;align-items:center;justify-content:center}
  .data-uitleg summary,.footer-details summary{min-height:44px;display:inline-flex;align-items:center}
  #days .row.day:not(.kop){min-height:44px}
}
@media(min-width:1100px){
  .final-top-grid{display:grid;grid-template-columns:minmax(0,.95fr) minmax(480px,1.05fr);gap:48px;align-items:start;margin-top:var(--s3)}
  .final-top-left{display:flex;flex-direction:column;min-width:0}
  .final-top-left .brief{margin-top:0}
  .final-top-left .hero{margin-top:var(--s3);min-width:0}
  .final-top-grid>.stats{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;margin-top:0!important;border-top:1px solid var(--ink)!important;align-self:start;min-width:0}
  .final-top-grid>.stats .stat{min-width:0}
  .final-top-grid>.stats .stat:nth-child(4n){border-right:1px solid var(--rule);padding-right:22px}
  .final-top-grid>.stats .stat:nth-child(2n){border-right:none;padding-right:0;padding-left:22px}
  .final-top-grid>.stats .stat:nth-child(2n+1){padding-left:0}
  .dashrow-chart .dagmod{max-width:1280px;margin-left:auto;margin-right:auto}
}
@media(max-width:430px){.final-rain-summary{font-size:11px;margin-top:6px}}
</style>`;

function htmlBestanden(dir){const uit=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())uit.push(...htmlBestanden(p));else if(e.isFile()&&e.name.endsWith(".html"))uit.push(p);}return uit;}
function weerBestand(html){return html.includes(PRIMARY)&&html.includes("WeatherNowFinalGlobalCorrectness");}
function centraliseerBriefingPlateau(html,p){
  let uit=html;
  /* Unified-weather-truth gebruikt de centrale formatter inmiddels zelf. Deze
     compatibiliteitsroute blijft alleen bestaan voor oudere tussen-artifacts. */
  if(uit.includes(PLATEAU_NIEUW)&&uit.includes(PIEK_NIEUW))return uit;
  for(const [oud,nieuw,label] of [[PLATEAU_OUD,PLATEAU_NIEUW,"briefingplateau"],[PIEK_OUD,PIEK_NIEUW,"briefingpiek"]]){
    const n=uit.split(oud).length-1;if(n!==1)throw new Error(label+" ontbreekt of is dubbel in "+p+": "+n);uit=uit.replace(oud,nieuw);
  }
  return uit;
}
function pasWeerToe(p){
  let html=fs.readFileSync(p,"utf8");if(!weerBestand(html))return false;if(html.includes(MARKER))throw new Error("Finale audit staat al in "+p);
  if((html.split(START).length-1)!==1)throw new Error("Startupmarker ontbreekt of is dubbel in "+p);
  if((html.split("</head>").length-1)!==1)throw new Error("Head-einde ontbreekt of is dubbel in "+p);
  html=centraliseerBriefingPlateau(html,p);
  html=html.replace("</head>",STYLE+"\n</head>");
  html=html.replace(START,MARKER+"\n"+PURE+"\n"+RUNTIME+"\n"+START);
  const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach((bron,i)=>new vm.Script(bron,{filename:path.basename(p)+":final-audit-"+(i+1)}));
  fs.writeFileSync(p,html,"utf8");return true;
}
function privacyConsistent(){
  for(const p of htmlBestanden(OUT)){
    let html=fs.readFileSync(p,"utf8"),nieuw=html
      .replace(/href=["'](?:\/)?privacy\.html["']/g,'href="/privacy"')
      .replace(/https:\/\/watishetweer\.nl\/privacy\.html/g,"https://watishetweer.nl/privacy");
    if(nieuw!==html)fs.writeFileSync(p,nieuw,"utf8");
  }
  const privacy=path.join(OUT,"privacy.html");
  if(!fs.existsSync(privacy))throw new Error("public/privacy.html ontbreekt.");
  const phtml=fs.readFileSync(privacy,"utf8");
  if(!phtml.includes('<link rel="canonical" href="https://watishetweer.nl/privacy">'))throw new Error("Privacycanonical is niet /privacy.");
  const sitemap=path.join(OUT,"sitemap.xml");let xml=fs.readFileSync(sitemap,"utf8");
  if(!xml.includes("https://watishetweer.nl/privacy")){
    if(!xml.includes("</urlset>"))throw new Error("Sitemap heeft geen urlset-einde.");
    xml=xml.replace("</urlset>",'  <url>\n    <loc>https://watishetweer.nl/privacy</loc>\n  </url>\n</urlset>');
    fs.writeFileSync(sitemap,xml,"utf8");
  }
}
function main(){let n=0;for(const p of htmlBestanden(OUT))if(pasWeerToe(p))n++;if(!n)throw new Error("Geen finale weerpagina's gevonden voor auditlaag.");privacyConsistent();const versie=vernieuwServiceworkerCache(OUT,"final-audit-20260901");console.log(`Finale audit toegepast op ${n} weerpagina's; desktop topgrid, rustige grafiek, correcte regenperioden, waarschuwinguitleg, contrast en privacycanonical geborgd; cache ${versie}.`);}
if(require.main===module)main();
module.exports={OUT,START,PRIMARY,MARKER,STYLE,PLATEAU_OUD,PLATEAU_NIEUW,PIEK_OUD,PIEK_NIEUW,centraliseerBriefingPlateau,pasWeerToe,privacyConsistent,main};