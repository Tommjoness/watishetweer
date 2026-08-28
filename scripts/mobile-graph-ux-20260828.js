/* Grafiek-, bron- en informatie-UX 2026-08-28.
   Deze laag verandert geen providerwaarden of weersformules. Hij bewaakt alleen
   presentatiesemantiek, bronprovenance en zeldzame grafiekbotsingen. */
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
function resourceNaam(r){return String(r&&typeof r==="object"?r.name:r||"");}
function bronGebruikUitResources(resources,land,opties={}){
  const namen=(Array.isArray(resources)?resources:[]).map(resourceNaam),waarschuwing=waarschuwingBronnenVoorLand(land);
  const heeft=patroon=>namen.some(n=>patroon.test(n));
  const waarschuwingen=heeft(/\/api\/waarschuwingen(?:[?#]|$)/i);
  return {
    openmeteo:!!opties.forecastBeschikbaar||heeft(/(?:api|geocoding-api)\.open-meteo\.com/i),
    cams:!!opties.airBeschikbaar||heeft(/air-quality-api\.open-meteo\.com/i),
    bigdatacloud:heeft(/bigdatacloud\.net/i),
    osm:heeft(/\/api\/plaatsnaam(?:[?#]|$)|nominatim|openstreetmap/i),
    knmi:heeft(/\/api\/neerslag(?:[?#]|$)/i),
    meteoalarm:waarschuwingen&&waarschuwing.meteoalarm,
    nws:waarschuwingen&&waarschuwing.nws
  };
}
function rechthoekenBotsen(a,b,padding=0){
  if(!a||!b)return false;
  const p=Math.max(0,Number(padding)||0),ax=Number(a.x),ay=Number(a.y),aw=Number(a.width),ah=Number(a.height),bx=Number(b.x),by=Number(b.y),bw=Number(b.width),bh=Number(b.height);
  if(![ax,ay,aw,ah,bx,by,bw,bh].every(Number.isFinite))return false;
  return ax-p<bx+bw&&ax+aw+p>bx&&ay-p<by+bh&&ay+ah+p>by;
}

const api={uurUitIso,kiesUurLabelIndices,isUurAsLabel,waarschuwingBronnenVoorLand,neerslagSleutelTekst,bronGebruikUitResources,rechthoekenBotsen};
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
    setTimeout(voer,120);setTimeout(voer,350);
  };
  const fonts=document.fonts&&document.fonts.ready;
  if(fonts&&typeof fonts.then==="function")fonts.then(start).catch(start);else start();
}

function polishNuLabel(){
  const svg=document.getElementById("chart");if(!svg)return;
  const teksten=[...svg.querySelectorAll("text")],nu=teksten.find(el=>/^nu(?:\s|$)/i.test(String(el.textContent||"").trim()));
  if(!nu||typeof nu.getBBox!=="function")return;
  nu.removeAttribute("data-now-collision-adjusted");nu.removeAttribute("dy");
  let vak;try{vak=nu.getBBox();}catch(_){return;}
  const temperatuurLabels=teksten.filter(el=>el!==nu&&/^-?\d+(?:[.,]\d+)?°$/.test(String(el.textContent||"").trim())&&typeof el.getBBox==="function");
  const botst=temperatuurLabels.some(el=>{try{return rechthoekenBotsen(vak,el.getBBox(),3);}catch(_){return false;}});
  if(botst){nu.setAttribute("dy","12");nu.setAttribute("data-now-collision-adjusted","1");}
}
let nuPolishToken=0;
function planNuLabelPolish(){
  const token=++nuPolishToken,voer=()=>{if(token===nuPolishToken)polishNuLabel();};
  if(typeof requestAnimationFrame==="function")requestAnimationFrame(()=>requestAnimationFrame(voer));else setTimeout(voer,0);
}

function werkNeerslagSleutelBij(){
  const waarde=document.getElementById("pop"),stat=waarde&&waarde.closest(".stat"),sleutel=stat&&stat.querySelector(".mobile-neerslag-sleutel"),sub=document.getElementById("popsub");
  if(!waarde||!sleutel)return;
  const tekst=neerslagSleutelTekst(waarde.textContent,sub&&sub.textContent),zichtbaar=String(waarde.textContent||"").replace(/\s+/g," ").trim();
  const zichtbareSleutel=tekst==="kans · verwachte hoeveelheid"?"kans · totaal komend uur":tekst;
  sleutel.textContent=zichtbareSleutel;sleutel.hidden=!zichtbareSleutel;
  if(/%/.test(zichtbaar)&&/\bmm\b/i.test(zichtbaar)){
    waarde.setAttribute("aria-label","Komend uur: "+zichtbaar+". Eerst de neerslagkans, daarna het verwachte totaal in het komende uur.");
  }else if(/%/.test(zichtbaar)){
    const pct=(zichtbaar.match(/\d+\s*%/)||[])[0]||zichtbaar;
    waarde.setAttribute("aria-label",tekst.includes("onzeker")?"Komend uur: "+pct+" kans. De verwachte hoeveelheid is onzeker.":"Komend uur: "+pct+" kans.");
  }
}
function werkStatKoppenBij(){
  if(!mobiel())return;
  const gust=document.getElementById("gust"),stat=gust&&gust.closest(".stat"),kop=stat&&stat.querySelector(".eyebrow");
  if(kop)kop.textContent="Windstoot rond nu";
}
function resourceEntries(){
  try{return typeof performance!=="undefined"&&typeof performance.getEntriesByType==="function"?performance.getEntriesByType("resource"):[];}catch(_){return [];}
}
function werkBronnenBij(){
  const bron=document.querySelector("footer .bron-bronnen");if(!bron)return;
  const label=bron.querySelector(".bronlabel");if(label)label.textContent="Bronnen voor deze weergave";
  const gebruik=bronGebruikUitResources(resourceEntries(),S.land,{forecastBeschikbaar:!!S.d,airBeschikbaar:false});
  [...bron.querySelectorAll(".bronitem")].forEach(item=>{
    const naam=String(item.textContent||"").replace(/\s+/g," ").trim();
    let actief=true;
    if(naam==="Open-Meteo")actief=gebruik.openmeteo;
    else if(naam==="CAMS")actief=gebruik.cams;
    else if(naam==="MeteoAlarm")actief=gebruik.meteoalarm;
    else if(naam==="National Weather Service")actief=gebruik.nws;
    else if(naam==="BigDataCloud")actief=gebruik.bigdatacloud;
    else if(/OpenStreetMap/i.test(naam))actief=gebruik.osm;
    else if(naam==="KNMI")actief=gebruik.knmi;
    item.hidden=!actief;
  });
}
function werkContextBij(){werkNeerslagSleutelBij();werkStatKoppenBij();werkBronnenBij();}
function naRender(basis,nawerk){
  return function(){const r=basis.apply(this,arguments);nawerk();return r;};
}

if(typeof etmaal==="function"){
  etmaal=naRender(etmaal,()=>{planUurAsHerstel();planNuLabelPolish();});
}
if(typeof meters==="function"){
  meters=naRender(meters,werkContextBij);
}
if(typeof lucht==="function"){
  lucht=naRender(lucht,werkBronnenBij);
}
werkContextBij();planUurAsHerstel();planNuLabelPolish();
setTimeout(werkBronnenBij,450);setTimeout(werkBronnenBij,1400);

})(typeof globalThis!=="undefined"?globalThis:this);