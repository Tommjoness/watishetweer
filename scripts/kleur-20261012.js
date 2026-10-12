/* Kleurronde 2026-10-12 (akkoord eigenaar 12 oktober, op voor/na-beelden).
   Deze laag tekent alleen presentatie bij wat de app al toont:
   - een dun metertje onder de waarde van iedere tegel (wind in Beaufort,
     temperatuurtrend, neerslagkans, luchtvochtigheid, bewolking, UV);
   - de trendbalk toont de richting: koeler loopt van warm naar koud, warmer
     van koud naar warm, voller naarmate het verschil groter is (5 graden of
     meer is vol); gelijk blijven is neutraal grijs.
   De luchttint achter de hoofdweergave is op verzoek van de eigenaar weer
   weggehaald (12 oktober): die oogde als een gele waas.
   Waarden komen uit de getoonde tegeltekst zelf (alleen de cijfers, dus
   taalonafhankelijk), zodat meter en cijfer nooit uiteenlopen. Iedere tekenpass
   is idempotent en volgt elke latere render via één MutationObserver. */
(function(root){
"use strict";

const UV_WHO=[[2,"#289500"],[5,"#F7E400"],[7,"#F85900"],[10,"#D8001D"],[Infinity,"#6B49C8"]];
const TREND={licht:{neutraal:"#afaca4",warm:"#ad4600",koud:"#367ac1"},donker:{neutraal:"#77746d",warm:"#e28e3a",koud:"#73a9e1"}};
const TREND_VOL_BIJ=5;

function getallen(tekst){
  return [...String(tekst||"").replace(/−/g,"-").matchAll(/-?\d+(?:[.,]\d+)?/g)].map(m=>Number(m[0].replace(",",".")));
}
function begrens(v,lo,hi){return Math.min(hi,Math.max(lo,v));}
function mengHex(a,b,f){
  const p=[1,3,5].map(i=>parseInt(a.slice(i,i+2),16)),q=[1,3,5].map(i=>parseInt(b.slice(i,i+2),16));
  return "rgb("+p.map((v,k)=>Math.round(v+(q[k]-v)*f)).join(",")+")";
}
/* Verloop van de trendbalk voor één thema. */
function trendVerloop(van,naar,thema){
  const c=TREND[thema==="donker"?"donker":"licht"],dt=naar-van;
  if(!Number.isFinite(dt)||dt===0)return `linear-gradient(90deg,${c.neutraal},${c.neutraal})`;
  const f=begrens(Math.abs(dt)/TREND_VOL_BIJ,0,1),warm=mengHex(c.neutraal,c.warm,f),koud=mengHex(c.neutraal,c.koud,f);
  return dt<0?`linear-gradient(90deg,${warm},${koud})`:`linear-gradient(90deg,${koud},${warm})`;
}
function uvKleur(n){for(const [grens,kleur] of UV_WHO)if(n<=grens)return kleur;return UV_WHO[UV_WHO.length-1][1];}
function beaufort(kmh){
  if(typeof root.bft==="function")return root.bft(kmh);
  const grenzen=[1,6,12,20,29,39,50,62,75,89,103,117.000001];let n=0;for(let i=0;i<grenzen.length;i++)if(kmh>=grenzen[i])n=i+1;return n;
}

/* Wat er per tegel getekend wordt; null betekent: geen meter (geen cijfer). */
function meterVoor(id,tekst){
  const g=getallen(tekst);
  if(id==="uv")return g.length?{soort:"uv",waarde:begrens(Math.round(g[0]),0,11)}:null;
  if(id==="prec"){
    if(g.length<2||!/→|->/.test(String(tekst)))return null;
    return {soort:"trend",van:g[0],naar:g[1],licht:trendVerloop(g[0],g[1],"licht"),donker:trendVerloop(g[0],g[1],"donker")};
  }
  if(!g.length)return null;
  if(id==="wind")return {soort:"wind",procent:begrens(beaufort(g[0])/12*100,0,100)};
  if(id==="pop")return {soort:"regen",procent:begrens(g[0],0,100)};
  if(id==="hum"||id==="cloud")return {soort:"neutraal",procent:begrens(g[0],0,100)};
  return null;
}

function meterHtml(m){
  if(m.soort==="uv")return `<div class="wiw-meter wiw-meter-uv" data-meter="uv" data-waarde="${m.waarde}" aria-hidden="true">`+
    Array.from({length:11},(_,k)=>`<i${k<m.waarde?` style="background:${uvKleur(k+1)}"`:""}></i>`).join("")+`</div>`;
  if(m.soort==="trend")return `<div class="wiw-meter" data-meter="trend" data-van="${m.van}" data-naar="${m.naar}" aria-hidden="true"><i style="width:100%;--licht:${m.licht};--donker:${m.donker}"></i></div>`;
  return `<div class="wiw-meter" data-meter="${m.soort}" data-waarde="${Math.round(m.procent)}" aria-hidden="true"><i style="width:${m.procent.toFixed(1)}%"></i></div>`;
}

const TEGELS=["wind","prec","pop","hum","cloud","uv"];
function tekenMeters(doc){
  for(const id of TEGELS){
    const sval=doc.getElementById(id);if(!sval||!sval.parentElement)continue;
    const m=meterVoor(id,sval.textContent),html=m?meterHtml(m):"";
    const oud=sval.parentElement.querySelector(":scope > .wiw-meter");
    if(oud&&oud.outerHTML===html)continue;
    if(oud)oud.remove();
    if(html)sval.insertAdjacentHTML("afterend",html);
  }
}
function teken(doc){tekenMeters(doc);}

function start(){
  const doc=root.document;if(!doc||!doc.body)return;
  let gepland=false;
  const plan=()=>{if(gepland)return;gepland=true;(root.requestAnimationFrame||setTimeout)(()=>{gepland=false;teken(doc);});};
  teken(doc);
  if(typeof root.MutationObserver==="function")new root.MutationObserver(plan).observe(doc.body,{childList:true,subtree:true,characterData:true});
}

const api={getallen,trendVerloop,meterVoor,meterHtml,uvKleur,beaufort,TREND_VOL_BIJ};
root.WeatherNowKleur20261012=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else if(root.document){if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",start,{once:true});else start();}
})(typeof window!=="undefined"?window:globalThis);
