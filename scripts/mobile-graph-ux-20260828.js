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
function uurAsLabelTekst(tekst){
  const m=/^([01]?\d|2[0-3])(?::00)?$/.exec(String(tekst||"").trim());
  return m?String(Number(m[1])).padStart(2,"0")+":00":"";
}
function kiesUurLabelIndices(tijden,minimaal=4,cadans=3,rand=2){
  const T=Array.isArray(tijden)?tijden:[],min=Math.max(1,Math.floor(Number(minimaal)||4));
  const stap=Math.max(1,Math.floor(Number(cadans)||3)),inzet=Math.max(0,Math.floor(Number(rand)||0));
  if(T.length<3)return [];
  let basis=T.map((tijd,i)=>({i,uur:uurUitIso(tijd)}))
    .filter(x=>x.i>=inzet&&x.i<=T.length-1-inzet&&Number.isInteger(x.uur)&&x.uur%stap===0)
    .map(x=>x.i);
  if(basis.length<min)basis=T.map((_,i)=>i).filter(i=>i>=inzet&&i<=T.length-1-inzet);
  if(basis.length<=min)return basis;
  const uit=[];
  for(let k=0;k<min;k++){
    const pos=Math.round(k*(basis.length-1)/(min-1));
    const i=basis[pos];if(!uit.includes(i))uit.push(i);
  }
  return uit;
}
function isUurAsLabel(tekst,y,plotOnder,fontFamilie){
  const t=uurAsLabelTekst(tekst),py=Number(y),onder=Number(plotOnder),font=String(fontFamilie||"");
  return !!t&&Number.isFinite(py)&&Number.isFinite(onder)&&py>=onder+6&&!/Bodoni/i.test(font);
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
    /* Open-Meteo is de kernbron van iedere weerweergave. Deze attributie blijft
       daarom ook zichtbaar vóór/zonder een meetbare resource-entry; alleen de
       optionele aanvullende bronnen worden dynamisch gefilterd. */
    openmeteo:true,
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

/* Alleen voor de botsingsbeslissing van korte SVG-temperatuurlabels is een
   browsergedreven getBBox()-meting onnodig duur: zo'n read kan na SVG-mutaties
   een volledige layout flush afdwingen. Deze helper reconstrueert daarom een
   conservatieve tekstbox uit de al bekende SVG-attributen. De schatting is
   bewust iets ruimer dan de gangbare glyphbreedte; een zeldzame extra 12px
   labelverschuiving is veiliger dan een gemiste visuele botsing. */
function geschatteSvgTekstBox(tekst,x,y,anker="start",fontGrootte=12){
  const inhoud=String(tekst||"").trim(),px=Number(x),py=Number(y),fs=Number(fontGrootte);
  if(!inhoud||![px,py,fs].every(Number.isFinite)||fs<=0)return null;
  const breed=Math.max(fs*.75,inhoud.length*fs*.66),hoogte=fs*1.18;
  const a=String(anker||"start").toLowerCase();
  const links=a==="middle"?px-breed/2:a==="end"?px-breed:px;
  return {x:links,y:py-fs*.92,width:breed,height:hoogte};
}
function svgTekstBoxUitElement(el){
  if(!el||typeof el.getAttribute!=="function")return null;
  const x=el.getAttribute("x"),y=el.getAttribute("y"),anker=el.getAttribute("text-anchor")||"start";
  const font=Number(el.getAttribute("font-size"));
  return geschatteSvgTekstBox(el.textContent,x,y,anker,Number.isFinite(font)&&font>0?font:12);
}

/* Mobiele SVG-tekst mag nooit buiten de eigen viewBox vallen. Vooral het laatste
   HH:00-label stond op het laatste datapunt gecentreerd en liep daardoor rechts
   uit de grafiek. Deze pure helper geeft alleen bij echte randoverschrijding een
   nieuwe x/anchor terug; labels die al veilig staan blijven onaangeraakt. */
function randCorrectieVoorTekstBox(box,svgBreedte,marge=4){
  if(!box)return null;
  const x=Number(box.x),breed=Number(box.width),w=Number(svgBreedte),m=Math.max(0,Number(marge)||0);
  if(![x,breed,w].every(Number.isFinite)||breed<0||w<=0)return null;
  if(x<m)return {x:m,anker:"start"};
  if(x+breed>w-m)return {x:w-m,anker:"end"};
  return null;
}

/* Een temperatuurcijfer hoort visueel bij zijn datapunt. De collision-lagen van
   de basisgrafiek mogen een label iets laten verspringen, maar op mobiel niet
   zo ver dat het als een los zwevend getal oogt. Alleen buitensporige verticale
   afwijkingen worden begrensd; normale labelplaatsing blijft exact intact. */
function begrensTemperatuurLabelY(labelY,puntY,plotTop,plotBottom,maxAfstand=42){
  const ly=Number(labelY),py=Number(puntY),top=Number(plotTop),bottom=Number(plotBottom),lim=Math.max(1,Number(maxAfstand)||42);
  if(![ly,py,top,bottom].every(Number.isFinite)||bottom<=top)return null;
  if(Math.abs(ly-py)<=lim)return ly;
  const marge=10,boven=py-18,onder=py+24;
  let doel=ly<=py?boven:onder;
  if(doel<top+marge)doel=onder;
  if(doel>bottom-marge)doel=boven;
  return Math.max(top+marge,Math.min(bottom-marge,doel));
}

const api={uurUitIso,uurAsLabelTekst,kiesUurLabelIndices,isUurAsLabel,waarschuwingBronnenVoorLand,neerslagSleutelTekst,bronGebruikUitResources,rechthoekenBotsen,geschatteSvgTekstBox,randCorrectieVoorTekstBox,begrensTemperatuurLabelY};
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
function stileerUurAsLabel(el){
  if(!el)return;
  el.setAttribute("font-family","Instrument Sans,ui-sans-serif,system-ui,sans-serif");
  el.setAttribute("font-style","normal");
  el.setAttribute("font-weight","400");
  el.setAttribute("letter-spacing","0");
  if(el.style)el.style.fontVariantNumeric="tabular-nums";
}
function herstelUurAs(){
  if(!mobiel())return;
  const svg=document.getElementById("chart"),g=S.geo;
  if(!svg||!g||Number(g.n)>48||!Array.isArray(g.TI)||typeof g.x!=="function")return;
  const compact24=Number(g.n)<=24&&window.innerWidth<=430,cadans=compact24?4:3,rand=compact24?1:2,minimum=compact24?6:4;
  let alle=bestaandeUurLabels(svg,g);
  alle.forEach(el=>{const expliciet=uurAsLabelTekst(el.textContent);if(expliciet)el.textContent=expliciet;});
  if(compact24){
    /* Acht volledige drie-uurslabels zijn technisch passend maar ogen op een
       iPhone onrustig. Op <=430 px houden we daarom een stabiel vier-uursritme:
       zes kloktijden over 24 uur, zonder iets aan de forecastpunten te wijzigen. */
    alle.forEach(el=>{
      const uur=Number(String(el.textContent||"").slice(0,2));
      if(!Number.isInteger(uur)||uur%cadans!==0)el.remove();
    });
    alle=bestaandeUurLabels(svg,g);
  }
  let fallback=alle.filter(el=>el.hasAttribute("data-mobile-hour-axis")),canoniek=alle.filter(el=>!el.hasAttribute("data-mobile-hour-axis"));
  alle.forEach(stileerUurAsLabel);
  if(canoniek.length>=minimum){fallback.forEach(el=>el.remove());return;}
  if(alle.length>=minimum)return;
  const posities=alle.map(el=>Number(el.getAttribute("x"))).filter(Number.isFinite);
  const y=Number(g.pt)+Number(g.ih)+20;
  if(!Number.isFinite(y))return;
  const kleur=getComputedStyle(document.documentElement).getPropertyValue("--ink-45").trim()||"currentColor";
  for(const i of kiesUurLabelIndices(g.TI,minimum,cadans,rand)){
    if(bestaandeUurLabels(svg,g).length>=minimum)break;
    const x=Number(g.x(i)),uur=uurUitIso(g.TI[i]);
    if(!Number.isFinite(x)||!Number.isInteger(uur)||posities.some(p=>Math.abs(p-x)<18))continue;
    const el=document.createElementNS(SVG_NS,"text");
    el.setAttribute("x",String(x));el.setAttribute("y",String(y));
    el.setAttribute("text-anchor","middle");el.setAttribute("fill",kleur);
    el.setAttribute("font-size","8.5");stileerUurAsLabel(el);
    el.setAttribute("data-mobile-hour-axis","1");el.textContent=uurAsLabelTekst(String(uur));
    const regen=svg.querySelector('g[data-q4-rain-periods]'),scrub=svg.querySelector("#scrub");
    svg.insertBefore(el,regen||scrub||null);posities.push(x);
  }
}

function polishMobieleGrafiekRanden(){
  if(!mobiel())return;
  const svg=document.getElementById("chart"),g=S.geo;
  if(!svg||!g||!g.M||!Number.isFinite(Number(g.W)))return;
  const W=Number(g.W),top=Number(g.pt),bottom=top+Number(g.ih),marge=5;
  if(![W,top,bottom].every(Number.isFinite)||bottom<=top)return;

  /* De uur-as wordt eerst volledig opgebouwd en pas daarna tegen de viewBox
     begrensd. Zo blijft ook een fallback-label op het laatste uur volledig leesbaar. */
  bestaandeUurLabels(svg,g).forEach(el=>{
    const correctie=randCorrectieVoorTekstBox(svgTekstBoxUitElement(el),W,marge);
    if(!correctie)return;
    el.setAttribute("x",String(correctie.x));
    el.setAttribute("text-anchor",correctie.anker);
    el.setAttribute("data-mobile-edge-adjusted","1");
  });

  const temperaturen=Array.isArray(g.T)?g.T:[];
  const punten=[...svg.querySelectorAll("circle[data-temp-index]")].map(el=>({
    el,i:Number(el.getAttribute("data-temp-index")),x:Number(el.getAttribute("cx")),y:Number(el.getAttribute("cy"))
  })).filter(p=>Number.isInteger(p.i)&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(Number(temperaturen[p.i])));
  const labels=[...svg.querySelectorAll("text")].filter(el=>{
    const ff=String(el.getAttribute("font-family")||"");
    return /Bodoni/i.test(ff)&&/^-?\d+°$/.test(String(el.textContent||"").trim());
  }).sort((a,b)=>Number(a.getAttribute("x"))-Number(b.getAttribute("x")));
  const gebruikt=new Set(),maxDx=Math.max(54,(Number(g.cw)||0)*3);

  labels.forEach(el=>{
    const m=/^(-?\d+)°$/.exec(String(el.textContent||"").trim()),lx=Number(el.getAttribute("x"));
    if(!m||!Number.isFinite(lx))return;
    const doel=Number(m[1]);
    let beste=null,afstand=Infinity;
    for(const p of punten){
      if(gebruikt.has(p.i)||Math.round(Number(temperaturen[p.i]))!==doel)continue;
      const d=Math.abs(p.x-lx);
      if(d<afstand){beste=p;afstand=d;}
    }
    if(!beste||afstand>maxDx)return;
    gebruikt.add(beste.i);
    const huidigY=Number(el.getAttribute("y")),nieuwY=begrensTemperatuurLabelY(huidigY,beste.y,top,bottom,42);
    if(Number.isFinite(nieuwY)&&nieuwY!==huidigY){
      el.setAttribute("y",String(nieuwY));
      el.setAttribute("data-mobile-detached-temp-fixed","1");
    }
    const correctie=randCorrectieVoorTekstBox(svgTekstBoxUitElement(el),W,marge);
    if(correctie){
      el.setAttribute("x",String(correctie.x));
      el.setAttribute("text-anchor",correctie.anker);
      el.setAttribute("data-mobile-edge-adjusted","1");
    }
  });
}

let uurAsToken=0;
function planUurAsHerstel(){
  const token=++uurAsToken;
  const voer=()=>{if(token===uurAsToken){herstelUurAs();polishMobieleGrafiekRanden();}};
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
  if(!nu)return;
  nu.removeAttribute("data-now-collision-adjusted");nu.removeAttribute("dy");
  const vak=svgTekstBoxUitElement(nu);if(!vak)return;
  const temperatuurLabels=teksten.filter(el=>el!==nu&&/^-?\d+(?:[.,]\d+)?°$/.test(String(el.textContent||"").trim()));
  const botst=temperatuurLabels.some(el=>rechthoekenBotsen(vak,svgTekstBoxUitElement(el),3));
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
/* Windstootkop en -subtekst hebben één eigenaar in de base-build. Deze mobiele
   grafiek-/bronlaag raakt die tegel bewust niet meer aan. */
function werkContextBij(){werkNeerslagSleutelBij();werkBronnenBij();}
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