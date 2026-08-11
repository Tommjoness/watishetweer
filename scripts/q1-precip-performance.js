/* Checkpoint 25% van de 27-punten-eindronde.
   Scope: temperatuurtrend komende drie uur, conditionele korte-termijnneerslag,
   kans + hoeveelheid zonder semantische vermenging, en meetbare laadoptimalisatie.
   Geen temperatuurinterpolatie: het dichtstbijzijnde echte uurlijkse modelpunt
   rond nu + drie verstreken uren wordt gebruikt. */
(function(root){
"use strict";

const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const MM_MEETBAAR=0.1;
const CACHE_KEY="weerbriefing.plaatscache.q1";
const CACHE_MAX=3;
const CACHE_VERS_MS=10*60*1000;
const TREND_UREN=3;
const TREND_MAX_AFWIJKING_MIN=45;

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

/* Voor de zevendaagse zichtbare neerslagkolom worden de twee officiële daily
   velden naast elkaar gehouden: probability_max voor de kans en precipitation_sum
   voor de hoeveelheid. Een afgeronde 0,0 mm verandert de bronkans nooit. */
function dagNeerslagPresentatie(kans,dagMm,kansHoofdFn,hoeveelheidFn){
  const k=getal(kans),mm=getal(dagMm),genoeg=k!==null||mm!==null;
  const a={genoeg,kans:k,hoeveelheid:mm};
  const hoofd=typeof kansHoofdFn==="function"?String(kansHoofdFn(a)||"–"):(k===null?"–":Math.round(clamp(k,0,100))+"%");
  const hoeveelheid=mm!==null&&mm>=MM_MEETBAAR
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

function parseLokaleTijd(tijd){
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(tijd||""));
  return m?{jaar:+m[1],maand:+m[2],dag:+m[3],uur:+m[4],minuut:+m[5]}:null;
}
function zoneDelen(ms,tijdzone){
  if(!tijdzone||typeof Intl==="undefined"||!Intl.DateTimeFormat)return null;
  try{
    const delen=new Intl.DateTimeFormat("en-CA",{timeZone:tijdzone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ms));
    const p={};delen.forEach(x=>{if(x.type!=="literal")p[x.type]=Number(x.value);});
    return [p.year,p.month,p.day,p.hour,p.minute,p.second].every(Number.isFinite)?p:null;
  }catch(e){return null;}
}
function zoneOffset(ms,tijdzone){
  const p=zoneDelen(ms,tijdzone);if(!p)return null;
  return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-Math.floor(ms/1000)*1000;
}
function zelfdeLokaleTijd(p,d){
  return !!p&&!!d&&p.year===d.jaar&&p.month===d.maand&&p.day===d.dag&&p.hour===d.uur&&p.minute===d.minuut;
}

/* Een lokale kloktekst kan tijdens de najaarsomslag twee echte instants hebben.
   Daarom verzamelen we alle offsets die rond die datum in de IANA-zone gelden en
   accepteren uitsluitend kandidaten die terugformatteren naar exact dezelfde
   lokale kloktekst. Zo wordt 02:00 (zomertijd) niet verward met 02:00 (wintertijd).
   Niet-bestaande tijden tijdens de voorjaarssprong leveren geen kandidaat op. */
function lokaleInstantKandidaten(tijd,tijdzone,utcOffsetSeconden){
  const p=parseLokaleTijd(tijd);if(!p)return [];
  const lokaalNaief=Date.UTC(p.jaar,p.maand-1,p.dag,p.uur,p.minuut);
  if(tijdzone&&typeof Intl!=="undefined"&&Intl.DateTimeFormat){
    const offsets=new Set();
    for(let h=-48;h<=48;h+=6){
      const off=zoneOffset(lokaalNaief+h*3600000,tijdzone);
      if(Number.isFinite(off))offsets.add(off);
    }
    const kandidaten=[];
    offsets.forEach(off=>{
      const ms=lokaalNaief-off;
      if(zelfdeLokaleTijd(zoneDelen(ms,tijdzone),p))kandidaten.push(ms);
    });
    const uniek=[...new Set(kandidaten)].sort((a,b)=>a-b);
    if(uniek.length)return uniek;
  }
  const off=getal(utcOffsetSeconden);
  return [lokaalNaief-(off===null?0:off*1000)];
}

/* De uurreeks staat in forecastvolgorde. Bij een dubbel lokaal uur kiezen we
   voor het eerste voorkomen de vroegste kandidaat en voor het tweede de volgende
   kandidaat, waardoor de resulterende instants strikt oplopen. */
function uurInstants(tijden,tijdzone,utcOffsetSeconden){
  const uit=[],reeks=Array.isArray(tijden)?tijden:[];
  let vorige=-Infinity;
  for(const tijd of reeks){
    const kandidaten=lokaleInstantKandidaten(tijd,tijdzone,utcOffsetSeconden);
    let gekozen=kandidaten.find(ms=>ms>vorige+1000);
    if(!Number.isFinite(gekozen)){uit.push(null);continue;}
    uit.push(gekozen);vorige=gekozen;
  }
  return uit;
}

function temperatuurTrend(data,nuInstantMs){
  const d=data||{},h=d.hourly||{},c=d.current||{};
  const vanRuw=getal(c.temperature_2m),nu=getal(nuInstantMs);
  if(vanRuw===null||nu===null||!Array.isArray(h.time)||!Array.isArray(h.temperature_2m))return {genoeg:false};
  const instants=uurInstants(h.time,d.timezone,d.utc_offset_seconds),doel=nu+TREND_UREN*3600000;
  let beste=null;
  for(let i=0;i<instants.length;i++){
    const ms=instants[i],temp=getal(h.temperature_2m[i]);
    if(!Number.isFinite(ms)||temp===null||ms<nu)continue;
    const verschil=Math.abs(ms-doel);
    if(!beste||verschil<beste.verschil||(verschil===beste.verschil&&ms>beste.ms))beste={i,ms,temp,verschil};
  }
  if(!beste||beste.verschil>TREND_MAX_AFWIJKING_MIN*60000)return {genoeg:false};
  const van=Math.round(vanRuw),naar=Math.round(beste.temp);
  return {
    genoeg:true,van,naar,
    richting:naar>van?"stijgt":naar<van?"daalt":"gelijk",
    doelMs:doel,puntMs:beste.ms,puntTijd:h.time[beste.i],
    afwijkingMin:Math.round(beste.verschil/60000)
  };
}

function neerslagTegelRelevant(analyse){
  const a=analyse||{},k=getal(a.kans),mm=getal(a.hoeveelheid);
  if(a.currentWet||a.status==="NEERSLAG_NU")return true;
  if(!a.genoeg)return false;
  return (k!==null&&k>=30)||(mm!==null&&mm>=MM_MEETBAAR);
}

const api={
  mmTekst,tooltipNeerslag,dagNeerslagPresentatie,cacheSleutel,cacheIsVers,cacheSnoei,
  parseLokaleTijd,lokaleInstantKandidaten,uurInstants,temperatuurTrend,neerslagTegelRelevant,
  MM_MEETBAAR,CACHE_VERS_MS,TREND_UREN,TREND_MAX_AFWIJKING_MIN
};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowQ1=api;

if(typeof document==="undefined"||typeof S==="undefined")return;

const perf=root.WeatherNowQ1Performance={cacheHits:0,geocodeCacheHits:0,lastCachePaintMs:null,lastNetworkMs:null};
const nuMs=()=>root.performance&&typeof root.performance.now==="function"?root.performance.now():Date.now();
const trendNuMs=()=>S.klokInstantOverride&&typeof S.klokInstantOverride.getTime==="function"?S.klokInstantOverride.getTime():Date.now();

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
   Een recent bekeken plaats kan daarom uit exact die coördinaatgebonden cache
   direct tekenen, terwijl de gewone netwerkrefresh doorgaat. De canonieke
   laadTeller/AbortController-logica blijft eigenaar van racebescherming. */
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

/* Herhaalde identieke zoekvragen hoeven binnen dezelfde tab niet opnieuw naar
   Open-Meteo Geocoding. De bestaande debounce en inhoud van resultaten veranderen niet. */
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

function renderTemperatuurTrend(){
  const waarde=document.getElementById("prec"),stat=waarde&&waarde.parentElement,kop=stat&&stat.querySelector(".eyebrow"),sub=document.getElementById("precsub");
  if(!waarde||!stat||!kop||!sub)return;
  kop.textContent="Temperatuurtrend";
  stat.classList.add("q1-temp-trend");
  const t=temperatuurTrend(S.d,trendNuMs());
  if(!t.genoeg){waarde.textContent="–";sub.textContent="Temperatuurtrend niet beschikbaar.";return;}
  waarde.innerHTML=String(t.van)+" → "+String(t.naar)+"<s>°C</s>";
  sub.textContent=t.richting==="stijgt"?"Stijgt de komende drie uur."
    :t.richting==="daalt"?"Daalt de komende drie uur.":"Blijft vrijwel gelijk.";
}

function renderNeerslagTegel(){
  const waarde=document.getElementById("pop"),stat=waarde&&waarde.parentElement,kop=stat&&stat.querySelector(".eyebrow"),sub=document.getElementById("popsub"),stats=stat&&stat.parentElement;
  if(!waarde||!stat||!kop||!sub||!stats)return;
  const interpretatie=root.WeatherNowInterpretatie,beleid=root.WeatherNowKansbeleidV3;
  const a=interpretatie&&typeof interpretatie.analyseerNeerslagData==="function"
    ?interpretatie.analyseerNeerslagData(S.d,60,weatherNowActueleLokaleTijd()):null;
  const relevant=neerslagTegelRelevant(a);
  stat.style.display=relevant?"":"none";
  stat.setAttribute("aria-hidden",relevant?"false":"true");
  stats.classList.toggle("q1-pop-hidden",!relevant);
  if(!relevant)return;
  kop.textContent=a&&a.currentWet?"Neerslag nu":"Neerslag komend uur";
  const hoofd=beleid&&typeof beleid.kansHoofd==="function"?beleid.kansHoofd(a):"–";
  const mm=getal(a&&a.hoeveelheid),detail=mm!==null&&mm>=MM_MEETBAAR?mmTekst(mm):"";
  if(a&&a.currentWet&&hoofd==="–")waarde.textContent="Nu"+(detail?" · "+detail:"");
  else if(/^\d+%$/.test(String(hoofd)))waarde.innerHTML=String(hoofd).replace("%","<s>%</s>")+(detail?"<s> · "+detail+"</s>":"");
  else waarde.innerHTML=String(hoofd||"–")+(detail?"<s> · "+detail+"</s>":"");
  sub.textContent=beleid&&typeof beleid.komendUurTekst==="function"?beleid.komendUurTekst(a):"";
}

/* Dit is de enige Q1-wrapper rond meters(): de oude kwartierkop-wrapper uit de
   screenshot-polish is verwijderd. De canonieke meters() rendert de overige
   metrieken; Q1 bezit uitsluitend de twee productbeslissingen hierboven. */
if(typeof meters==="function"){
  const basisMeters=meters;
  meters=function(){basisMeters();renderTemperatuurTrend();renderNeerslagTegel();};
}

/* Weekverwachting: de zichtbare kans en hoeveelheid komen beide uit de officiële
   daily velden van dezelfde kalenderdag. 0,0 mm wordt niet getoond; 25% + 0,0 mm
   blijft wel 25%. */
if(typeof dagen==="function"){
  const basisDagen=dagen;
  dagen=function(){
    basisDagen();
    const beleid=root.WeatherNowKansbeleidV3,day=S.d&&S.d.daily;
    if(!beleid||!day)return;
    document.querySelectorAll("#days .row.day:not(.kop)").forEach(rij=>{
      const i=Number(rij.dataset.i),kans=getal(day.precipitation_probability_max&&day.precipitation_probability_max[i]),mm=getal(day.precipitation_sum&&day.precipitation_sum[i]);
      const kansEl=rij.querySelector(".drain");if(!kansEl)return;
      const p=dagNeerslagPresentatie(kans,mm,beleid.kansHoofd,beleid.hoeveelheidTekst);
      kansEl.textContent=p.hoofd;
      if(p.hoeveelheid){
        const small=document.createElement("small");small.className="q1-dag-mm";small.textContent=p.hoeveelheid;kansEl.appendChild(small);
        kansEl.title=(kansEl.title?kansEl.title+". ":"")+"Verwachte daghoeveelheid: "+p.hoeveelheid;
      }
    });
  };
}

/* De bestaande tooltip blijft compact. De neerslagregel combineert alleen bij
   meetbare hoeveelheid de twee onafhankelijke bronvelden: '65% · 1,4 mm'. */
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
      G.Q1MM.push(G.P&&G.P[k]==null?null:(v===null||v<0?null:v));
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
