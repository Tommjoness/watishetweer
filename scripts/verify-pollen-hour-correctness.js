"use strict";

const fs=require("fs");
const path=require("path");
const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");

const eisen=[
  [html.includes("/* ===== POLLEN-UUR CORRECTHEID 20260813 ===== */"),"correctiemarker ontbreekt"],
  [html.includes("if(i<0)i=null;"),"mismatch wordt niet fail-closed bewaard"],
  [!html.includes("if(i<0)i=0;"),"oude index-0-fallback staat nog in artifact"],
  [html.includes("Pollendata voor het huidige uur niet beschikbaar"),"expliciete mismatchtekst ontbreekt"]
];
for(const [ok,msg] of eisen)if(!ok)throw new Error(msg);
console.log("Pollen-uurartifact geverifieerd: geen willekeurige index-0-fallback.");
