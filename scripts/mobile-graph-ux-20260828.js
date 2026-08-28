/* Mobiele grafiek- en informatie-UX 2026-08-28.
   Deze laag verandert geen providerwaarden of weersformules. Hij herstelt alleen
   ontbrekende uurcontext na de bestaande Safari-collisionlaag en maakt bestaande
   UI-semantiek explicieter. */
(function(root){
"use strict";

const SVG_NS="http://www.w3.org/2000/svg";
const NWS_LANDEN=new Set(["US","PR","VI","GU","MP","AS"]);
const METEOALARM_LANDEN=new Set(["AD","AT","BE","BA","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IS","IE","IL","IT","LV","LT","LU","MT","MD","ME","NL","MK","NO","PL","PT","RO","RS","SK","SI","ES","SE","CH","UA","GB"]);

function uurUitIso(tijd){
  const m=/T(\d{2}):/.exec(String(tijd||""));
  return m?Number(m[1]):null;
}
function kiesUurLabelIndices(tijden,minimaal=4){
  const T=Array.isArray(tijden)?tijden:[],min=Math.max(1,Math.floor(Number(minimaal)||4));
  if(T.length<3)return [];
  let basis=T.map((tijd,i)=>({i,uur:uurUitIso(tijd)}))
    .filter(x=>x.i>=2&&x.i<=T.length-3&&Number.isInteger(x.uur)&&x.uur%3===0)
    .map(x=>x.i);
  if(basis.length<min)basis=T.map((_,i)=>i).filter(i=>i>=2&&i<=T.length-3);
  if(basis.length<=min)return basis;
  const uit=[];
  for(let k=0;k<min;k++){
    const pos=Math.round(k*(basis.length-1)/(min-1));
    const i=basis[pos];if(!uit.includes(i))uit.push(i);
  }
  return uit;
}
function isUurAsLabel(tekst,y,plotOnder,fontFamilie){
  const t=String(tekst||"").trim(),py=Number(y),onder=Number(plotOnder),font=String(fontFamilie||"");
  return /^(?:[01]?\d|2[0-3])$/.test(t)&&Number.isFinite(py)&&Number.isFinite(onder)&&py>=onder+6&&!/Bodoni/i.test(font);
}
function waarschuwingBronnenVoorLand(land){
  const code=String(land||"").trim().toUpperCase();
  return {nws:NWS_LANDEN.has(code),meteoalarm:METEOALARM_LANDEN.has(code)};
}
function neerslagSleutelTekst(waarde,subtekst){
  const t=String(waarde||"").replace(/\s+/g," ").trim(),sub=String(subtekst||"").toLowerCase();
  if(!/%/.test(t))return "";
  if(/\bmm\b/i.test(t))return "kans · verwachte hoeveelheid";
  if(/onzeker|onvoldoende|niet beschikbaar|geen betrouwbare/i.test(sub))return "kans · hoeveelheid onzeker";
  return "kans";
}

const api={uurUitIso,kiesUurLabelIndices,isUurAsLabel,waarschuwingBronnenVoorLand,neerslagSleutelTekst};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowMobileGraphUX20260828=api;

if(typeof document==="undefined"||typeof window==="undefined"||typeof S==="undefined")return;
const mobiel=()=>typeof window.matchMedia==="function"?window.matchMedia("(max-width:900px)").matches:window.innerWidth<=900;

function bestaandeUurLabels(svg,g){
  const plotOnder=Number(g&&g.pt)+Number(g&&g.ih);
  return svg?[...svg.querySelectorAll("text")].filter(el=>{
    if(el.closest&&el.closest('g[data-q4-rain-periods]'))return false;
    return isUurAsLabel(el.textContent,el.getAttribute("y"),plotOnder,el.getAttribute("font-family"));
  }):[];
}
function herstelUurAs(){
  if(!mobiel())return;
  const svg=document.getElementById("chart"),g=S.geo;
  if(!svg||!g||Number(g.n)>48||!Array.isArray(g.TI)||typeof g.x!=="function")return;
  const minimum=4,alle=bestaandeUurLabels(svg,g),fallback=alle.filter(el=>el.hasAttribute("data-mobile-hour-axis")),canoniek=alle.filter(el=>!el.hasAttribute("data-mobile-hour-axis"));
  /* Zodra de gewone as later alsnog verschijnt, ruimt deze vangnetlaag haar
     eigen labels weer op. Zo kan een late Safari-layout nooit dubbele tijden
     achterlaten. */
  if(canoniek.length>=minimum){fallback.forEach(el=>el.remove());return;}
  if(alle.length>=minimum)return;
  const posities=alle.map(el=>Number(el.getAttribute("x"))).filter(Number.isFinite);
  const y=Number(g.pt)+Number(g.ih)+20;
  if(!Number.isFinite(y))return;
  const kleur=getComputedStyle(document.documentElement).getPropertyValue("--ink-45").trim()||"currentColor";
  for(const i of kiesUurLabelIndices(g.TI,Math.max(minimum,6))){
    if(bestaandeUurLabels(svg,g).length>=minimum)break;
    const x=Number(g.x(i)),uur=uurUitIso(g.TI[i]);
    if(!Number.isFinite(x)||!Number.isInteger(uur)||posities.some(p=>Math.abs(p-x)<18))continue;
    const el=document.createElementNS(SVG_NS,"text");
    el.setAttribute("x",String(x));el.setAttribute("y",String(y));
    el.setAttribute("text-anchor","middle");el.setAttribute("fill",kleur);
    el.setAttribute("font-family","DM Mono,monospace");el.setAttribute("font-size","8.5");
    el.setAttribute("data-mobile-hour-axis","1");el.textContent=String(uur).padStart(2,"0");
    const regen=svg.querySelector('g[data-q4-rain-periods]'),scrub=svg.querySelector("#scrub");
    svg.insertBefore(el,regen||scrub||null);posities.push(x);
  }
}
let uurAsToken=0;
function planUurAsHerstel(){
  const token=++uurAsToken;
  const voer=()=>{if(token===uurAsToken)herstelUurAs();};
  const start=()=>{
    const r1=()=>{const r2=()=>voer();if(typeof requestAnimationFrame==="function")requestAnimationFrame(r2);else setTimeout(r2,0);};
    if(typeof requestAnimationFrame==="function")requestAnimationFrame(r1);else setTimeout(r1,0);
    /* Bounded retries vangen de Safari-volgorde af waarin fonts, SVG-viewBox en
       collisionpolish niet in dezelfde frame klaar zijn. De token voorkomt dat
       een oudere render nog labels toevoegt nadat de gebruiker van dag wisselt. */
    setTimeout(voer,120);setTimeout(voer,350);
  };
  const fonts=document.fonts&&document.fonts.ready;
  if(fonts&&typeof fonts.then==="function")fonts.then(start).catch(start);else start();
}

function werkNeerslagSleutelBij(){
  const waarde=document.getElementById("pop"),stat=waarde&&waarde.closest(".stat"),sleutel=stat&&stat.querySelector(".mobile-neerslag-sleutel"),sub=document.getElementById("popsub");
  if(!waarde||!sleutel)return;
  const tekst=neerslagSleutelTekst(waarde.textContent,sub&&sub.textContent),zichtbaar=String(waarde.textContent||"").replace(/\s+/g," ").trim();
  sleutel.textContent=tekst;sleutel.hidden=!tekst;
  if(/%/.test(zichtbaar)&&!/\bmm\b/i.test(zichtbaar)){
    const pct=(zichtbaar.match(/\d+\s*%/)||[])[0]||zichtbaar;
    waarde.setAttribute("aria-label",tekst.includes("onzeker")?"Komend uur: "+pct+" kans. De verwachte hoeveelheid is onzeker.":"Komend uur: "+pct+" kans.");
  }
}
function werkBronnenBij(){
  const bron=document.querySelector("footer .bron-bronnen");if(!bron)return;
  const label=bron.querySelector(".bronlabel");if(label)label.textContent="Bronnen voor deze weergave";
  const keuze=waarschuwingBronnenVoorLand(S.land);
  [...bron.querySelectorAll(".bronitem")].forEach(item=>{
    const naam=String(item.textContent||"").trim();
    if(naam==="MeteoAlarm")item.hidden=!keuze.meteoalarm;
    else if(naam==="National Weather Service")item.hidden=!keuze.nws;
  });
}
function werkMobieleContextBij(){werkNeerslagSleutelBij();werkBronnenBij();}

if(typeof etmaal==="function"){
  const grafiekBasisMobieleUX=etmaal;
  etmaal=function(){const r=grafiekBasisMobieleUX.apply(this,arguments);planUurAsHerstel();return r;};
}
if(typeof meters==="function"){
  const metersBasisMobieleUX=meters;
  meters=function(){const r=metersBasisMobieleUX.apply(this,arguments);werkNeerslagSleutelBij();werkBronnenBij();return r;};
}
if(typeof lucht==="function"){
  const luchtBasisMobieleUX=lucht;
  lucht=function(){const r=luchtBasisMobieleUX.apply(this,arguments);werkBronnenBij();return r;};
}
werkMobieleContextBij();planUurAsHerstel();

})(typeof globalThis!=="undefined"?globalThis:this);
