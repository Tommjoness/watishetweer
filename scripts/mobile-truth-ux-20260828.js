/* Mobiele waarheid + leesbaarheid 2026-08-28.
   Deze laag verandert geen providerdata of gedeelde grafiekarrays. Hij corrigeert
   alleen de zichtbare resterende regenperiode en verduidelijkt mobiele copy. */
(function(root){
"use strict";

const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const begrens=(v,a,b)=>Math.max(a,Math.min(b,v));
const DAGEN_KORT=["zo","ma","di","wo","do","vr","za"];

function lokaleSerieleMinuten(tijd){
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(tijd||""));
  if(!m)return null;
  return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])/60000;
}
function corrigeerLopendModeluur(waarde,eindTijd,nuTijd){
  const mm=getal(waarde),eind=lokaleSerieleMinuten(eindTijd),nu=lokaleSerieleMinuten(nuTijd);
  if(mm===null||mm<0||eind===null||nu===null)return mm;
  const begin=eind-60;
  if(eind<=nu)return null;
  if(nu<=begin)return mm;
  return mm*begrens((eind-nu)/60,0,1);
}
function regenperiodenGecorrigeerd(mm,tijden,nuTijd,drempel=0.1){
  const waarden=Array.from(mm||[]),T=Array.from(tijden||[]),grens=Math.max(0,getal(drempel)??0.1),perioden=[];
  const nu=lokaleSerieleMinuten(nuTijd);
  let lopend=null;
  for(let i=1;i<waarden.length&&i<T.length;i++){
    const ruw=getal(waarden[i]),eind=lokaleSerieleMinuten(T[i]),begin=eind===null?null:eind-60;
    const waarde=ruw===null?null:corrigeerLopendModeluur(ruw,T[i],nuTijd);
    const actief=waarde!==null&&eind!==null&&nu!==null&&begin<nu&&nu<eind;
    if(waarde!==null&&waarde>=grens){
      if(!lopend)lopend={van:i-1,tot:i,som:0,actiefStart:actief};
      lopend.tot=i;lopend.som+=waarde;
    }else if(lopend){perioden.push(lopend);lopend=null;}
  }
  if(lopend)perioden.push(lopend);
  return perioden;
}
function mmTekst(v){
  const n=getal(v);if(n===null||n<0)return "–";
  if(n>0&&n<0.1)return "<0,1";
  return n.toFixed(1).replace(".",",");
}
function dagKortUitIso(tijd){
  const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(tijd||""));if(!m)return null;
  const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3],12));
  return DAGEN_KORT[d.getUTCDay()]||null;
}
function nachtPaarLabel(daily,index){
  const i=Math.max(0,Math.floor(Number(index)||0)),ss=daily&&daily.sunset&&daily.sunset[i],sr=daily&&daily.sunrise&&daily.sunrise[i+1];
  const a=dagKortUitIso(ss),b=dagKortUitIso(sr);return a&&b?a+"–"+b:null;
}

const api={lokaleSerieleMinuten,corrigeerLopendModeluur,regenperiodenGecorrigeerd,mmTekst,nachtPaarLabel};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowMobileTruthUX20260828=api;

if(typeof document==="undefined"||typeof window==="undefined"||typeof S==="undefined")return;
const mobiel=()=>typeof window.matchMedia==="function"?window.matchMedia("(max-width:900px)").matches:window.innerWidth<=900;

function neerslagUurBetekenis(){
  const waarde=document.getElementById("pop"),stat=waarde&&waarde.closest(".stat");if(!waarde||!stat)return;
  const kop=stat.querySelector(".eyebrow");if(kop)kop.textContent="Neerslag komend uur";
  let sleutel=stat.querySelector(".mobile-neerslag-sleutel");
  if(!sleutel){sleutel=document.createElement("div");sleutel.className="mobile-neerslag-sleutel";waarde.insertAdjacentElement("afterend",sleutel);}
  sleutel.textContent="kans · verwachte hoeveelheid";
  const tekst=(waarde.textContent||"").trim();
  if(tekst&&tekst!=="--"&&tekst!=="–")waarde.setAttribute("aria-label","Komend uur: "+tekst+". Eerst de neerslagkans, daarna de verwachte hoeveelheid.");
}

const SECUNDAIR=[
  ["humsub","Luchtvochtigheid"],["pressub","Luchtdruk"],["cloudsub","Bewolking"],["vissub","Zicht"]
];
function meetdetailUitleg(){
  const stats=document.querySelector(".dashrow-hero .stats");if(!stats)return;
  let details=document.getElementById("mobile-meetdetails");
  if(!details){
    details=document.createElement("details");details.id="mobile-meetdetails";details.className="mobile-meetdetails";
    const summary=document.createElement("summary");summary.textContent="Uitleg meetwaarden";
    const body=document.createElement("div");body.className="mobile-meetdetails-body";details.append(summary,body);
    stats.insertAdjacentElement("afterend",details);
  }
  const body=details.querySelector(".mobile-meetdetails-body");if(!body)return;
  body.replaceChildren();
  SECUNDAIR.forEach(([id,label])=>{
    const sub=document.getElementById(id),stat=sub&&sub.closest(".stat");if(!sub||!stat)return;
    stat.classList.add("mobile-secundaire-stat");
    const p=document.createElement("p"),sterk=document.createElement("strong");sterk.textContent=label+": ";
    p.append(sterk,document.createTextNode((sub.textContent||"").trim()));body.appendChild(p);
  });
}

