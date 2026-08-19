"use strict";

const fs=require("fs");
const path=require("path");
const {MARK,CONTRACTEN}=require("./pollen-hour-correctness.js");

const ROOT=path.join(__dirname,"..");
const htmlPad=path.join(ROOT,"public","index.html");
const ownerPad=path.join(__dirname,"pollen-hour-correctness.js");
const oudeApplyPad=path.join(__dirname,"apply-pollen-hour-correctness.js");
const buildPad=path.join(ROOT,"build-weather.js");
for(const p of [htmlPad,ownerPad,buildPad])if(!fs.existsSync(p))throw new Error("Pollen-artifact of owner ontbreekt: "+path.basename(p));
if(fs.existsSync(oudeApplyPad))throw new Error("Late pollen-mutator bestaat nog; pollen-uurcorrectheid hoort bij de base-build.");

const html=fs.readFileSync(htmlPad,"utf8");
const owner=fs.readFileSync(ownerPad,"utf8");
const build=fs.readFileSync(buildPad,"utf8");

if(!build.includes('require("./scripts/pollen-hour-correctness.js")')||!build.includes("html=pasPollenHourCorrectnessToe(html);"))throw new Error("Base-build bezit pollen-uurcorrectheid niet aantoonbaar.");
if(!owner.includes("function pasPollenHourCorrectnessToe(html)")||!owner.includes("const CONTRACTEN=Object.freeze(["))throw new Error("Pure pollen-owner bevat het canonieke transformatiecontract niet aantoonbaar.");
for(const verboden of ["public/index.html","writeFileSync","vernieuwServiceworkerCache"]){
  if(owner.includes(verboden))throw new Error("Pure pollen-owner bevat nog late artifactmutatie-infrastructuur: "+verboden);
}

if(html.split(MARK).length-1!==1)throw new Error("Pollen-owner marker moet exact één keer in het finale artifact staan.");
if(!Array.isArray(CONTRACTEN)||CONTRACTEN.length!==4)throw new Error("Pollen-owner moet exact vier bevroren bron→productiecontracten bevatten.");
for(const contract of CONTRACTEN){
  if(typeof contract.bron!=="string"||typeof contract.productie!=="string"||!contract.label)throw new Error("Ongeldig pollen-ownercontract.");
  if(html.includes(contract.bron))throw new Error("Verouderde pollenbron staat nog in het finale artifact: "+contract.label);
  if(html.split(contract.productie).length-1!==1)throw new Error("Pollenproductieregel ontbreekt of is dubbel in finale artifact: "+contract.label);
}

for(const tekst of [
  "const inEuropa=(lat,lon)=>lat>=30&&lat<=72&&lon>=-25&&lon<=45;",
  "if(i<0)i=null;",
  "Pollendata voor het huidige uur niet beschikbaar",
  'o.v<1?"&lt;1":Math.round(o.v)',
  'o.v<1||Math.round(o.v)===1?"korrel/m³":"korrels/m³"'
]){
  if(!html.includes(tekst))throw new Error("Bevroren pollenproductgedrag ontbreekt: "+tekst);
}

console.log("Lucht/pollenartifact geverifieerd: pure owner draait in de base-build; CAMS-dekking, uurmismatch en sub-1 presentatie behouden exact het bestaande productiecontract.");
