"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="/* ===== FINAL RELEASE HARDENING 20260902 ===== */";
const LOAD_HELPER_MARKER="weatherNowCachePastBij";
const GEVOEL_OUD='<th scope="col">Gevoelstemperatuur</th>';
const GEVOEL_NIEUW='<th scope="col" aria-label="Gevoelstemperatuur">Gevoel</th>';

const STYLE=`
${MARKER}
/* Alleen de laatste aantoonbare layoutproblemen: geen redesign. */
.wiw-location-error{display:flex!important;align-items:center;justify-content:space-between;gap:10px 14px;flex-wrap:wrap}
.wiw-location-error p{margin:0;flex:1 1 280px;color:inherit}
.wiw-location-error .wiw-location-retry{flex:0 0 auto;min-height:44px}
.wiw-hour-table th:nth-child(1),.wiw-hour-table td:nth-child(1){width:32%}
.wiw-hour-table th:nth-child(2),.wiw-hour-table td:nth-child(2){width:34%}
.wiw-hour-table th:nth-child(3),.wiw-hour-table td:nth-child(3){width:34%}
@media(min-width:1100px) and (max-width:1599px){
  .dashrow-hero .stats{grid-template-columns:repeat(6,minmax(0,1fr))!important}
  .dashrow-hero .stats .stat{grid-column:span 2;padding-left:14px!important;padding-right:14px!important;border-right:1px solid var(--rule)!important;min-height:118px!important}
  .dashrow-hero .stats .stat:nth-child(3n){border-right:none!important}
  .dashrow-hero .stats .stat:nth-child(7),.dashrow-hero .stats .stat:nth-child(8){grid-column:span 3}
  .dashrow-hero .stats .stat:nth-child(7){border-right:1px solid var(--rule)!important}
  .dashrow-hero .stats .stat:nth-child(8){border-right:none!important}
}
@media(min-width:1600px){
  .dashrow-hero{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}
  .dashrow-hero .stats{grid-template-columns:repeat(4,minmax(0,1fr))!important}
  .dashrow-hero .stats .stat{grid-column:auto!important;padding-left:14px!important;padding-right:14px!important;border-right:1px solid var(--rule)!important;min-height:128px!important}
  .dashrow-hero .stats .stat:nth-child(4n){border-right:none!important}
}
@media(max-width:430px){
  .wiw-location-error{align-items:stretch}
  .wiw-location-error p{flex-basis:100%}
  .wiw-location-error .wiw-location-retry{width:100%}
}
`;

const HELPERS=`
/* Een cache is alleen bruikbaar als hij aantoonbaar bij dezelfde afgeronde
   locatie hoort. KEY_D bewaart drie decimalen; 0,00051 graad is net ruim genoeg
   voor die afronding (maximaal circa 57 meter in breedterichting) en veel
   strenger dan de 0,02 graad die alleen voor plaats-/landcontext wordt gebruikt. */
const WEATHER_CACHE_COORD_TOL=0.00051;
function weatherNowCachePastBij(cache,lat,lon){
  if(!cache)return false;
  const cLat=Number(cache.lat),cLon=Number(cache.lon),rLat=coordOpslag(lat),rLon=coordOpslag(lon);
  return [cLat,cLon,rLat,rLon].every(Number.isFinite)
    &&Math.abs(cLat-rLat)<=WEATHER_CACHE_COORD_TOL
    &&Math.abs(cLon-rLon)<=WEATHER_CACHE_COORD_TOL;
}
function weatherNowLocatieSnapshot(){
  return {lat:S.lat,lon:S.lon,label:S.label,land:S.land,d:S.d,air:S.air,op:S.op,luchtOp:S.luchtOp,
    dag:S.dag,verversMislukt:S.verversMislukt,actieveWaarschuwingen:Array.isArray(S.actieveWaarschuwingen)?S.actieveWaarschuwingen.slice():[]};
}
function weatherNowHerstelLocatie(snapshot){
  if(!snapshot)return;
  S.lat=snapshot.lat;S.lon=snapshot.lon;S.label=snapshot.label;S.land=snapshot.land;
  S.d=snapshot.d;S.air=snapshot.air;S.op=snapshot.op;S.luchtOp=snapshot.luchtOp;
  S.dag=snapshot.dag;S.verversMislukt=snapshot.verversMislukt;
  S.actieveWaarschuwingen=snapshot.actieveWaarschuwingen||[];
}
function weatherNowFoutMetRetry(st,tekst,lat,lon,label,opslaan,land){
  st.style.display="flex";st.className="msg err wiw-location-error";st.replaceChildren();
  const p=document.createElement("p");p.textContent=tekst;
  const knop=document.createElement("button");knop.type="button";knop.className="wiw-location-retry";
  knop.textContent="Opnieuw proberen";
  knop.setAttribute("aria-label","Probeer weergegevens voor "+label+" opnieuw op te halen");
  knop.addEventListener("click",()=>load(lat,lon,label,false,opslaan,land));
  st.append(p,knop);
}
`;

