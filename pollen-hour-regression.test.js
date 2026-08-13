"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {spawnSync}=require("child_process");

/* Test exact de definitieve artifact via dezelfde tijdelijke bronwissel als de
   wereldmatrix. Zo bewaken we zichtbare runtime-uitvoer, niet alleen de tekst
   van de postbuildpatch. */
const bron=path.join(__dirname,"index.html");
const gebouwd=path.join(__dirname,"public","index.html");
if(!fs.existsSync(gebouwd))throw new Error("public/index.html ontbreekt voor pollen-uurregressie");
const origineel=fs.readFileSync(bron);
const testScript=`
const assert=require("assert");
const {laadKern}=require("./kern.js");
function context(airUur){
  const {api,bak}=laadKern(390);
  Object.assign(api.S,{
    lat:52.37,lon:4.90,label:"PollenTest",op:Date.now(),dag:null,
    d:{current:{time:"2026-08-13T12:00"},daily:{time:["2026-08-13"],sunshine_duration:[18000]}},
    air:{current:{european_aqi:22,us_aqi:45},hourly:{time:[airUur],alder_pollen:[0],birch_pollen:[0],grass_pollen:[250],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}
  });
  api.lucht();
  return String(bak.aq.innerHTML||"");
}
const mismatch=context("2026-08-13T00:00");
assert(/Pollendata voor het huidige uur niet beschikbaar/.test(mismatch),mismatch);
assert(!/250/.test(mismatch),"mismatch mag geen 00:00-pollen als actuele waarde tonen: "+mismatch);
const gelijk=context("2026-08-13T12:00");
assert(/250/.test(gelijk),"exact uur moet echte pollenwaarde blijven tonen: "+gelijk);
assert(!/huidige uur niet beschikbaar/.test(gelijk),gelijk);
console.log("Pollen-uurregressie: mismatch faalt gesloten en exact uur blijft zichtbaar.");
`;
let status=1;
try{
  fs.copyFileSync(gebouwd,bron);
  const r=spawnSync(process.execPath,["-e",testScript],{cwd:__dirname,stdio:"inherit",encoding:"utf8"});
  if(r.error)throw r.error;
  status=typeof r.status==="number"?r.status:1;
}finally{
  fs.writeFileSync(bron,origineel);
}
process.exit(status);
