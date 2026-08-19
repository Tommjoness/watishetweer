"use strict";

const vm=require("vm");

const MARK="/* ===== POLLEN-UUR CORRECTHEID 20260813 ===== */";
const CONTRACTEN=Object.freeze([
  Object.freeze({label:"CAMS-Europe-dekking",bron:"const inEuropa=(lat,lon)=>lat>29.5&&lat<71.5&&lon>-25&&lon<45;",productie:"const inEuropa=(lat,lon)=>lat>=30&&lat<=72&&lon>=-25&&lon<=45;"}),
  Object.freeze({label:"onveilige pollen-uurfallback",bron:"    if(i<0)i=0;",productie:"    if(i<0)i=null;"}),
  Object.freeze({label:"pollen-mismatchtekst",bron:'(gemeten?"Geen noemenswaardige concentraties":"Geen pollendata voor deze locatie")',productie:'(gemeten?"Geen noemenswaardige concentraties":i===null?"Pollendata voor het huidige uur niet beschikbaar":"Geen pollendata voor deze locatie")'}),
  Object.freeze({label:"positieve sub-1 pollenpresentatie",bron:'${Math.round(o.v)}<s>korrels/m³</s>',productie:'${o.v<1?"&lt;1":Math.round(o.v)}<s>${o.v<1||Math.round(o.v)===1?"korrel/m³":"korrels/m³"}</s>'})
]);

function pasPollenHourCorrectnessToe(html){
  let bron=String(html||"");
  if(bron.includes(MARK))throw new Error("Pollen-uurcorrectie is al toegepast.");
  for(const contract of CONTRACTEN){
    const aantal=bron.split(contract.bron).length-1;
    if(aantal!==1)throw new Error(contract.label+" ontbreekt of is dubbel: "+aantal);
    if(bron.includes(contract.productie))throw new Error(contract.label+" staat al in productie-vorm vóór de canonieke owner.");
    bron=bron.replace(contract.bron,contract.productie);
  }
  if((bron.match(/<\/style>/g)||[]).length!==1)throw new Error("Exact één stijlblok vereist voor pollen-uurcorrectheid.");
  bron=bron.replace("</style>","\n"+MARK+"\n</style>");
  const scripts=[...bron.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  if(!scripts.length)throw new Error("Geen inline runtime na pollen-uurcorrectie.");
  scripts.forEach((code,i)=>new vm.Script(code,{filename:"pollen-hour-owner:inline-"+(i+1)}));
  return bron;
}

module.exports={MARK,CONTRACTEN,pasPollenHourCorrectnessToe};
