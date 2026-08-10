/* Checkpoint 25% van de 27-punten-eindronde.
   Alleen: neerslagkans + hoeveelheid en sneller terugkeren naar recent bekeken plaatsen.
   Kans en hoeveelheid blijven twee onafhankelijke bronvelden; 0 mm forceert nooit 0%. */
(function(root){
"use strict";

const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const MM_MEETBAAR=0.1;
const CACHE_KEY="weerbriefing.plaatscache.q1";
const CACHE_MAX=3;
const CACHE_VERS_MS=10*60*1000;

function mmTekst(v){
  const n=getal(v);
  if(n===null||n<0)return "";
  if(n>0&&n<MM_MEETBAAR)return "<0,1 mm";
  return n.toFixed(1).replace(".",",")+" mm";
}

function tooltipNeerslag(kans,mm){
  const k=getal(kans),m=getal(mm);
  const kansTekst=k===null?"–":Math.round(clamp(k,0,100))+"%";
  const hoeveelheid=m!==null&&m>=MM_MEETBAAR?mmTekst(m):"";
  return {kans:kansTekst,hoeveelheid,waarde:kansTekst+(hoeveelheid?" · "+hoeveelheid:"")};
}

function dagNeerslagPresentatie(analyse,kansHoofdFn,hoeveelheidFn){
  const a=analyse||{};
  const hoofd=typeof kansHoofdFn==="function"?String(kansHoofdFn(a)||"–"):"–";
  const mm=getal(a.hoeveelheid);
  const hoeveelheid=a.genoeg&&mm!==null&&mm>=MM_MEETBAAR
    ? (typeof hoeveelheidFn==="function"?hoeveelheidFn(mm):mmTekst(mm)) : "";
  return {hoofd,hoeveelheid};
}

function cacheSleutel(lat,lon){
  const a=getal(lat),b=getal(lon);if(a===null||b===null)return null;
  return a.toFixed(3)+","+b.toFixed(3);
}
function cacheIsVers(item,nu){
  const op=getal(item&&item.op),t=getal(nu);if(op===null||t===null)return false;
  return t>=op&&t-op<=CACHE_VERS_MS;
}
function cacheSnoei(obj){
  const bron=obj&&typeof obj==="object"?obj:{};
  return Object.fromEntries(Object.entries(bron)
    .filter(([,v])=>v&&getal(v.op)!==null)
    .sort((a,b)=>Number(b[1].op)-Number(a[1].op))
    .slice(0,CACHE_MAX));
}

const api={mmTekst,tooltipNeerslag,dagNeerslagPresentatie,cacheSleutel,cacheIsVers,cacheSnoei,MM_MEETBAAR,CACHE_VERS_MS};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowQ1=api;

if(typeof document==="undefined"||typeof S==="undefined")return;

const perf=root.WeatherNowQ1Performance={cacheHits:0,geocodeCacheHits:0,lastCachePaintMs:null,lastNetworkMs:null};
const nuMs=()=>root.performance&&typeof root.performance.now==="function"?root.performance.now():Date.now();

function leesCache(){try{return cacheSnoei(ls.get(CACHE_KEY,{}));}catch(e){return {};}}
function schrijfCache(obj){try{ls.set(CACHE_KEY,cacheSnoei(obj));}catch(e){}}
function bewaarCache(lat,lon,label,land){
  const sleutel=cacheSleutel(lat,lon);if(!sleutel||!S.d)return;
  const c=leesCache();
  c[sleutel]={d:S.d,air:S.air||null,label:String(label||S.label||""),lat:Number(lat),lon:Number(lon),land:land||S.land||null,op:S.op||Date.now()};
  schrijfCache(c);
}

/* Audit van het bestaande laadpad: de hoofdforecast is de kritieke request;
   luchtkwaliteit start al parallel en waarschuwingen komen na de eerste render.
   We maken de hoofdrequest daarom niet zwaarder. Voor een recent bekeken plaats
   wordt exact dezelfde coördinaatgebonden data direct getekend, terwijl de gewone
   netwerkrefresh op de achtergrond gewoon doorgaat. */
if(typeof load==="function"){
  const basisLoad=load;
  load=async function(lat,lon,label,stil,opslaan,land){
    const start=nuMs(),sleutel=cacheSleutel(lat,lon),cache=sleutel?leesCache()[sleutel]:null;
    const wissel=cacheSleutel(S.lat,S.lon)!==sleutel;
    if(!stil&&cache&&cacheIsVers(cache,Date.now())&&cache.d){
      if(wissel){
        try{
          waarschuwingTeller++;
          S.actieveWaarschuwingen=[];
          const w=document.getElementById("waarschuwingen");if(w)w.innerHTML="";
        }catch(e){}
      }
      S.lat=Number(lat);S.lon=Number(lon);S.label=String(label||cache.label||"");
      S.land=land!==undefined?normLand(land):normLand(cache.land);
      S.d=cache.d;S.air=cache.air||null;S.op=cache.op;S.dag=null;
      try{
        tekenAlles();
        const app=document.getElementById("app");if(app)app.style.display="block";
        const state=document.getElementById("state");if(state)state.style.display="none";
        if(typeof urlBij==="function")urlBij();
        perf.cacheHits++;perf.lastCachePaintMs=Math.max(0,nuMs()-start);
      }catch(e){}
    }
    const resultaat=await basisLoad(lat,lon,label,stil,opslaan,land);
    perf.lastNetworkMs=Math.max(0,nuMs()-start);
    if(cacheSleutel(S.lat,S.lon)===sleutel&&S.d)bewaarCache(lat,lon,label,land);
    return resultaat;
  };
}

/* Herhaalde zoektermen hoeven binnen dezelfde tab niet opnieuw naar de
   geocoding-API. Dit verandert geen debounce of resultaten en voorkomt alleen
   identieke netwerkvragen. */
if(typeof j==="function"){
  const basisJ=j,zoekCache=new Map();
  j=async function(url,opt){
    const u=String(url||""),isZoek=u.startsWith("https://geocoding-api.open-meteo.com/v1/search?");
    if(!isZoek)return basisJ(url,opt);
    const hit=zoekCache.get(u),nu=Date.now();
    if(hit&&nu-hit.op<5*60*1000){perf.geocodeCacheHits++;return hit.value;}
    const value=await basisJ(url,opt);zoekCache.set(u,{op:nu,value});
    if(zoekCache.size>20)zoekCache.delete(zoekCache.keys().next().value);
    return value;
  };
}

/* Weekverwachting: kans blijft de hoofdwaarde. Alleen een werkelijk meetbare
   modelhoeveelheid krijgt een tweede, rustige regel; 0,0 mm wordt nooit getoond. */
if(typeof dagen==="function"){
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
        const small=document.createElement("small");small.className="q1-dag-mm";small.textContent=p.hoeveelheid;kansEl.appendChild(small);
        kansEl.title=(kansEl.title?kansEl.title+". ":"")+"Verwachte hoeveelheid: "+p.hoeveelheid;
      }
    });
  };
}

