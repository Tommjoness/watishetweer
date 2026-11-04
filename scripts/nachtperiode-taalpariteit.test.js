"use strict";

/* Nachtzicht-periodezinnen: elke zin die de bron kan maken heeft een Engelse vertaling.
   Bron: scripts/mobile-screenshot-polish.js (corrigeerNachtVensterBron) en senior-semantiek-20260810.js (nachtVensterMetHorizon).
   Vertaling: taal/en.js. Eerder ontbrak de Engelse vertaling voor combinaties van dagdelen buiten de gewone nacht
   (bijvoorbeeld "van de middag tot de avond" of "van de ochtend tot de nacht", mogelijk in poolgebieden en bij lange vensters). */

const assert=require("assert");
const kern=require("../taal/vertaalkern.js"),woordenboek=require("../taal/en.js");
const vertaler=kern.maakVertaler(woordenboek);
const polish=require("./mobile-screenshot-polish.js");
const senior=require("../senior-semantiek-20260810.js");

const DAGDELEN=["nacht","vroege ochtend","ochtend","middag","avond"];
const EN={nacht:"night","vroege ochtend":"early morning",ochtend:"morning",middag:"afternoon",avond:"evening"};
const VOORVOEGSEL={"Beste":"Best period","Relatief beste":"Best available period","Waarschijnlijk beste":"Likely best period"};
let n=0;

/* 1. Alle combinaties van voorvoegsel en dagdelen met de exacte verwachte vertaling. */
for(const [voor,en] of Object.entries(VOORVOEGSEL)){
  for(const a of DAGDELEN){
    const enkel=vertaler.vertaal(`${voor} periode in de ${a}.`);
    assert.equal(enkel,`${en} ${a==="nacht"?"during the night":a==="vroege ochtend"?"in the early morning":"in the "+EN[a]}.`,`${voor} in de ${a}`);n++;
    for(const b of DAGDELEN){
      if(a===b)continue;
      const verwacht=`${en}: ${a==="nacht"?"overnight":"from the "+EN[a]} into the ${EN[b]}.`;
      assert.equal(vertaler.vertaal(`${voor} periode van de ${a} tot de ${b}.`),verwacht,`${voor} van de ${a} tot de ${b}`);n++;
    }
  }
}

/* 2. Dezelfde dagdelen aan beide kanten komt niet als "van … tot" voor en wordt niet verzonnen. */
for(const a of DAGDELEN){assert.equal(vertaler.vertaal(`Beste periode van de ${a} tot de ${a}.`),null,`geen vertaling voor gelijke dagdelen ${a}`);n++;}

/* 3. Alles wat de bron daadwerkelijk kan opleveren (alle begin- en eindtijden per uur, drie horizons, hoge en lage score)
      moet vertaalbaar zijn en mag geen Nederlandse woorden achterlaten. */
const uren=[];for(let h=0;h<24;h++)uren.push(String(h).padStart(2,"0")+":00");
const bronZinnen=new Set();
for(const s of uren)for(const e of uren){
  if(s===e)continue;
  for(const [horizon,score] of [[3,7],[3,2],[4,7],[5,7],[5,2],[6,2]]){
    for(const zonsopkomst of ["06:25","04:10","08:40"]){
      const z=polish.corrigeerNachtVensterBron(`Beste periode ${s}–${e}`,horizon,score,{zonsopkomst});
      if(/periode (in|van) de /.test(z))bronZinnen.add(z);
    }
  }
  const z2=senior.nachtVensterMetHorizon(`Beste periode ${s}–${e}`,5);
  if(/periode (in|van) de /.test(z2))bronZinnen.add(z2);
}
assert(bronZinnen.size>=40,"bron levert onverwacht weinig dagdeelzinnen: "+bronZinnen.size);n++;
for(const z of bronZinnen){
  /* nachtVensterMetHorizon geeft de zin zonder eindpunt; de pagina voegt dat toe. Beide vormen moeten vertaald kunnen worden. */
  const metPunt=/\.$/.test(z)?z:z+".";
  const en=vertaler.vertaal(metPunt);
  assert(en&&en!==metPunt,"geen Engelse vertaling voor: "+metPunt);
  assert(!/\b(periode|van de|tot de|nacht|ochtend|middag|avond|beste|relatief|waarschijnlijk)\b/i.test(en.replace(/\b(overnight|night|morning|afternoon|evening)\b/gi,"")),"Nederlandse rest in: "+en);
  n++;
}
console.log(`Nachtzicht-periodezinnen NL→EN: ${n} controles geslaagd (${bronZinnen.size} verschillende bronzinnen).`);
