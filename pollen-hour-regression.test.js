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
function context(airUur,grass=250,lat=52.37,lon=4.90){
  const {api,bak,doc}=laadKern(390);
  /* kern.js ondersteunt selectors op geparste elementen volledig, maar de
     generieke documentmock retourneert voor querySelectorAll bewust een lege
     lijst. Routeer hier alleen de echte #aq-selector van de productiewrapper
     naar hetzelfde geparste AQ-element. Zo draait api.lucht() inclusief alle
     definitieve wrappers in plaats van alleen de basisrenderer. */
  const basisQuerySelectorAll=doc.querySelectorAll.bind(doc);
  doc.querySelectorAll=sel=>sel==="#aq .stat"?bak.aq.querySelectorAll(".stat"):basisQuerySelectorAll(sel);
  Object.assign(api.S,{
    lat,lon,label:"PollenTest",op:Date.now(),dag:null,
    d:{current:{time:"2026-08-13T12:00"},daily:{time:["2026-08-13"],sunshine_duration:[18000]}},
    air:{current:{european_aqi:22,us_aqi:45},hourly:{time:[airUur],alder_pollen:[0],birch_pollen:[0],grass_pollen:[grass],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}
  });
  api.lucht();
  const stats=bak.aq.querySelectorAll(".stat").map(stat=>{
    const kop=stat.querySelector(".eyebrow"),val=stat.querySelector(".sval"),sub=stat.querySelector(".ssub");
    return {kop:kop?String(kop.textContent||"").trim():"",val:val?String(val.textContent||"").trim():"",sub:sub?String(sub.textContent||"").trim():""};
  });
  return stats;
}
const vind=(stats,kop)=>stats.find(x=>x.kop===kop);

const mismatch=context("2026-08-13T00:00");
const mismatchPollen=vind(mismatch,"Pollen");
assert(mismatchPollen,mismatch);
assert.equal(mismatchPollen.sub,"Pollendata voor het huidige uur niet beschikbaar");
assert(!mismatch.some(x=>/250/.test(x.val)),"mismatch mag geen 00:00-pollen als actuele waarde tonen: "+JSON.stringify(mismatch));

const gelijk=context("2026-08-13T12:00",250);
const gras=vind(gelijk,"Graspollen");
assert(gras,"exact uur moet een gras-pollenrij tonen: "+JSON.stringify(gelijk));
assert(/250/.test(gras.val),"exact uur moet echte pollenwaarde blijven tonen: "+JSON.stringify(gras));
assert.equal(gras.sub,"Verwacht voor dit uur");
assert(!/^(?:laag|matig|hoog|zeer hoog)$/.test(gras.sub),"productie mag geen universele pollen-ernstcategorie tonen: "+JSON.stringify(gras));

const klein=context("2026-08-13T12:00",0.4);
const kleinGras=vind(klein,"Graspollen");
assert(kleinGras,"positieve sub-1 pollenwaarde moet een rij houden: "+JSON.stringify(klein));
assert(/(?:&lt;|<)1/.test(kleinGras.val),"positieve sub-1 pollenwaarde mag niet als nul worden getoond: "+JSON.stringify(kleinGras));
assert(kleinGras.val.includes("korrel/m³"),"sub-1 pollen gebruikt de enkelvoudige eenheid: "+JSON.stringify(kleinGras));
assert.equal(kleinGras.sub,"Verwacht voor dit uur");

const nul=context("2026-08-13T12:00",0);
const nulPollen=vind(nul,"Pollen");
assert(nulPollen,nul);
assert.equal(nulPollen.sub,"Geen pollen verwacht voor dit uur");

/* CAMS Regional Europe dekt 25W–45E / 30N–72N. De oude appgrens eindigde al
   bij 71,5N en begon bij 29,5N. Toets de zichtbare modelkeuze op en rond beide
   breedtegrenzen, niet alleen de bronstring. */
const noord=context("2026-08-13T12:00",250,71.7,20);
assert.equal(vind(noord,"Luchtkwaliteit").sub,"redelijk · Europese AQI","71,7N ligt binnen CAMS Europe: "+JSON.stringify(noord));
assert(vind(noord,"Graspollen"),"71,7N moet Europese pollendata kunnen tonen: "+JSON.stringify(noord));

const noordRand=context("2026-08-13T12:00",250,72,20);
assert.equal(vind(noordRand,"Luchtkwaliteit").sub,"redelijk · Europese AQI","72N is de gedocumenteerde noordgrens");
assert(vind(noordRand,"Graspollen"),"72N moet binnen de CAMS-dekking blijven");

const noordBuiten=context("2026-08-13T12:00",250,72.01,20);
assert.equal(vind(noordBuiten,"Luchtkwaliteit").sub,"goed · Amerikaanse AQI","boven 72N moet de globale AQI worden gebruikt");
assert.equal(vind(noordBuiten,"Pollen").sub,"Alleen beschikbaar in Europa","boven 72N mag Europese pollenfixture niet worden getoond");

const zuidRand=context("2026-08-13T12:00",250,30,20);
assert.equal(vind(zuidRand,"Luchtkwaliteit").sub,"redelijk · Europese AQI","30N is de gedocumenteerde zuidgrens");
assert(vind(zuidRand,"Graspollen"),"30N moet binnen de CAMS-dekking blijven");

const zuidBuiten=context("2026-08-13T12:00",250,29.99,20);
assert.equal(vind(zuidBuiten,"Luchtkwaliteit").sub,"goed · Amerikaanse AQI","onder 30N moet de globale AQI worden gebruikt");
assert.equal(vind(zuidBuiten,"Pollen").sub,"Alleen beschikbaar in Europa","onder 30N mag Europese pollenfixture niet worden getoond");

console.log("Lucht/pollenregressie: CAMS-Europe-randen, uurmismatch, exact uur, natuurlijke kop en sub-1 concentraties blijven correct zichtbaar.");
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