function voegStijlToe(html){
  if(html.includes(MARKER))throw new Error("Final release hardening staat al in artifact.");
  const pos=html.lastIndexOf("</style>");
  if(pos<0)throw new Error("Geen stijlblok gevonden voor final release hardening.");
  return html.slice(0,pos)+STYLE+"\n"+html.slice(pos);
}

function hardenLoad(html){
  let bron=String(html);
  if(bron.includes(LOAD_HELPER_MARKER))throw new Error("Locatie-cachehardening staat al in artifact.");
  const laad=bron.indexOf("async function load(lat,lon,label,stil,opslaan,land){");
  if(laad<0)throw new Error("load()-anker ontbreekt.");
  bron=bron.slice(0,laad)+HELPERS+"\n"+bron.slice(laad);

  const snapshotOud='  const mijnBeurt=++laadTeller;\n  const nieuweLat=Number(lat),nieuweLon=Number(lon);\n  const plaatsWijzigt=S.lat!==nieuweLat||S.lon!==nieuweLon;';
  const snapshotNieuw='  const mijnBeurt=++laadTeller;\n  const nieuweLat=Number(lat),nieuweLon=Number(lon);\n  const vorigeLocatie=weatherNowLocatieSnapshot();\n  const plaatsWijzigt=S.lat!==nieuweLat||S.lon!==nieuweLon;';
  const nSnap=bron.split(snapshotOud).length-1;
  if(nSnap!==1)throw new Error("Snapshotanker verwacht exact één keer; gevonden "+nSnap);
  bron=bron.replace(snapshotOud,snapshotNieuw);

  const ladenOud='  if(!stil){st.style.display="block";st.className="msg";st.textContent="Gegevens ophalen.";}';
  const ladenNieuw='  if(!stil){st.style.display="block";st.className="msg";st.textContent=plaatsWijzigt&&vorigeLocatie&&vorigeLocatie.d&&vorigeLocatie.label\n    ?"Gegevens voor "+label+" ophalen. Tot die klaar zijn, zie je nog de gegevens voor "+vorigeLocatie.label+"."\n    :"Gegevens ophalen.";}';
  const nLoad=bron.split(ladenOud).length-1;
  if(nLoad!==1)throw new Error("Loading-statusanker verwacht exact één keer; gevonden "+nLoad);
  bron=bron.replace(ladenOud,ladenNieuw);

  const loadPos=bron.indexOf("async function load(lat,lon,label,stil,opslaan,land){");
  const catchPos=bron.indexOf("  }catch(err){",loadPos);
  const eindPos=bron.indexOf("\n  chips();\n}",catchPos);
  if(catchPos<0||eindPos<0)throw new Error("Catchgrenzen van load() niet gevonden.");
  const nieuweCatch=`  }catch(err){
    if(mijnBeurt!==laadTeller) return;
    const oud=ls.get(KEY_D,null);
    const offline=typeof navigator!=="undefined"&&navigator.onLine===false;
    const timeout=!!(err&&err.name==="AbortError");
    const foutVoor=offline
      ?"Geen internetverbinding; gegevens voor "+label+" konden niet worden opgehaald."
      :timeout
        ?"Het ophalen van gegevens voor "+label+" duurde te lang."
        :"Gegevens voor "+label+" konden niet worden opgehaald.";
    if(oud&&oud.d&&weatherNowCachePastBij(oud,nieuweLat,nieuweLon)){
      S.d=oud.d;S.air=oud.air;S.label=label;S.lat=nieuweLat;S.lon=nieuweLon;S.op=oud.op;
      S.luchtOp=Number(oud.airOp)||0;S.land=normLand(oud.land)||normLand(land);S.verversMislukt=true;
      document.getElementById("q").value=label;
      tekenAlles();
      document.getElementById("app").style.display="block";
      urlBij();
      const tijd=new Date(oud.op).toLocaleString("nl-NL");
      weatherNowFoutMetRetry(st,foutVoor+" Je ziet de laatst opgehaalde gegevens voor "+label+" van "+tijd+".",nieuweLat,nieuweLon,label,opslaan,land);
    }else if(vorigeLocatie&&vorigeLocatie.d&&Number.isFinite(Number(vorigeLocatie.lat))&&Number.isFinite(Number(vorigeLocatie.lon))){
      weatherNowHerstelLocatie(vorigeLocatie);
      document.getElementById("q").value=String(vorigeLocatie.label||"");
      tekenAlles();
      document.getElementById("app").style.display="block";
      urlBij();
      weatherNowFoutMetRetry(st,foutVoor+" Je ziet weer de gegevens voor "+vorigeLocatie.label+".",nieuweLat,nieuweLon,label,opslaan,land);
    }else{
      S.d=null;S.air=null;S.label=label;S.lat=nieuweLat;S.lon=nieuweLon;S.land=normLand(land);
      S.verversMislukt=true;S.dag=null;S.actieveWaarschuwingen=[];
      document.getElementById("q").value=label;
      document.getElementById("app").style.display="none";
      document.title=label+" · Wat is het weer?";
      weatherNowFoutMetRetry(st,foutVoor+" Er worden geen weergegevens van een andere locatie getoond.",nieuweLat,nieuweLon,label,opslaan,land);
    }
  }
`;
  bron=bron.slice(0,catchPos)+nieuweCatch+bron.slice(eindPos);
  return bron;
}

