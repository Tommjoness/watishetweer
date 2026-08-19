"use strict";

/* Luchtdrukpresentatie heeft één inhoudelijke owner in de base-build. De
   berekening van de actuele druk en de drie-uursdelta blijft volledig in de
   bestaande meters()-renderer; deze owner verandert uitsluitend de twee
   zichtbare zinnen die UI-polish tot nu toe achteraf herschreef. */
const CONTRACTEN=Object.freeze([
  Object.freeze({
    label:"lichte luchtdruktendens",
    bron:'    : Math.abs(dp)<2 ? "Licht "+(dp>0?"gestegen":"gedaald")+" in de afgelopen drie uur."',
    productie:'    : Math.abs(dp)<2 ? "De luchtdruk is in de afgelopen drie uur licht "+(dp>0?"gestegen":"gedaald")+"."'
  }),
  Object.freeze({
    label:"duidelijke luchtdruktendens",
    bron:'    : "In de afgelopen drie uur "+nl(Math.abs(dp))+" hPa "+(dp>0?"gestegen":"gedaald")+".");',
    productie:'    : "De luchtdruk is in de afgelopen drie uur "+nl(Math.abs(dp))+" hPa "+(dp>0?"gestegen":"gedaald")+".");'
  })
]);

function pasPressureCopyToe(html){
  let bron=String(html||"");
  for(const contract of CONTRACTEN){
    const aantal=bron.split(contract.bron).length-1;
    if(aantal!==1)throw new Error(contract.label+" bronanker ontbreekt of is dubbel: "+aantal);
    bron=bron.replace(contract.bron,contract.productie);
  }
  for(const contract of CONTRACTEN){
    if((bron.split(contract.productie).length-1)!==1)throw new Error(contract.label+" productiecontract ontbreekt of is dubbel na base-build.");
  }
  return bron;
}

module.exports=Object.freeze({CONTRACTEN,pasPressureCopyToe});
