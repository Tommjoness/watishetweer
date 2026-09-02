"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const MARKER="/* ===== FINAL RELEASE HARDENING 20260902 ===== */";

function htmlBestanden(dir){
  const uit=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())uit.push(...htmlBestanden(p));
    else if(e.isFile()&&e.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}
function eis(cond,msg){if(!cond)throw new Error(msg);}

const weer=htmlBestanden(OUT).filter(p=>fs.readFileSync(p,"utf8").includes("WeatherNowFinalDesktopUI20260902"));
eis(weer.length>0,"Geen finale weerartifacts gevonden.");
for(const p of weer){
  const html=fs.readFileSync(p,"utf8"),rel=path.relative(OUT,p);
  eis(html.includes(MARKER),rel+": hardeningmarker ontbreekt");
  eis(html.includes("const WEATHER_CACHE_COORD_TOL=0.00051;"),rel+": expliciete cachetolerantie ontbreekt");
  eis(html.includes("weatherNowCachePastBij(oud,nieuweLat,nieuweLon)"),rel+": cache wordt niet aan aanvraagcoördinaten gekoppeld");
  eis(html.includes("weatherNowLocatieSnapshot()"),rel+": vorige succesvolle locatie wordt niet vastgelegd");
  eis(html.includes("const vorigeBlijftZichtbaar=!!(plaatsWijzigt&&vorigeLocatie&&vorigeLocatie.d&&vorigeLocatie.label);"),rel+": trage locatiewissel borgt vorige identiteit niet");
  eis(html.includes('document.getElementById("q").value=String(vorigeLocatie.label||"");'),rel+": zoekveld blijft tijdens trage locatiewissel niet bij vorige locatie");
  eis(html.includes('S.lat=nieuweLat;S.lon=nieuweLon;S.label=label;S.land=aangevraagdeLand;\n    document.getElementById("q").value=label;\n    S.d=vol'),rel+": nieuwe identiteit wordt niet atomair bij succesvolle forecast geactiveerd");
  eis(html.includes("function progressievePreviewToegestaan(stil,wissel,dataVoorLoad){\n  /* Finale locatie-identiteit:"),rel+": finale previewblokkade ontbreekt");
  eis(!html.includes("return !stil&&!!wissel&&!!dataVoorLoad;"),rel+": gedeeltelijke current-only locatiewisselpreview is nog actief");
  eis(html.includes("Er worden geen weergegevens van een andere locatie getoond."),rel+": veilige mismatch-state ontbreekt");
  eis(html.includes("className=\"wiw-location-retry\""),rel+": retryknop ontbreekt");
  eis(html.includes('<th scope="col" aria-label="Gevoelstemperatuur">Gevoel</th>'),rel+": compacte toegankelijke gevoelstemperatuurkop ontbreekt");
  eis(!html.includes('<th scope="col">Gevoelstemperatuur</th>'),rel+": afkappende oude uurkop staat nog in artifact");
  eis(html.includes("grid-template-columns:repeat(6,minmax(0,1fr))!important"),rel+": 3+3+2 desktopgrid ontbreekt");
  eis(html.includes("grid-template-columns:repeat(4,minmax(0,1fr))!important"),rel+": 4x2 brede desktopgrid ontbreekt");
  eis(html.includes("@media(min-width:1100px) and (max-width:1599px)"),rel+": middeldesktop-breakpoint ontbreekt");
  eis(html.includes("@media(min-width:1600px)"),rel+": brede-desktop-breakpoint ontbreekt");
  const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach((bron,i)=>new vm.Script(bron,{filename:rel+":verify-final-release-"+(i+1)}));
}

const over=fs.readFileSync(path.join(ROOT,"over","index.html"),"utf8");
const privacy=fs.readFileSync(path.join(ROOT,"privacy.html"),"utf8");
eis(over.includes("https://github.com/Tommjoness/watishetweer"),"Over-pagina verwijst niet naar uiteindelijke repository.");
eis(!over.includes("https://github.com/Tommjoness/weathernow"),"Over-pagina bevat nog oude repository-URL.");
eis(privacy.includes("https://github.com/Tommjoness/watishetweer"),"Privacypagina verwijst niet naar uiteindelijke repository.");
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  eis(!html.includes("https://github.com/Tommjoness/weathernow"),path.relative(OUT,p)+": oude GitHub-URL bleef in public artifact staan");
}
console.log(`Final release hardening geverifieerd op ${weer.length} weerartifacts: cache-identiteit, uitgeschakelde partial preview, coherente laad/fout/retry-state, compacte uurkop, desktopgrids en repository-URL zijn geborgd.`);
