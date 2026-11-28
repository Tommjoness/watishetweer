/* Staff-audit 2026-08-26: gerichte runtime-hardening zonder redesign. */
(function(root){
"use strict";

const NWS_LANDEN=new Set(["US","PR","VI","GU","MP","AS"]);
const WAARSCHUWING_TITELS=Object.freeze({
  "flood watch":"Waakzaamheid voor overstromingen",
  "flood warning":"Waarschuwing voor overstromingen",
  "flash flood warning":"Waarschuwing voor plotselinge overstromingen",
  "extreme heat warning":"Waarschuwing voor extreme hitte",
  "excessive heat warning":"Waarschuwing voor extreme hitte",
  "heat advisory":"Hitteadvies",
  "air quality alert":"Luchtkwaliteitswaarschuwing",
  "severe thunderstorm warning":"Waarschuwing voor zwaar onweer",
  "severe thunderstorm watch":"Waakzaamheid voor zwaar onweer",
  "tornado warning":"Tornadowaarschuwing",
  "tornado watch":"Waakzaamheid voor tornado's",
  "winter storm warning":"Waarschuwing voor zwaar winterweer",
  "high wind warning":"Waarschuwing voor zeer harde wind",
  "wind advisory":"Windadvies",
  "rip current statement":"Melding over gevaarlijke stromingen (rip currents)",
  "coastal flood advisory":"Advies voor overstroming aan de kust"
});
const schoon=v=>String(v==null?"":v).trim().replace(/\s+/g," ");
const eindig=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;

function waarschuwingTitelNl(titel){
  const origineel=schoon(titel),sleutel=origineel.toLocaleLowerCase("en-US");
  return {origineel,nederlands:WAARSCHUWING_TITELS[sleutel]||origineel,vertaald:Object.prototype.hasOwnProperty.call(WAARSCHUWING_TITELS,sleutel)};
}
function waarschuwingTitelVoorBriefing(titel,land){
  const origineel=schoon(titel);
  if(!NWS_LANDEN.has(schoon(land).toUpperCase()))return origineel;
  return waarschuwingTitelNl(origineel).nederlands;
}
function locatieSleutel(lat,lon,label){
  const a=eindig(lat),b=eindig(lon);if(a===null||b===null)return null;
  return a.toFixed(5)+"|"+b.toFixed(5)+"|"+schoon(label).toLocaleLowerCase("und");
}
function historyState(lat,lon,label,land,route){
  const a=eindig(lat),b=eindig(lon);if(a===null||b===null||a<-90||a>90||b<-180||b>180)return null;
  return {weatherNowLocation:1,lat:a,lon:b,plaats:schoon(label)||"Gedeelde locatie",land:schoon(land).toUpperCase()||null,route:route===true};
}
function historyStateGeldig(s){
  return !!(s&&s.weatherNowLocation===1&&historyState(s.lat,s.lon,s.plaats,s.land,s.route));
}
function formatMm(v){
  const n=eindig(v);if(n===null||n<0)return "–";
  if(n===0)return "0,0 mm";
  if(n<0.1)return "<0,1 mm";
  return n.toLocaleString("nl-NL",{minimumFractionDigits:1,maximumFractionDigits:1})+" mm";
}

/* Een paginaanker (bijvoorbeeld /#nachtzicht vanuit het menu op een subpagina) hoort bij de
   navigatie van de bezoeker. Alleen een eenvoudige id komt in aanmerking; al het andere vervalt. */
function ankerGeldig(hash){
  return typeof hash==="string"&&/^#[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(hash);
}

const api={WAARSCHUWING_TITELS,waarschuwingTitelNl,waarschuwingTitelVoorBriefing,locatieSleutel,historyState,historyStateGeldig,formatMm,ankerGeldig,markeerNavigatie:()=>{}};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowStaffAudit=api;

if(typeof document==="undefined"||typeof window==="undefined"||typeof S==="undefined"||typeof load!=="function")return;

/* ---------------- browser history ---------------- */
let volgendeNavigatie="replace";
const modusPerLocatie=new Map();
function markeerNavigatie(modus){volgendeNavigatie=modus==="push"||modus==="pop"?modus:"replace";}
api.markeerNavigatie=markeerNavigatie;

const basisLoadStaff=load;
load=async function(lat,lon,label,stil,opslaan,land){
  const mode=volgendeNavigatie;volgendeNavigatie="replace";
  const sleutel=locatieSleutel(lat,lon,label);
  if(sleutel&&mode!=="replace")modusPerLocatie.set(sleutel,mode);
  const state=document.getElementById("state");if(state)state.setAttribute("role","status");
  try{return await basisLoadStaff(lat,lon,label,stil,opslaan,land);}
  finally{if(sleutel&&modusPerLocatie.get(sleutel)===mode)modusPerLocatie.delete(sleutel);}
};

const basisUrlBijStaff=typeof urlBij==="function"?urlBij:null;
const initieleRoute=root.__WEATHERNOW_ROUTE_LOCATION__&&typeof root.__WEATHERNOW_ROUTE_LOCATION__==="object"
  ?Object.assign({},root.__WEATHERNOW_ROUTE_LOCATION__):null;
const routeSeo=initieleRoute?{
  title:document.title,
  canonical:document.querySelector('link[rel="canonical"]')?.getAttribute("href")||"",
  description:document.querySelector('meta[name="description"]')?.getAttribute("content")||"",
  ogTitle:document.querySelector('meta[property="og:title"]')?.getAttribute("content")||"",
  ogDescription:document.querySelector('meta[property="og:description"]')?.getAttribute("content")||"",
  ogUrl:document.querySelector('meta[property="og:url"]')?.getAttribute("content")||"",
  structured:document.querySelector('script[type="application/ld+json"]')?.textContent||""
}:null;
function routePad(route){return route&&route.slug?"/weer/"+route.slug+"/":null;}
function zelfdeRoute(route){
  return !!(route&&eindig(S.lat)!==null&&eindig(S.lon)!==null
    &&Math.abs(Number(S.lat)-Number(route.lat))<1e-9&&Math.abs(Number(S.lon)-Number(route.lon))<1e-9
    &&location.pathname===routePad(route));
}
function rootUrlVoor(state){
  /* Productie gebruikt altijd de canonieke root. Browsertests en lokale QA
     kunnen de artifact rechtstreeks via file:// openen; ook daar mag URL-sync
     nooit een succesvolle forecastload in een foutpad duwen. */
  const u=/^https?:$/i.test(location.protocol)?new URL("/",location.href):new URL(location.href);
  u.searchParams.set("lat",Number(state.lat).toFixed(3));u.searchParams.set("lon",Number(state.lon).toFixed(3));
  u.searchParams.set("plaats",state.plaats);
  if(state.land)u.searchParams.set("land",state.land);else u.searchParams.delete("land");
  return u.href;
}
function herstelRouteSeo(){
  if(!initieleRoute||!routeSeo)return;
  root.__WEATHERNOW_ROUTE_LOCATION__=Object.freeze(Object.assign({},initieleRoute));
  document.title=routeSeo.title;
  const zet=(sel,attr,val)=>{const el=document.querySelector(sel);if(el&&val)el.setAttribute(attr,val);};
  zet('link[rel="canonical"]',"href",routeSeo.canonical);
  zet('meta[name="description"]',"content",routeSeo.description);
  zet('meta[property="og:title"]',"content",routeSeo.ogTitle);
  zet('meta[property="og:description"]',"content",routeSeo.ogDescription);
  zet('meta[property="og:url"]',"content",routeSeo.ogUrl);
  const structured=document.querySelector('script[type="application/ld+json"]');if(structured&&routeSeo.structured)structured.textContent=routeSeo.structured;
  const context=document.querySelector(".seo-route-context");if(context)context.hidden=false;
}

let ankerGedaan=false;
function paginaAnker(){
  try{const h=location.hash;return ankerGeldig(h)&&document.getElementById(h.slice(1))?h:"";}catch(_){return "";}
}
function naarAnker(anker){
  if(ankerGedaan||!anker)return;
  ankerGedaan=true;
  const doelEl=document.getElementById(anker.slice(1));
  if(!doelEl||typeof doelEl.scrollIntoView!=="function")return;
  /* Zodra de bezoeker zelf scrolt, klikt of een toets gebruikt, blijft de pagina staan. */
  let zelf=false;const stop=()=>{zelf=true;};
  ["wheel","touchstart","keydown","pointerdown"].forEach(t=>root.addEventListener(t,stop,{once:true,passive:true}));
  const ga=()=>{if(!zelf)doelEl.scrollIntoView({block:"start"});};
  if(typeof root.requestAnimationFrame==="function")root.requestAnimationFrame(ga);else ga();
  if(document.readyState!=="complete")root.addEventListener("load",()=>root.setTimeout(ga,0),{once:true});
  /* Onderdelen die daarna nog boven het anker verschijnen (luchtkwaliteit, waarschuwingen; op de telefoon
     meer dan op desktop) duwen het weer omlaag. Volg zulke verschuivingen kort (8 s), zolang de bezoeker
     zelf niets doet. */
  if(typeof root.ResizeObserver==="function"&&document.body){
    const tot=Date.now()+8000;
    const ro=new root.ResizeObserver(()=>{if(zelf||Date.now()>tot){ro.disconnect();return;}ga();});
    ro.observe(document.body);
    root.setTimeout(()=>ro.disconnect(),8100);
  }
}

urlBij=function(){
  /* URL/history is afgeleide navigatiepresentatie. Een browserbeperking op
     History API (bijvoorbeeld file:// tijdens lokale QA) mag nooit weerdata of
     de succesvolle loadstatus ongeldig maken. Dit behoudt het fail-safe gedrag
     van de oorspronkelijke urlBij-owner. */
  try{
    const route=root.__WEATHERNOW_ROUTE_LOCATION__;
    const isRoute=zelfdeRoute(route);
    const state=historyState(S.lat,S.lon,S.label,S.land,isRoute);if(!state)return;
    const sleutel=locatieSleutel(S.lat,S.lon,S.label),mode=sleutel&&modusPerLocatie.get(sleutel)||"replace";
    if(sleutel)modusPerLocatie.delete(sleutel);

    if(isRoute){
      history.replaceState(state,"",location.pathname+location.search+location.hash);
      return;
    }
    const doel=rootUrlVoor(state);
    const verlaatStatischeRoute=!!(initieleRoute&&route&&basisUrlBijStaff);
    if(mode==="push"){
      /* Eerst een nieuwe entry maken zodat de statische route als Back-doel
         behouden blijft. Daarna laat de bestaande SEO-owner de huidige entry
         naar de algemene root/canonical/context transformeren. */
      if(location.href===doel)history.replaceState(state,"",doel);else history.pushState(state,"",doel);
      if(verlaatStatischeRoute)basisUrlBijStaff();
      history.replaceState(state,"",doel);
    }else if(mode==="pop"){
      if(verlaatStatischeRoute)basisUrlBijStaff();
      history.replaceState(state,"",location.href);
    }else{
      /* Ook programmatische/replace-locatiekeuzes moeten de statische SEO-
         identiteit verlaten. Dit contract bestond al vóór history-support en
         blijft bewust onafhankelijk van de wijze waarop load() is aangeroepen. */
      if(verlaatStatischeRoute)basisUrlBijStaff();
      /* Een anker uit de oorspronkelijke link (/#nachtzicht) blijft staan; na de eerste weergave
         gaat de pagina er alsnog heen, omdat de weerinhoud erboven het onderdeel intussen heeft
         verschoven. Een keuze voor een andere plaats (push) laat het anker bewust vallen. */
      const anker=paginaAnker();
      history.replaceState(state,"",anker?doel.replace(/#.*$/,"")+anker:doel);
      naarAnker(anker);
    }
  }catch(_){/* weerdata blijft leidend; history-sync faalt gesloten als UI-bijzaak */}
};

window.addEventListener("popstate",e=>{
  let state=historyStateGeldig(e.state)?e.state:null;
  const routeTerug=initieleRoute&&location.pathname===routePad(initieleRoute);
  if(!state&&routeTerug)state=historyState(initieleRoute.lat,initieleRoute.lon,initieleRoute.name,initieleRoute.country,true);
  if(!state){
    const hard=root.WeatherNowGlobalLocationHardening;
    const gedeeld=hard&&typeof hard.gedeeldeUrlCoordinaten==="function"?hard.gedeeldeUrlCoordinaten(location.search):null;
    if(gedeeld&&gedeeld.geldig){
      const p=new URLSearchParams(location.search);
      state=historyState(gedeeld.latitude,gedeeld.longitude,p.get("plaats")||"Gedeelde locatie",p.get("land"),false);
    }
  }
  if(!state)return;
  if(state.route)herstelRouteSeo();
  markeerNavigatie("pop");
  const qEl=document.getElementById("q");if(qEl)qEl.value=state.plaats;
  Promise.resolve(load(state.lat,state.lon,state.plaats,false,true,state.land)).then(()=>{if(state.route)herstelRouteSeo();}).catch(()=>{});
});

/* ---------------- waarschuwingstitels ---------------- */
/* De briefing rendert binnen de basis-waarschuwingflow vóór de kaartlokalisatie.
   Geef alleen die renderer daarom tijdelijk een vertaalde kopie van NWS-titels;
   de officiële brondata blijft intact voor het uitklapbare origineel. */
if(typeof briefing==="function"){
  const basisBriefingWaarschuwingNl=briefing;
  briefing=function(){
    const origineel=S.actieveWaarschuwingen,land=schoon(S.land).toUpperCase();
    /* Engelstalige bezoekers krijgen de officiële Engelse gebeurtenisnaam; de vertaallaag laat die staan. */
    const engels=typeof document!=="undefined"&&document.documentElement&&document.documentElement.getAttribute("data-taal")==="en";
    if(!Array.isArray(origineel)||!NWS_LANDEN.has(land)||engels)return basisBriefingWaarschuwingNl.apply(this,arguments);
    /* De server levert de Nederlandse titel (`titelNl`) bij een zekere vertaling; de oudere tabel is alleen de terugval
       voor een antwoord zonder dat veld. Zonder zekere vertaling blijft de officiële naam staan. */
    const vertaald=origineel.map(w=>{
      if(!w)return w;const titel=schoon(w.titelNl)||waarschuwingTitelVoorBriefing(w.titel,land);
      return titel&&titel!==w.titel?Object.assign({},w,{titel}):w;
    });
    S.actieveWaarschuwingen=vertaald;
    try{return basisBriefingWaarschuwingNl.apply(this,arguments);}
    finally{S.actieveWaarschuwingen=origineel;}
  };
}
function lokaliseerWaarschuwingen(){
  const land=schoon(S.land).toUpperCase();if(!NWS_LANDEN.has(land))return;
  document.querySelectorAll("#waarschuwingen .waarsch").forEach(kaart=>{
    const h=kaart.querySelector("h3");if(!h||kaart.dataset.staffWarningLocalized==="1")return;
    const mapped=waarschuwingTitelNl(h.textContent);if(!mapped.origineel)return;
    kaart.dataset.staffWarningLocalized="1";kaart.dataset.officialTitle=mapped.origineel;
    if(mapped.vertaald)h.textContent=mapped.nederlands;
    const details=document.createElement("details");details.className="waarsch-officieel-details";
    const summary=document.createElement("summary");summary.textContent="Officiële melding";
    const p=document.createElement("p");
    if(mapped.vertaald){
      p.append("Officiële titel: ");const span=document.createElement("span");span.lang="en";span.textContent=mapped.origineel;p.append(span,". Bron: National Weather Service.");
    }else p.textContent="Officiële titel hierboven ongewijzigd. Bron: National Weather Service.";
    details.append(summary,p);kaart.appendChild(details);
  });
}
if(typeof waarschuwingen==="function"){
  const basisWaarschuwingenStaff=waarschuwingen;
  waarschuwingen=async function(){const r=await basisWaarschuwingenStaff.apply(this,arguments);lokaliseerWaarschuwingen();return r;};
}

/* ---------------- daggebonden neerslagduiding ---------------- */
const DAG_NEERSLAG_BRONCONTRACT="Kans en dagsom zijn verschillende modelwaarden en hoeven daarom niet één op één samen te vallen.";
function verduidelijkDagNeerslagBroncontract(){
  document.querySelectorAll("#days .dag-neerslagnotitie").forEach(note=>{
    const tekst=schoon(note.textContent);
    if(tekst&&!tekst.includes(DAG_NEERSLAG_BRONCONTRACT))note.append(" "+DAG_NEERSLAG_BRONCONTRACT);
  });
}
if(typeof dagen==="function"){
  const basisDagenStaff=dagen;
  dagen=function(){const r=basisDagenStaff.apply(this,arguments);verduidelijkDagNeerslagBroncontract();return r;};
}

/* ---------------- alternatieve grafiekdata ---------------- */
function lokaleTijdLabel(iso,meerdereDagen){
  const s=schoon(iso),m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);if(!m)return s||"–";
  if(!meerdereDagen)return m[4]+":"+m[5];
  const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5])));
  return d.toLocaleString("nl-NL",{timeZone:"UTC",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).replace(",","");
}
function werkGrafiekTabelBij(){
  const details=document.getElementById("chartdata"),body=details&&details.querySelector("tbody");
  if(!body)return;
  const regio=details.querySelector(".chartdata-scroll");
  const heeftUren=Array.isArray(S.geo&&S.geo.TI)&&S.geo.TI.length>0;
  if(details.hidden===heeftUren)details.hidden=!heeftUren;
  if(!heeftUren){
    details.open=false;
    body.replaceChildren();
    return;
  }
  const g=S.geo,h=S.d&&S.d.hourly;
  const tijden=g.TI.map(t=>typeof weatherNowLokaleTijd==="function"?weatherNowLokaleTijd(t):t);
  const meer=tijden.length>1&&String(tijden[0]).slice(0,10)!==String(tijden[tijden.length-1]).slice(0,10);
  const uurIndex=new Map(Array.isArray(h&&h.time)?h.time.map((t,i)=>[String(t),i]):[]);
  const frag=document.createDocumentFragment();
  for(let i=0;i<g.TI.length;i++){
    const tr=document.createElement("tr"),hi=uurIndex.get(String(g.TI[i]));
    const ms=typeof uurInstant==="function"?uurInstant(g.TI[i]):null;
    if(Number.isFinite(ms))tr.dataset.instant=String(ms);
    const aanduiding=Number.isFinite(ms)&&typeof uurAanduiding==="function"?uurAanduiding(ms):"";
    const code=eindig(g.D&&g.D[i]),isDag=eindig(g.ND&&g.ND[i]);
    const kans=eindig(g.P&&g.P[i]),temp=eindig(g.T&&g.T[i]),gevoel=eindig(g.A&&g.A[i]),wind=eindig(g.W_&&g.W_[i]),gust=eindig(g.G&&g.G[i]);
    const richting=eindig(g.WD&&g.WD[i]),bewolking=eindig(g.C&&g.C[i]);
    /* Neerslag voor het uur dat op dit tijdstip begint: bronindex +1. */
    const mm=Number.isInteger(hi)?eindig(h&&h.precipitation&&h.precipitation[hi+1]):null;
    const waarden=[
      lokaleTijdLabel(tijden[i],meer)+(aanduiding?" ("+aanduiding+")":""),
      code===null?"–":(typeof txt==="function"?txt(code,isDag!==0):"Weercode "+code),
      temp===null?"–":Math.round(temp)+" °C",
      gevoel===null?"–":Math.round(gevoel)+" °C",
      kans===null?"–":Math.round(Math.max(0,Math.min(100,kans)))+"%",
      mm===null?"–":formatMm(mm),
      wind===null?"–":Math.round(wind)+" km/u",
      gust===null?"–":Math.round(gust)+" km/u",
      richting!==null&&typeof kompas==="function"?kompas(richting):"–",
      bewolking===null?"–":bewolking+"%"
    ];
    waarden.forEach((waarde,j)=>{const el=document.createElement(j===0?"th":"td");if(j===0)el.scope="row";el.textContent=waarde;tr.appendChild(el);});
    frag.appendChild(tr);
  }
  body.replaceChildren(frag);
  if(regio)regio.setAttribute("aria-label","Grafiekgegevens, "+g.TI.length+" tijdstippen");
}
if(typeof etmaal==="function"){
  const basisEtmaalStaff=etmaal;
  etmaal=function(){const r=basisEtmaalStaff.apply(this,arguments);werkGrafiekTabelBij();return r;};
}

})(typeof globalThis!=="undefined"?globalThis:this);
