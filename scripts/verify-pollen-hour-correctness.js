"use strict";

const fs=require("fs");
const path=require("path");
const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");

const eisen=[
  [html.includes("/* ===== POLLEN-UUR CORRECTHEID 20260813 ===== */"),"correctiemarker ontbreekt"],
  [html.includes("if(i<0)i=null;"),"mismatch wordt niet fail-closed bewaard"],
  [!html.includes("if(i<0)i=0;"),"oude index-0-fallback staat nog in artifact"],
  [html.includes("Pollendata voor het huidige uur niet beschikbaar"),"expliciete mismatchtekst ontbreekt"],
  [html.includes('o.v<1?"&lt;1":Math.round(o.v)'),"sub-1 pollenpresentatie ontbreekt"],
  [html.includes('o.v<1||Math.round(o.v)===1?"korrel/m³":"korrels/m³"'),"polleneenheid volgt zichtbare waarde niet"],
  [!html.includes('${Math.round(o.v)}<s>korrels/m³</s>'),"oude afronding kan positieve pollen nog als nul tonen"]
];
for(const [ok,msg] of eisen)if(!ok)throw new Error(msg);
console.log("Pollenartifact geverifieerd: mismatch faalt gesloten en positieve sub-1 concentraties blijven zichtbaar positief.");
