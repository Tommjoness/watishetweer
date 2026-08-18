"use strict";

const fs=require("fs");
const path=require("path");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
const swPad=path.join(OUT,"sw.js");
if(!fs.existsSync(htmlPad)||!fs.existsSync(swPad))throw new Error("Definitieve public-artifact ontbreekt.");

const html=fs.readFileSync(htmlPad,"utf8");
for(const vereist of [
  "WeatherNowMobileScreenshotPolish",
  "maan-fase-svg-v2",
  "maan-schaduw",
  "data-maan-fase",
  "--moon-unlit",
  "grid-template-columns:104px 52px minmax(40px,1fr) 104px minmax(180px,218px)",
  "overflow-wrap:break-word",
  "Temperatuur komende 3 uur",
  "temperatuurTrend",
  "renderNeerslagSectie",
  "q1-neerslag-hidden",
  "q1-pop-hidden",
  "klokBijwerken=function(){basisKlokBijwerken();if(S.d)renderTemperatuurTrend();}",
  "pollenEenheid",
  "pollenKop",
  "grid-template-columns:56px 46px minmax(32px,1fr) 64px",
  "grid-template-columns:52px 43px minmax(28px,1fr) 60px",
  "bron-bronnen",
  "MOBILE SCREENSHOT POLISH 20260810B",
  "WeatherNowQ1",
  "q1-dag-mm",
  "weerbriefing.plaatscache.q1",
  "CHECKPOINT 25 Q1",
  "verbeterNachtzicht",
  "normaliseerNachtDagdata",
  "nachtIsActiefNu",
  "corrigeerNachtVensterBron",
  "formatteerMaanTekst",
  "nachtzichtregel",
  "nachtmaanregel",
  "H=M?250:296",
  "pt=M?59:76, ih=M?145:160",
  "tijdLabelVrij=nuX==null",
  "val+labelHoogte/2+4<=pb",
  "ruimBotsendeAslabelsOp",
  "if(!M)return;",
  "temperatuurLabels=teksten.filter",
  "getBBox()",
  "Nachtzicht-presentatie geconsolideerd in WeatherNowMobileScreenshotPolish"
]){
  if(!html.includes(vereist))throw new Error("Definitieve productie-invariant ontbreekt: "+vereist);
}
const oude15='<div class="eyebrow">Afgelopen 15 minuten</div><div class="sval" id="prec">';
const oudeKwartier="Afgelopen kwartier";
const trend='<div class="eyebrow">Temperatuur komende 3 uur</div><div class="sval" id="prec">';
if(html.includes(oude15)||html.includes(oudeKwartier))throw new Error("Verwijderde recente-neerslagtegel staat nog in de definitieve artifact.");
if((html.split(trend).length-1)!==1)throw new Error("Definitieve temperatuurtrendtegel ontbreekt of is dubbel.");
if(html.includes("const recenteNeerslag=eindigGetal(c.precipitation)"))throw new Error("Legacy recente-neerslagberekening staat nog in de definitieve artifact.");
if(html.includes("compactRecentLabel"))throw new Error("Legacy kwartier-wrapper staat nog in de definitieve artifact.");
if(html.includes("Beste modeluren")||html.includes("Relatief gunstigste modeluren"))throw new Error("Nachtzicht bevat nog oud modeljargon in de definitieve artifact.");

const nachtOwners=html.split("const basisNachten=nachten;").length-1;
if(nachtOwners!==1)throw new Error("Nachtzicht heeft "+nachtOwners+" presentatie-owners; exact één vereist.");
if(html.includes('const basisNachten=nachten;\nnachten=function(){\n  basisNachten();\n  const rijen=[...document.querySelectorAll("#nights .row.night:not(.kop)")]'))throw new Error("Oude senior Nachtzicht-wrapper staat nog in de definitieve artifact.");

if((html.split("const ruimBotsendeAslabelsOp=()=>{").length-1)!==1)throw new Error("Grafiek moet exact één fontbox-botsingslaag hebben.");
const etmaalStart=html.indexOf("function etmaal("),botsingsLaag=html.indexOf("const ruimBotsendeAslabelsOp=()=>{"),etmaalEind=html.indexOf("function daglengte(",etmaalStart);
if(etmaalStart<0||botsingsLaag<=etmaalStart||etmaalEind<=botsingsLaag)throw new Error("Fontbox-botsingslaag staat niet aantoonbaar binnen de bestaande etmaal-renderer.");
const botsingsBron=html.slice(botsingsLaag,etmaalEind);
if(!botsingsBron.includes("if(!M)return;"))throw new Error("Fontbox-botsingslaag moet uitsluitend op mobiele grafieken actief zijn; desktop-uuras mag niet worden opgeschoond.");

const verwacht=verifieerServiceworkerCache(OUT,"checkpoint-50");
console.log("Definitieve checkpoint-50 artifact geverifieerd: één Nachtzicht-owner met kalendergrens en zonsopkomstgrens, scanbare maan/zichtregels, brongetrouwe maanfase, mobiel begrensde fontbox-collision cleanup en cache "+verwacht+".");
