"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const PAD=path.join(OUT,"index.html");

/* Laatste presentation-consistencylaag. Deze stap introduceert geen nieuwe
   berekeningen: hij ruimt drie aantoonbare dubbele/te drukke consumenten op nadat
   hun canonieke owners al zijn geassembleerd.

   1. De oude senior-runtime overschreef de nieuwere daglichtbewuste zonurencopy.
   2. Nachtzicht kon 6/10 'Redelijk' combineren met een kaal 'Geen gunstig...'.
   3. Q4 labelt mobiel alleen de belangrijkste perioden; de aria-uitleg moet dat
      ook eerlijk zeggen, terwijl iedere bracket zijn eigen aria-label behoudt. */
const ZON_RUNTIME_OUD=`      if(kop.textContent.trim()==="Zonuren"){
        const u=Number(String(val.textContent||"").replace(",",".").replace(/[^0-9.-]/g,""));
        const tekst=zonurenOordeelGetoond(u);if(tekst)sub.textContent=tekst;
      }else if(/^Pollen\\s+/i.test(kop.textContent)){`;
const ZON_RUNTIME_NIEUW=`      if(/^Pollen\\s+/i.test(kop.textContent)){`;

const NACHT_OUD=`  if(/^Geen gunstig kijkvenster door /i.test(t))return /[.!?]$/.test(t)?t:t+".";
  if(/^Geen goed zichtvenster door /i.test(t))return t.replace(/^Geen goed zichtvenster/i,"Geen gunstig kijkvenster")+( /[.!?]$/.test(t)?"":".");`;
const NACHT_NIEUW=`  const geenVenster=/^(?:Geen gunstig kijkvenster|Geen goed zichtvenster) door (.+?)[.!?]*$/i.exec(t);
  if(geenVenster){
    const reden=geenVenster[1].trim();
    if(s!==null&&s>=5&&reden){
      const kwalificatie=s>=9?"Uitstekende":s>=7?"Goede":"Redelijke";
      return kwalificatie+" omstandigheden, maar door "+reden+" is er geen aaneengesloten gunstig kijkvenster.";
    }
    return "Geen gunstig kijkvenster door "+reden+".";
  }`;

const ARIA_OUD=`  const detailAria=g.n<=25?" Bij iedere regenperiode staat het tijdvak en de verwachte hoeveelheid.":"";`;
const ARIA_NIEUW=`  const detailAria=g.n<=25?(g.M?" De belangrijkste regenperioden zijn gelabeld; de overige blijven via de grafiekdetails beschikbaar.":" Bij iedere regenperiode staat het tijdvak en de verwachte hoeveelheid."):"";`;

function vervangExact(bron,oud,nieuw,naam){
  const n=bron.split(oud).length-1;
  if(n!==1)throw new Error(naam+"-anker ontbreekt of is dubbel: "+n);
  return bron.replace(oud,nieuw);
}

let html=fs.readFileSync(PAD,"utf8");
if(html.includes('const geenVenster=/^(?:Geen gunstig kijkvenster|Geen goed zichtvenster)'))
  throw new Error("Finale presentatieconsistentie staat al in de artifact.");
if(!html.includes("function weatherNowZonurenWoord(uur,daglichtUur){"))
  throw new Error("Canonieke daglichtbewuste zonuren-owner ontbreekt vóór finale consistentie.");
if(!html.includes("function q4MobieleGelabeldePerioden(perioden){"))
  throw new Error("Q4 mobiele betekenisselectie ontbreekt vóór finale consistentie.");

html=vervangExact(html,ZON_RUNTIME_OUD,ZON_RUNTIME_NIEUW,"legacy zonurenruntime");
html=vervangExact(html,NACHT_OUD,NACHT_NIEUW,"Nachtzicht venstercopy");
html=vervangExact(html,ARIA_OUD,ARIA_NIEUW,"Q4 aria-uitleg");

/* Syntaxcontrole vóór schrijven: de wijzigingen zitten alle drie in inline JS. */
const scripts=[...html.matchAll(/<script(?![^>]*\\ssrc=)[^>]*>([\\s\\S]*?)<\\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline scripts na finale presentatieconsistentie.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:final-presentatie-"+(i+1)}));

fs.writeFileSync(PAD,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"finale-presentatie");
console.log("Finale presentatieconsistentie toegepast: zonuren-owner hersteld, Nachtzicht genuanceerd en mobiele regen-uitleg gelijkgetrokken; cache "+versie+".");

module.exports={ZON_RUNTIME_OUD,ZON_RUNTIME_NIEUW,NACHT_OUD,NACHT_NIEUW,ARIA_OUD,ARIA_NIEUW,vervangExact};
