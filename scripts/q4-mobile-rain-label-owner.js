"use strict";

/* De 24-uursregenlaag kan op desktop brede perioden als twee losse eindlabels
   tonen (bijv. 16:00 … 18:00). Op mobiel levert dat naast de gewone tijdas te
   veel losse klokteksten op. De Q4-runtime kent de mobiele geometrie al via g.M;
   daar kiezen we daarom altijd de bestaande compacte rangevariant. Hoeveelheid,
   bracket, bronindices en toegankelijke tijdvakbeschrijving blijven ongewijzigd. */
const SPLIT_BRON="    if(span>=splitMin){";
const SPLIT_PRODUCTIE="    if(!g.M&&span>=splitMin){";

function pasQ4MobieleRegenlabelsToe(runtime){
  const bron=String(runtime||"");
  if(bron.includes(SPLIT_PRODUCTIE))throw new Error("Q4 mobiele regenlabel-owner staat al in de runtime.");
  const n=bron.split(SPLIT_BRON).length-1;
  if(n!==1)throw new Error("Q4 splitlabel-anker ontbreekt of is dubbel: "+n);
  return bron.replace(SPLIT_BRON,SPLIT_PRODUCTIE);
}

module.exports=Object.freeze({SPLIT_BRON,SPLIT_PRODUCTIE,pasQ4MobieleRegenlabelsToe});