/* De bestaande tooltip blijft zes regels hoog. De neerslagregel krijgt alleen
   meer informatie wanneer er meetbare mm zijn: '65% · 1,4 mm'. Bij 0 mm blijft
   uitsluitend de echte bronkans staan, dus bijvoorbeeld 8% en nooit geforceerd 0%. */
function verrijkTooltip(ev){
  const svg=document.getElementById("chart"),g=document.getElementById("scrub"),G=S.geo;
  if(!svg||!g||!G||g.style.display==="none"||!G.n||!Number.isFinite(G.cw)||G.cw<=0)return;
  const r=svg.getBoundingClientRect();if(!r.width)return;
  const sc=(G.W||900)/r.width;
  const i=clamp(Math.round((((ev.clientX-r.left)*sc)-G.pl)/G.cw),0,G.n-1);
  const teksten=[...g.querySelectorAll("text")];if(teksten.length<7)return;
  const p=tooltipNeerslag(G.P&&G.P[i],G.Q1MM&&G.Q1MM[i]);
  teksten[5].textContent="neerslagkans";
  teksten[6].textContent=p.waarde;
  g.setAttribute("aria-label",(G.TI&&G.TI[i]?G.TI[i].slice(11,16)+", ":"")+"neerslagkans "+p.kans+(p.hoeveelheid?", verwacht "+p.hoeveelheid:""));
}

if(typeof etmaal==="function"){
  const basisEtmaal=etmaal;
  etmaal=function(start,n){
    basisEtmaal(start,n);
    const G=S.geo,h=S.d&&S.d.hourly;if(!G||!h)return;
    G.Q1MM=[];
    for(let k=0;k<G.n;k++){
      const v=getal(h.precipitation&&h.precipitation[start+k]);
      G.Q1MM.push(v===null||v<0?null:v);
    }
  };
}
if(typeof scrubKoppel==="function"){
  const basisScrubKoppel=scrubKoppel;
  scrubKoppel=function(){
    basisScrubKoppel();
    const hit=document.getElementById("hit");if(!hit)return;
    hit.addEventListener("pointermove",verrijkTooltip);
    hit.addEventListener("pointerdown",verrijkTooltip);
  };
}

})(typeof globalThis!=="undefined"?globalThis:this);
