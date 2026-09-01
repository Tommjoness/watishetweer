"use strict";

const fs=require("fs");
const path=require("path");
const OUT=path.join(__dirname,"..","public");
const MARKER="/* ===== FINAL GLOBAL CORRECTNESS 20260901 ===== */";

function htmls(dir){
  const uit=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);if(e.isDirectory())uit.push(...htmls(p));else if(e.isFile()&&e.name==="index.html")uit.push(p);
  }return uit;
}
let weer=0;
for(const p of htmls(OUT)){
  const s=fs.readFileSync(p,"utf8");if(!s.includes("WeatherNowGlobalLocationHardening"))continue;weer++;
  const rel=path.relative(OUT,p)||"index.html";
  const eisen=[
    [s.includes(MARKER),"finale correctheidsmarker"],
    [s.includes("WeatherNowFinalGlobalCorrectness"),"centrale pure policy"],
    [s.includes('id="modelrisico" role="note" hidden'),"gescheiden modelsignaal"],
    [s.includes("Luchtdruk op zeeniveau"),"expliciete zeeniveaudruk"],
    [!s.includes('return "id:"+String(r.id).trim();'),"geen provider-ID als primaire zoeksleutel"],
    [s.includes("const horizon=Math.max(h,nachtHorizonIndex(rij.dataset&&rij.dataset.d,h))"),"zichtbare Nachtzicht-rijpositie is ondergrens van de horizon"],
    [s.includes("rij.dataset.d=String(horizon)"),"herstelde Nachtzicht-horizon wordt teruggeschreven voor latere owners"],
    [s.includes("nuDatumTijd:nuLokaal"),"volledige lokale datetime voor Nachtzicht"],
    [s.includes("nachtDatum:Array.isArray(day.time)?day.time[horizon]:null"),"kalendernacht voor Nachtzicht"],
    [s.includes("const beleid=globalThis.WeatherNowFinalGlobalCorrectness;"),"Nachtzicht-callpad ziet de centrale policy in zijn eigen scope"],
    [s.includes("beleid.nachtVensterTijdsvorm(lokaal,{horizonDagen:horizon"),"datum-/tijdpolicy draait op de uiteindelijke Nachtzicht-rijtekst"],
    [s.includes("beleid.nachtAdvies(zichtbaar,geen[1])"),"scorebewuste Nachtzichtcopy draait in hetzelfde lokale callpad"],
    [s.includes("horizonDagen:h,nuDatumTijd:opties.nuDatumTijd"),"fallback-wrapper bewaart datum-/tijdpolicy voor iedere Nachtzicht-horizon"],
    [s.includes("basisNachtVenster(tekst,1,score,{...opties,actief:false})"),"oude kloktijdowner kan via de fallback-wrapper geen toekomstige rijen markeren"],
    [s.includes("hoeveelheid onzeker"),"niet-lege hoeveelheidstoestand"],
    [s.includes("Modelgegevens, geen officiële waarschuwing."),"brononderscheid modelsignaal"],
    [s.includes("corrigeerTemperatuurDom"),"temperatuurgrammatica in zichtbare en toegankelijke tekst"]
  ];
  for(const [ok,naam] of eisen)if(!ok)throw new Error(rel+": ontbreekt: "+naam);
}
if(!weer)throw new Error("Geen weerpagina's gevonden voor finale correctheidsverificatie.");
console.log("Finale wereldwijde correctheidsartifact geverifieerd op "+weer+" weerpagina's.");
