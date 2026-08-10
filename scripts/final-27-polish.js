/* Finale consumentenronde 10-08-2026.
   Gericht op de resterende punten uit de fysieke iPhone-controle:
   neerslaghoeveelheid, grafiektooltip, Nachtzicht-hiërarchie, tijdsbewuste tekst,
   grafiekontdubbeling en sneller terugkeren naar recent bekeken plaatsen.
   Brondata en rekenmodellen blijven eigenaar van kans/hoeveelheid; deze laag
   verzint nooit 0% uit een hoeveelheid van 0 mm. */
(function(root){
"use strict";

const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const MM_MEETBAAR=0.1;
const CACHE_KEY="weerbriefing.plaatscache.v1";
const CACHE_MAX=5;
const CACHE_VERS_MS=15*60*1000;
const SVG_NS="http://www.w3.org/2000/svg";

function mmTekst(v){
  const n=getal(v);
  if(n===null||n<0)return "";
  if(n>0&&n<MM_MEETBAAR)return "<0,1 mm";
  return n.toFixed(1).replace(".",",")+" mm";
}

function recenteNeerslagKop(intervalSeconden){
  const n=getal(intervalSeconden);
  if(n===null||Math.round(n)===900)return "Afgelopen kwartier";
  const minuten=Math.max(1,Math.round(n/60));
  return "Afgelopen "+minuten+" "+(minuten===1?"minuut":"minuten");
}

function dagNeerslagPresentatie(analyse,kansHoofdFn,hoeveelheidFn){
  const a=analyse||{};
  const hoofd=typeof kansHoofdFn==="function"?String(kansHoofdFn(a)||"–"):"–";
  const mm=getal(a.hoeveelheid);
  const hoeveelheid=a.genoeg&&mm!==null&&mm>=MM_MEETBAAR
    ? (typeof hoeveelheidFn==="function"?hoeveelheidFn(mm):mmTekst(mm)) : "";
  return {hoofd,hoeveelheid};
}

function nachtOordeelCompact(tekst){
  const t=String(tekst||"").trim();
  let m=/^Voorlopige indicatie:\s*(.+)$/i.exec(t);
  if(m)return {oordeel:m[1].charAt(0).toUpperCase()+m[1].slice(1),zekerheid:"voorlopig"};
  m=/^Globale indicatie:\s*(.+)$/i.exec(t);
  if(m)return {oordeel:m[1].charAt(0).toUpperCase()+m[1].slice(1),zekerheid:"indicatief"};
  return {oordeel:t,zekerheid:""};
}

function nachtVensterCompact(tekst){
  const t=String(tekst||"").trim();
  let m=/^Beste periode van de (.+) tot de (.+)$/i.exec(t);
  if(m)return "Beste periode: "+m[1]+"–"+m[2];
  m=/^Waarschijnlijk beste periode in de (.+)$/i.exec(t);
  if(m)return "Beste periode: waarschijnlijk "+(m[1].toLowerCase()==="nacht"?"'s nachts":m[1]);
  m=/^Beste periode in de (.+)$/i.exec(t);
  if(m)return "Beste periode: "+m[1];
  return t;
}

function bewolkingTekst(waarde,isDag){
  const v=getal(waarde); if(v===null)return null;
  const n=clamp(Math.round(v),0,100);
  if(n===100)return "Geheel bewolkt";
  if(n>=95)return "Vrijwel geheel bewolkt";
  if(n>=70)return "Zwaar bewolkt";
  if(n>=40)return "Half bewolkt";
  if(n>=15)return isDag===false?"Overwegend helder":"Overwegend zonnig";
  return "Vrijwel onbewolkt";
}

function uvMomentTekst(piekTijd,piekWaarde,nuTijd,oordeelFn){
  const waarde=getal(piekWaarde);
  if(!piekTijd||waarde===null)return null;
  if(waarde<0.5)return "Nauwelijks UV vandaag.";
  const tijd=String(piekTijd).slice(11,16);
  const oordeel=typeof oordeelFn==="function"?oordeelFn(waarde):"";
  const verleden=String(piekTijd)<=String(nuTijd||"");
  return (verleden?"Piekte rond ":"Piek rond ")+tijd+(oordeel?" · "+oordeel:"")+".";
}

function cacheSleutel(lat,lon){
  const a=getal(lat),b=getal(lon); if(a===null||b===null)return null;
  return a.toFixed(3)+","+b.toFixed(3);
}
function cacheIsVers(item,nu){
  const op=getal(item&&item.op),t=getal(nu); if(op===null||t===null)return false;
  return t>=op&&t-op<=CACHE_VERS_MS;
}
function cacheSnoei(obj){
  const bron=obj&&typeof obj==="object"?obj:{};
  const entries=Object.entries(bron).filter(([,v])=>v&&getal(v.op)!==null)
    .sort((a,b)=>Number(b[1].op)-Number(a[1].op)).slice(0,CACHE_MAX);
  return Object.fromEntries(entries);
}

function tooltipNeerslag(kans,mm){
  const k=getal(kans),m=getal(mm);
  return {
    kans:k===null?"–":Math.round(clamp(k,0,100))+"%",
    hoeveelheid:m!==null&&m>=MM_MEETBAAR?mmTekst(m):""
  };
}

function kiesDubbelTemperatuurlabel(a,b,temperaturen){
  const ia=Number(a&&a.i),ib=Number(b&&b.i),T=Array.isArray(temperaturen)?temperaturen:[];
  const ta=Number.isInteger(ia)?getal(T[ia]):null,tb=Number.isInteger(ib)?getal(T[ib]):null;
  if(ta===null)return b;
  if(tb===null)return a;
  const alle=T.map(getal).filter(v=>v!==null);
  if(!alle.length)return a;
  const afgerond=Number(String(a&&a.text||"").replace("°",""));
  const min=Math.min(...alle),max=Math.max(...alle);
  if(Number.isFinite(afgerond)&&Math.round(min)===afgerond)return ta<=tb?a:b;
  if(Number.isFinite(afgerond)&&Math.round(max)===afgerond)return ta>=tb?a:b;
  return a;
}

const api={
  mmTekst,recenteNeerslagKop,dagNeerslagPresentatie,nachtOordeelCompact,nachtVensterCompact,
  bewolkingTekst,uvMomentTekst,cacheSleutel,cacheIsVers,cacheSnoei,tooltipNeerslag,
  kiesDubbelTemperatuurlabel,MM_MEETBAAR,CACHE_VERS_MS
};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowFinale27=api;

if(typeof document==="undefined"||typeof S==="undefined")return;

function veiligeCacheLees(){
  try{return cacheSnoei(ls.get(CACHE_KEY,{}));}catch(e){return {};}
}
function veiligeCacheSchrijf(obj){
  try{ls.set(CACHE_KEY,cacheSnoei(obj));}catch(e){}
}
function bewaarPlaatsCache(lat,lon,label,land){
  const sleutel=cacheSleutel(lat,lon); if(!sleutel||!S.d)return;
  const c=veiligeCacheLees();
  c[sleutel]={d:S.d,air:S.air||null,label:String(label||S.label||""),lat:Number(lat),lon:Number(lon),land:land||S.land||null,op:S.op||Date.now()};
  veiligeCacheSchrijf(c);
}

/* De hoofdforecast is de enige netwerkrequest waarop de eerste volledige render
   wacht; luchtkwaliteit loopt al parallel en waarschuwingen pas na de render.
   Voor recent bekeken plaatsen tonen we daarom uitsluitend een verse, exact op
   coördinaten gematchte cache onmiddellijk, waarna dezelfde netwerkrefresh blijft
   lopen. Nieuwe plaatsen worden nooit met data van een andere plaats gevuld. */
const basisLoad=load;
load=async function(lat,lon,label,stil,opslaan,land){
  const sleutel=cacheSleutel(lat,lon),cache=sleutel?veiligeCacheLees()[sleutel]:null;
  const oudeSleutel=cacheSleutel(S.lat,S.lon),wissel=oudeSleutel!==sleutel;
  if(!stil&&cache&&cacheIsVers(cache,Date.now())&&cache.d){
    if(wissel){
      try{
        waarschuwingTeller++;
        S.actieveWaarschuwingen=[];
        const w=document.getElementById("waarschuwingen");if(w)w.innerHTML="";
      }catch(e){}
    }
    S.lat=Number(lat);S.lon=Number(lon);S.label=String(label||cache.label||"");S.land=land!==undefined?normLand(land):normLand(cache.land);
    S.d=cache.d;S.air=cache.air||null;S.op=cache.op;S.dag=null;
    try{
      tekenAlles();
      const app=document.getElementById("app");if(app)app.style.display="block";
    }catch(e){}
  }
  const resultaat=await basisLoad(lat,lon,label,stil,opslaan,land);
  if(cacheSleutel(S.lat,S.lon)===sleutel&&S.d)bewaarPlaatsCache(lat,lon,label,land);
  return resultaat;
};

/* Zoekresultaten hoeven bij dezelfde invoer niet opnieuw over het netwerk. De
   cache blijft alleen in deze tab en maximaal vijf minuten vers; foutresponses
   worden nooit opgeslagen. */
if(typeof j==="function"){
  const basisJ=j,zoekCache=new Map();
  j=async function(url,opt){
    const isZoek=String(url||"").startsWith("https://geocoding-api.open-meteo.com/v1/search?");
    if(!isZoek)return basisJ(url,opt);
    const hit=zoekCache.get(url),nu=Date.now();
    if(hit&&nu-hit.op<5*60*1000)return hit.value;
    const value=await basisJ(url,opt);zoekCache.set(url,{op:nu,value});
    if(zoekCache.size>20)zoekCache.delete(zoekCache.keys().next().value);
    return value;
  };
}

const basisMeters=meters;
meters=function(){
  basisMeters();
  const c=S.d&&S.d.current||{};
  const prec=document.getElementById("prec"),stat=prec&&prec.parentElement,kop=stat&&stat.querySelector(".eyebrow");
  if(kop)kop.textContent=recenteNeerslagKop(c.interval);

  const cc=getal(c.cloud_cover),cloudsub=document.getElementById("cloudsub"),bew=bewolkingTekst(cc,c.is_day!==0);
  if(cloudsub&&bew)cloudsub.textContent=bew+".";

  const pu=typeof piek==="function"?piek("uv_index"):null,uvsub=document.getElementById("uvsub");
  const uv=pu&&uvMomentTekst(pu.t,pu.v,c.time,typeof uvOordeel==="function"?uvOordeel:null);
  if(uvsub&&uv)uvsub.textContent=uv;
};

const basisDagen=dagen;
dagen=function(){
  basisDagen();
  const interpretatie=root.WeatherNowInterpretatie,beleid=root.WeatherNowKansbeleidV3;
  if(!interpretatie||!beleid)return;
  document.querySelectorAll("#days .row.day:not(.kop)").forEach(rij=>{
    const i=Number(rij.dataset.i),a=interpretatie.analyseerDagData(S.d,i,weatherNowActueleLokaleTijd());
    const kansEl=rij.querySelector(".drain");if(!kansEl)return;
    const p=dagNeerslagPresentatie(a,beleid.kansHoofd,beleid.hoeveelheidTekst);
    kansEl.textContent=p.hoofd;
    if(p.hoeveelheid){
      const small=document.createElement("small");
      small.className="dag-mm";small.textContent=p.hoeveelheid;
      kansEl.appendChild(small);
      const vandaag=S.d&&S.d.current&&String(S.d.current.time||"").slice(0,10)===String(a.datum||"");
      kansEl.title=(kansEl.title?kansEl.title+". ":"")+(vandaag?"Verwacht vanaf nu tot middernacht: ":"Verwacht die dag: ")+p.hoeveelheid;
    }
  });
};

const basisNachten=nachten;
nachten=function(){
  basisNachten();
  document.querySelectorAll("#nights .row.night:not(.kop)").forEach(rij=>{
    const advies=rij.querySelector(".nachtadvies"),venster=rij.querySelector(".nachtvenster");
    if(advies){
      const p=nachtOordeelCompact(advies.textContent);
      advies.textContent=p.oordeel;
      if(p.zekerheid){
        const z=document.createElement("span");z.className="nachtzekerheid";z.textContent=" · "+p.zekerheid;advies.appendChild(z);
      }
    }
    if(venster)venster.textContent=nachtVensterCompact(venster.textContent);
  });
};

function grafiekIndexVoorEvent(ev,G,svg){
  if(!G||!svg||!G.n||!Number.isFinite(G.cw)||G.cw<=0)return null;
  const r=svg.getBoundingClientRect();if(!r.width)return null;
  const sc=(G.W||900)/r.width;
  const x=(ev.clientX-r.left)*sc;
  return clamp(Math.round((x-G.pl)/G.cw),0,G.n-1);
}
function maakTooltipTekst(voorbeeld,tekst){
  const el=voorbeeld?voorbeeld.cloneNode(false):document.createElementNS(SVG_NS,"text");
  el.textContent=tekst;return el;
}
function schuifY(el,delta){
  const y=getal(el&&el.getAttribute&&el.getAttribute("y"));if(y!==null)el.setAttribute("y",String(y+delta));
  const y1=getal(el&&el.getAttribute&&el.getAttribute("y1")),y2=getal(el&&el.getAttribute&&el.getAttribute("y2"));
  if(y1!==null&&y2!==null&&Math.abs(y1-y2)<0.01){el.setAttribute("y1",String(y1+delta));el.setAttribute("y2",String(y2+delta));}
}

function verrijkTooltip(ev){
  const svg=document.getElementById("chart"),g=document.getElementById("scrub"),G=S.geo;
  if(!svg||!g||!G||g.style.display==="none")return;
  const i=grafiekIndexVoorEvent(ev,G,svg);if(i===null)return;
  const teksten=[...g.querySelectorAll("text")];if(teksten.length<13)return;
  const kansLabel=teksten[5],kansWaarde=teksten[6];
  const n=tooltipNeerslag(G.P&&G.P[i],G.MM&&G.MM[i]);
  kansLabel.textContent="neerslagkans";kansWaarde.textContent=n.kans;
  if(!n.hoeveelheid){
    g.setAttribute("aria-label",G.TI&&G.TI[i]?G.TI[i].slice(11,16)+", neerslagkans "+n.kans:"");
    return;
  }
  const eersteY=getal(teksten[1].getAttribute("y")),tweedeY=getal(teksten[3].getAttribute("y"));
  const stap=eersteY!==null&&tweedeY!==null&&tweedeY>eersteY?tweedeY-eersteY:(G.M?15:17);
  for(let q=7;q<teksten.length;q++)schuifY(teksten[q],stap);
  const mmLabel=maakTooltipTekst(kansLabel,"verwacht");
  const mmWaarde=maakTooltipTekst(kansWaarde,n.hoeveelheid);
  const ky=getal(kansLabel.getAttribute("y"));
  if(ky!==null){mmLabel.setAttribute("y",String(ky+stap));mmWaarde.setAttribute("y",String(ky+stap));}
  g.appendChild(mmLabel);g.appendChild(mmWaarde);
  const rect=g.querySelector("rect"),rh=getal(rect&&rect.getAttribute("height"));
  if(rect&&rh!==null)rect.setAttribute("height",String(rh+stap));
  if(rect){
    const ry=getal(rect.getAttribute("y")),hoog=getal(rect.getAttribute("height"));
    const over=ry!==null&&hoog!==null&&Number.isFinite(G.H)?Math.max(0,ry+hoog+2-G.H):0;
    if(over>0){
      rect.setAttribute("y",String(ry-over));
      [...g.querySelectorAll("text")].forEach(el=>schuifY(el,-over));
      [...g.querySelectorAll("line")].forEach(el=>{
        const y1=getal(el.getAttribute("y1")),y2=getal(el.getAttribute("y2"));
        if(y1!==null&&y2!==null&&Math.abs(y1-y2)<0.01)schuifY(el,-over);
      });
    }
  }
  g.setAttribute("aria-label",(G.TI&&G.TI[i]?G.TI[i].slice(11,16)+", ":"")+"neerslagkans "+n.kans+", verwacht "+n.hoeveelheid);
}

function labelNaarIndex(label,svg,G){
  const lx=getal(label.getAttribute("x")),tekst=String(label.textContent||"").trim();if(lx===null)return null;
  const doel=Number(tekst.replace("°",""));let best=null,afstand=Infinity;
  svg.querySelectorAll("circle[data-temp-index]").forEach(p=>{
    const i=Number(p.getAttribute("data-temp-index")),px=getal(p.getAttribute("cx")),t=Number.isInteger(i)&&G.T?getal(G.T[i]):null;
    if(px===null||t===null||Math.round(t)!==doel)return;
    const d=Math.abs(px-lx);if(d<afstand){afstand=d;best=i;}
  });
  return best;
}
function verwijderLabelEnPunt(label,idx,svg){
  if(label)label.remove();
  if(Number.isInteger(idx)){
    const p=svg.querySelector('circle[data-temp-index="'+idx+'"]');if(p)p.remove();
  }
}
function ontdubbelGrafiekRuimer(){
  const svg=document.getElementById("chart"),G=S.geo;if(!svg||!G)return;
  const labels=[...svg.querySelectorAll("text")].filter(el=>
    String(el.getAttribute("font-family")||"").includes("Bodoni Moda")&&/^-?\d+°$/.test(String(el.textContent||"").trim()))
    .map(el=>({el,text:String(el.textContent).trim(),x:getal(el.getAttribute("x")),y:getal(el.getAttribute("y"))}))
    .filter(x=>x.x!==null&&x.y!==null).sort((a,b)=>a.x-b.x);
  const lim=Math.max(56,(getal(G.cw)||0)*2.1);
  for(let a=0;a<labels.length;a++){
    const A=labels[a];if(!A.el.isConnected)continue;
    for(let b=a+1;b<labels.length;b++){
      const B=labels[b];if(!B.el.isConnected)continue;
      if(B.x-A.x>lim)break;
      if(A.text!==B.text||Math.abs(A.y-B.y)>42)continue;
      A.i=labelNaarIndex(A.el,svg,G);B.i=labelNaarIndex(B.el,svg,G);
      const keep=kiesDubbelTemperatuurlabel(A,B,G.T),weg=keep===A?B:A;
      verwijderLabelEnPunt(weg.el,weg.i,svg);
      if(weg===A)break;
    }
  }
}

const basisEtmaal=etmaal;
etmaal=function(start,n){
  basisEtmaal(start,n);
  const G=S.geo,h=S.d&&S.d.hourly;
  if(G&&h&&Array.isArray(h.time)){
    G.MM=[];
    for(let k=0;k<G.n;k++){
      const i=start+k,mm=getal(h.precipitation&&h.precipitation[i]);
      let verlopen=false;
      try{
        verlopen=S.dag==null&&root.WeatherNowInterpretatie
          &&root.WeatherNowInterpretatie.lokaalNaarMinuten(h.time[i])<=root.WeatherNowInterpretatie.lokaalNaarMinuten(weatherNowActueleLokaleTijd());
      }catch(e){}
      G.MM.push(verlopen||mm===null||mm<0?null:mm);
    }
  }
  ontdubbelGrafiekRuimer();
};

const basisScrubKoppel=scrubKoppel;
scrubKoppel=function(){
  basisScrubKoppel();
  const hit=document.getElementById("hit");if(!hit)return;
  hit.addEventListener("pointermove",verrijkTooltip);
  hit.addEventListener("pointerdown",verrijkTooltip);
};

/* Als de centrale analyse werkelijk GEEN_KANS geeft, staan briefing en tegel al
   op droog. Dan voegt een lege twee-uursmodule niets toe. Bij elke niet-nul kans,
   ook zonder meetbare hoeveelheid, blijft de module juist zichtbaar. */
const basisNowcast=nowcast;
nowcast=function(){
  basisNowcast();
  const interpretatie=root.WeatherNowInterpretatie;if(!interpretatie)return;
  const a=interpretatie.analyseerNeerslagData(S.d,120,weatherNowActueleLokaleTijd());
  const droog=a&&a.genoeg&&a.status==="GEEN_KANS";
  const hint=document.getElementById("nchint"),tx=document.getElementById("nctext"),grafiek=document.getElementById("nc");
  const details=hint&&hint.nextElementSibling&&hint.nextElementSibling.tagName==="DETAILS"?hint.nextElementSibling:null;
  const kop=hint&&hint.previousElementSibling&&hint.previousElementSibling.tagName==="H2"?hint.previousElementSibling:null;
  [kop,hint,details,tx,grafiek].forEach(el=>{if(el)el.hidden=!!droog;});
};

})(typeof globalThis!=="undefined"?globalThis:this);
