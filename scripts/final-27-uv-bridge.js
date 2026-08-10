/* Brug tussen de finale polish en de bestaande UV-consumentensemantiek.
   De lokale uvOordeel-functie uit meters() is niet globaal zichtbaar. Deze laag
   gebruikt exact dezelfde grenzen op exact dezelfde ZICHTBARE, afgeronde waarde,
   zodat bijvoorbeeld 5,9 -> 6 zowel als getal als 'hoog' wordt gepresenteerd.
   Tijdsvorm wordt in een aparte gecontroleerde ronde aangepast zodra de
   browserverwachting daarvoor expliciet is bijgewerkt. */
(function(root){
"use strict";
function getal(v){return v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;}
function zichtbareUv(v){const n=getal(v);return n===null?null:Math.max(0,Math.round(n));}
function uvOordeel(v){
  const n=getal(v);if(n===null)return "";
  return n<3?"laag":n<6?"matig":n<8?"hoog":n<11?"zeer hoog":"extreem";
}
function uvOordeelVoorBron(v){const n=zichtbareUv(v);return n===null?"":uvOordeel(n);}
const api={zichtbareUv,uvOordeel,uvOordeelVoorBron};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowUvBridge=api;
if(typeof document==="undefined"||typeof S==="undefined"||typeof meters!=="function")return;
const basisMeters=meters;
meters=function(){
  basisMeters();
  const pu=typeof piek==="function"?piek("uv_index"):null;
  const uvsub=document.getElementById("uvsub");
  if(!pu||!uvsub||!Number.isFinite(Number(pu.v))||Number(pu.v)<0)return;
  const zichtbaar=zichtbareUv(pu.v);
  if(zichtbaar===null)return;
  if(zichtbaar<1){uvsub.textContent="Nauwelijks UV vandaag.";return;}
  uvsub.textContent="Rond "+String(pu.t||"").slice(11,16)+" · "+uvOordeel(zichtbaar)+".";
};
})(typeof globalThis!=="undefined"?globalThis:this);
