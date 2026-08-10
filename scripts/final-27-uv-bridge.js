/* Brug tussen de finale polish en de bestaande UV-consumentensemantiek.
   De lokale uvOordeel-functie uit meters() is niet globaal zichtbaar. Deze laag
   gebruikt exact dezelfde grenzen, zodat de zichtbare afgeronde piekwaarde en
   het oordeel nooit uit elkaar lopen. Tijdsvorm wordt in een aparte gecontroleerde
   ronde aangepast zodra de browserverwachting daarvoor is bijgewerkt. */
(function(root){
"use strict";
function getal(v){return v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;}
function uvOordeel(v){
  const n=getal(v);if(n===null)return "";
  return n<3?"laag":n<6?"matig":n<8?"hoog":n<11?"zeer hoog":"extreem";
}
const api={uvOordeel};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowUvBridge=api;
if(typeof document==="undefined"||typeof S==="undefined"||typeof meters!=="function")return;
const basisMeters=meters;
meters=function(){
  basisMeters();
  const pu=typeof piek==="function"?piek("uv_index"):null;
  const uvsub=document.getElementById("uvsub");
  if(!pu||!uvsub||!Number.isFinite(Number(pu.v))||Number(pu.v)<0)return;
  if(Number(pu.v)<0.5){uvsub.textContent="Nauwelijks UV vandaag.";return;}
  uvsub.textContent="Rond "+String(pu.t||"").slice(11,16)+" · "+uvOordeel(pu.v)+".";
};
})(typeof globalThis!=="undefined"?globalThis:this);
