"use strict";

const fs=require("fs");
const path=require("path");
const root=path.join(__dirname,"..");
const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
const q4=fs.readFileSync(path.join(__dirname,"q4-rain-runtime.js"),"utf8");

const fouten=[];
const eis=(ok,naam)=>{if(!ok)fouten.push(naam);};

/* Deze test is expres gedrag-/contractgericht: hij legt de zichtbare problemen
   uit de wereldwijde previewronde vast vóórdat de presentatielaag wordt aangepast. */
eis(!/\.waarsch h3\{[^}]*color:var\(--carmine\)/.test(index),
  "waarschuwingstitels mogen niet standaard rood zijn");
eis(!/dagAanduiding\(pg\.t,true\)\+\" maximaal \"/.test(index),
  "verstreken model-windstoot mag niet als kale 'maximaal'-zin worden gepresenteerd");
eis(!/<div class=\"bar\"><\/div><div class=\"dmax\">/.test(index),
  "temperatuurbalk in de zevendagentabel moet een zichtbare betekenis/kop hebben");
eis(!/dcond[^\n]*nl\(som\)[^\n]*mm/.test(index),
  "dagomschrijving mag neerslaghoeveelheid niet dupliceren naast de neerslagkolom");
eis(!/const woord = uur<2 \? \"Weinig zon vandaag\"[\s\S]*\"Vandaag redelijk wat zon\"/.test(index),
  "zonurentekst moet rekening houden met het beschikbare daglicht, niet alleen absolute uren");
eis(q4.includes("data-ui-rain-period-probability"),
  "regenperiode moet één zichtbare kanssamenvatting per periode hebben");

if(fouten.length){
  console.error("UI-polish regressies nog aanwezig:\n- "+fouten.join("\n- "));
  process.exit(1);
}
console.log("UI-polish regressiecontract groen.");
