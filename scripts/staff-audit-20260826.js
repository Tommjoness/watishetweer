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
  "wind advisory":"Windadvies"
});
const schoon=v=>String(v==null?"":v).trim().replace(/\s+/g," ");
const eindig=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;

function waarschuwingTitelNl(titel){
  const origineel=schoon(titel),sleutel=origineel.toLocaleLowerCase("en-US");
  return {origineel,nederlands:WAARSCHUWING_TITELS[sleutel]||origineel,vertaald:Object.prototype.hasOwnProperty.call(WAARSCHUWING_TITELS,sleutel)};
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

const api={WAARSCHUWING_TITELS,waarschuwingTitelNl,locatieSleutel,historyState,historyStateGeldig,formatMm,markeerNavigatie:()=>{}};
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
      history.replaceState(state,"",doel);
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
  const body=document.querySelector("#chartdata tbody"),regio=document.querySelector("#chartdata .chartdata-scroll");
  if(!body||!S.geo||!Array.isArray(S.geo.TI)){return;}
  const g=S.geo,h=S.d&&S.d.hourly,meer=g.TI.length>1&&String(g.TI[0]).slice(0,10)!==String(g.TI[g.TI.length-1]).slice(0,10);
  const uurIndex=new Map(Array.isArray(h&&h.time)?h.time.map((t,i)=>[String(t),i]):[]);
  const frag=document.createDocumentFragment();
  for(let i=0;i<g.TI.length;i++){
    const tr=document.createElement("tr"),hi=uurIndex.get(String(g.TI[i]));
    const code=eindig(g.D&&g.D[i]),isDag=eindig(g.ND&&g.ND[i]);
    const kans=eindig(g.P&&g.P[i]),temp=eindig(g.T&&g.T[i]),gevoel=eindig(g.A&&g.A[i]),wind=eindig(g.W_&&g.W_[i]),gust=eindig(g.G&&g.G[i]);
    const mm=Number.isInteger(hi)?eindig(h&&h.precipitation&&h.precipitation[hi]):null;
    const waarden=[
      lokaleTijdLabel(g.TI[i],meer),
      code===null?"–":(typeof txt==="function"?txt(code,isDag!==0):"Weercode "+code),
      temp===null?"–":Math.round(temp)+" °C",
      gevoel===null?"–":Math.round(gevoel)+" °C",
      kans===null?"–":Math.round(Math.max(0,Math.min(100,kans)))+"%",
      mm===null?"–":formatMm(mm),
      wind===null?"–":Math.round(wind)+" km/u",
      gust===null?"–":Math.round(gust)+" km/u"
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