function pasToe(pad){
  let html=fs.readFileSync(pad,"utf8");
  if(!html.includes("WeatherNowFinalDesktopUI20260902")||!html.includes("async function load(lat,lon,label,stil,opslaan,land){"))return false;
  html=hardenLoad(html);
  const gevoelAantal=html.split(GEVOEL_OUD).length-1;
  if(gevoelAantal!==1)throw new Error(path.basename(pad)+": Gevoelstemperatuurkop verwacht exact één keer; gevonden "+gevoelAantal);
  html=html.replace(GEVOEL_OUD,GEVOEL_NIEUW);
  html=voegStijlToe(html);
  const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach((bron,i)=>new vm.Script(bron,{filename:path.basename(pad)+":final-release-"+(i+1)}));
  fs.writeFileSync(pad,html,"utf8");
  return true;
}

function htmlBestanden(dir){
  const uit=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())uit.push(...htmlBestanden(p));
    else if(e.isFile()&&e.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function main(){
  let n=0;
  for(const p of htmlBestanden(OUT))if(pasToe(p))n++;
  if(!n)throw new Error("Geen weerartifacts gevonden voor final release hardening.");
  const cache=vernieuwServiceworkerCache(OUT,"final-release-hardening-20260902");
  console.log(`Final release hardening toegepast op ${n} weerpagina's: cache-identiteit geborgd, retry-state toegevoegd, uurkop ingekort en desktopgrid uitgebalanceerd; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,MARKER,STYLE,HELPERS,GEVOEL_OUD,GEVOEL_NIEUW,hardenLoad,voegStijlToe,pasToe,main};