function herstelNachtlabels(){
  const rijen=[...document.querySelectorAll("#nights .row.night:not(.kop)")];if(rijen.length<2)return;
  const labels=rijen.map(r=>r.querySelector(".dname"));
  for(let i=1;i<labels.length;i++){
    const a=labels[i-1],b=labels[i];if(!a||!b)continue;
    if((a.textContent||"").trim().toLowerCase()!==(b.textContent||"").trim().toLowerCase())continue;
    if(i===1){
      a.textContent="nu";
      const op=S.d&&S.d.daily&&S.d.daily.sunrise&&S.d.daily.sunrise[0];
      if(op)a.title="Actieve nacht tot zonsopkomst "+String(op).slice(11,16);
    }
    const paar=nachtPaarLabel(S.d&&S.d.daily||{},Math.max(0,i-1));
    b.textContent=paar||"volgende nacht";
    b.title="Volgende volledige nacht";
  }
}

/* Q4 blijft de enige eigenaar van de grafiek- en tooltipdata. We lezen de
   intervalarray alleen en corrigeren uitsluitend de zichtbare regenbracket voor
   het resterende deel van een lopend modeluur. Zo kan een presentatielaag nooit
   de interactieve tooltip of een andere consument van S.geo veranderen. */
function corrigeerRegenperiodenInGrafiek(){
  if(S.dag!=null)return;
  const svg=document.getElementById("chart"),g=S.geo,groep=svg&&svg.querySelector('g[data-q4-rain-periods]');
  if(!svg||!g||!groep||!Array.isArray(g.TI)||!Array.isArray(g.MM))return;
  const nu=typeof weatherNowActueleLokaleTijd==="function"?weatherNowActueleLokaleTijd():(S.d&&S.d.current&&S.d.current.time)||"";
  const perioden=regenperiodenGecorrigeerd(g.MM,g.TI,nu,0.1);
  const bedragen=[...groep.querySelectorAll("[data-q4-rain-period-amount]")];
  const lijnen=[...groep.querySelectorAll("line[aria-label]")];
  if(perioden.length!==bedragen.length||perioden.length!==lijnen.length)return;
  perioden.forEach((p,index)=>{
    const bedrag=mmTekst(p.som);bedragen[index].textContent=bedrag+" mm";
    const einde=String(g.TI[p.tot]||"").slice(11,16),begin=String(g.TI[p.van]||"").slice(11,16);
    const tijdvak=p.actiefStart?"nu–"+einde:begin+"–"+einde;
    lijnen[index].setAttribute("aria-label",tijdvak+" · "+bedrag+" mm");
    if(p.actiefStart){
      const start=groep.querySelector('[data-q4-rain-period-start="'+index+'"]');if(start)start.textContent="nu";
      const range=groep.querySelector('[data-q4-rain-period-range="'+index+'"]');if(range)range.textContent="nu–"+einde;
    }
  });
}

function grafiekHint(){
  if(!mobiel()||S.dag!=null)return;
  const hint=document.getElementById("charthint");
  if(hint)hint.textContent="Temperatuur boven, neerslagperioden onder. Selecteer een punt voor details.";
}
let grafiekToken=0;
function planGrafiekPolish(){
  const token=++grafiekToken;
  const doe=()=>{if(token===grafiekToken){corrigeerRegenperiodenInGrafiek();grafiekHint();}};
  if(typeof requestAnimationFrame==="function")requestAnimationFrame(doe);else setTimeout(doe,0);
}

/* De bestaande responsive layout is al browsergetest. Een nieuwe volgorde wordt
   pas toegepast wanneer dat zonder het verplaatsen van bestaande sectie-eigenaars
   kan; deze hook blijft daarom bewust zonder DOM-mutatie. */
function installeerMobieleVolgorde(){}

if(typeof meters==="function"){
  const basisMeters=meters;meters=function(){const r=basisMeters.apply(this,arguments);neerslagUurBetekenis();meetdetailUitleg();return r;};
}
if(typeof nachten==="function"){
  const basisNachten=nachten;nachten=function(){const r=basisNachten.apply(this,arguments);herstelNachtlabels();return r;};
}
if(typeof etmaal==="function"){
  const basisEtmaal=etmaal;etmaal=function(){const r=basisEtmaal.apply(this,arguments);planGrafiekPolish();return r;};
}
installeerMobieleVolgorde();
neerslagUurBetekenis();meetdetailUitleg();

})(typeof globalThis!=="undefined"?globalThis:this);
