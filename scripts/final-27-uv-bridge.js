/* Brug tussen de finale polish en de bestaande UV-consumentensemantiek.
   Het zichtbare afgeronde getal bepaalt ook de categorie. Daarnaast benoemt de
   tekst nu eerlijk of de dagpiek nog komt of al voorbij is. */
(function(root){
"use strict";
function getal(v){return v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;}
function zichtbareUv(v){const n=getal(v);return n===null?null:Math.max(0,Math.round(n));}
function uvOordeel(v){
  const n=getal(v);if(n===null)return "";
  return n<3?"laag":n<6?"matig":n<8?"hoog":n<11?"zeer hoog":"extreem";
}
function uvOordeelVoorBron(v){const n=zichtbareUv(v);return n===null?"":uvOordeel(n);}
function uvTekst(piekTijd,bronWaarde,nuTijd){
  const zichtbaar=zichtbareUv(bronWaarde);
  if(zichtbaar===null||!piekTijd)return "";
  if(zichtbaar<1)return "Nauwelijks UV vandaag.";
  const tijd=String(piekTijd).slice(11,16);
  const voorbij=String(piekTijd).slice(0,16)<=String(nuTijd||"").slice(0,16);
  return (voorbij?"Piekte rond ":"Piek rond ")+tijd+" · "+uvOordeel(zichtbaar)+".";
}
const api={zichtbareUv,uvOordeel,uvOordeelVoorBron,uvTekst};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowUvBridge=api;
if(typeof document==="undefined"||typeof S==="undefined"||typeof meters!=="function")return;
const basisMeters=meters;
meters=function(){
  basisMeters();
  const pu=typeof piek==="function"?piek("uv_index"):null;
  const uvsub=document.getElementById("uvsub");
  if(!pu||!uvsub)return;
  const nu=typeof weatherNowActueleLokaleTijd==="function"?weatherNowActueleLokaleTijd():(S.d&&S.d.current&&S.d.current.time);
  const tekst=uvTekst(pu.t,pu.v,nu);
  if(tekst)uvsub.textContent=tekst;
};
})(typeof globalThis!=="undefined"?globalThis:this);
