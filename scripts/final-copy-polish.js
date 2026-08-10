/* Laatste Nederlandstalige microcopy. Alleen labels waarvan de betekenis exact
   gelijk blijft worden aangepast; brondata en classificaties blijven onaangeraakt. */
(function(root){
"use strict";
const POLLEN={
  "Pollen gras":"Graspollen",
  "Pollen berk":"Berkenpollen",
  "Pollen els":"Elzenpollen",
  "Pollen bijvoet":"Bijvoetpollen",
  "Pollen ambrosia":"Ambrosiapollen",
  "Pollen olijf":"Olijfpollen"
};
function pollenKop(tekst){const t=String(tekst||"").trim();return POLLEN[t]||t;}
function verbeterPollenKoppen(){
  document.querySelectorAll("#aq .stat .eyebrow").forEach(el=>{el.textContent=pollenKop(el.textContent);});
}
const api={pollenKop};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowFinalCopy=api;
if(typeof document==="undefined"||typeof S==="undefined"||typeof lucht!=="function")return;
const basisLucht=lucht;
lucht=function(){basisLucht();verbeterPollenKoppen();};
})(typeof globalThis!=="undefined"?globalThis:this);
