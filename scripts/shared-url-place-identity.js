/* Gedeelde URL-plaatsidentiteit.
   Eén eigendomsregel voor de zichtbare naam:
   expliciete gebruikers-/URL-naam > opgeslagen/history-naam > reverse fallback.
   Reverse geocoding mag dus metadata aanvullen of een naam leveren wanneer er
   géén expliciete naam bestaat, maar mag een expliciete identiteit nooit
   stilzwijgend vervangen. */
(function(root){
"use strict";

const canoniekeNaam=v=>typeof v==="string"&&v.trim()?v.trim():null;
function afstandKm(aLat,aLon,bLat,bLon){
  const waarden=[aLat,aLon,bLat,bLon].map(Number);
  if(!waarden.every(Number.isFinite))return Infinity;
  const [la1,lo1,la2,lo2]=waarden.map(x=>x*Math.PI/180),dLat=la2-la1,dLon=lo2-lo1;
  const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
function naamPastBijCoordinaten(resultaten,lat,lon,maxKm){
  const grens=Number.isFinite(maxKm)?maxKm:30;
  return Array.isArray(resultaten)&&resultaten.some(r=>r&&afstandKm(lat,lon,r.latitude,r.longitude)<=grens);
}
/* Behouden als diagnostische/helper-API voor bestaande tests en tooling. Deze
   forward-geocode mag niet meer de zichtbare expliciete URL-naam bezitten. */
async function valideerGedeeldeNaam(naam,lat,lon,opt){
  const n=canoniekeNaam(naam);
  if(!n)return null;
  const timeoutMs=opt&&Number.isFinite(opt.timeoutMs)?opt.timeoutMs:2500;
  const d=await j("https://geocoding-api.open-meteo.com"+"/v1/search?name="+encodeURIComponent(n)+"&count=12&language=nl&format=json",{timeoutMs});
  return naamPastBijCoordinaten(d&&d.results,lat,lon,opt&&opt.maxKm)?n:null;
}
async function plaatsnaamUitCoordinaten(lat,lon,opt){
  const la=Number(lat),lo=Number(lon);
  if(!Number.isFinite(la)||la< -90||la>90||!Number.isFinite(lo)||lo< -180||lo>180)return null;
  const timeoutMs=opt&&Number.isFinite(opt.timeoutMs)?opt.timeoutMs:10000;
  return j("/api/plaatsnaam?lat="+la.toFixed(4)+"&lon="+lo.toFixed(4),{timeoutMs});
}
function urlLocatie(search){
  try{
    const p=new URLSearchParams(String(search||""));
    const lat=Number(p.get("lat")),lon=Number(p.get("lon"));
    if(!Number.isFinite(lat)||lat< -90||lat>90||!Number.isFinite(lon)||lon< -180||lon>180)return null;
    return {lat,lon,naam:canoniekeNaam(p.get("plaats")),land:/^[A-Z]{2}$/.test(String(p.get("land")||"").toUpperCase())?String(p.get("land")).toUpperCase():null};
  }catch(_){return null;}
}
function zelfdeLocatie(a,b){
  return !!a&&!!b&&Math.abs(Number(a.lat)-Number(b.lat))<0.000001&&Math.abs(Number(a.lon)-Number(b.lon))<0.000001&&canoniekeNaam(a.naam)===canoniekeNaam(b.naam)&&(a.land||null)===(b.land||null);
}
const api={canoniekeNaam,afstandKm,naamPastBijCoordinaten,valideerGedeeldeNaam,plaatsnaamUitCoordinaten,urlLocatie,zelfdeLocatie};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowSharedUrlPlaceIdentity=api;

if(typeof document==="undefined"||typeof j!=="function"||typeof load!=="function")return;

const basisLoad=load;
let generatie=0,historyNavigatie=0;
function snapshot(){
  try{
    return S&&S.d&&Number.isFinite(Number(S.lat))&&Number.isFinite(Number(S.lon))
      ?{lat:Number(S.lat),lon:Number(S.lon),naam:canoniekeNaam(S.label),land:typeof normLand==="function"?normLand(S.land):S.land||null}
      :null;
  }catch(_){return null;}
}
function stateVoor(loc,opslaan){
  return {weatherLocation:{lat:Number(loc.lat),lon:Number(loc.lon),plaats:canoniekeNaam(loc.naam)||"Gedeelde locatie",land:loc.land||null,opslaan:opslaan!==false}};
}
function schrijfHistoryNaSucces(voorHref,voorState,voorLoc,naLoc,opslaan,stil){
  if(typeof history==="undefined"||typeof location==="undefined"||!naLoc)return;
  const naHref=location.href,nieuweState=stateVoor(naLoc,opslaan);
  if(historyNavigatie>0){history.replaceState(nieuweState,"",naHref);return;}
  const echteKeuze=!!voorLoc&&stil!==true&&opslaan!==false&&voorHref!==naHref&&!zelfdeLocatie(voorLoc,naLoc);
  if(echteKeuze){
    history.replaceState(voorState||stateVoor(voorLoc,true),"",voorHref);
    history.pushState(nieuweState,"",naHref);
  }else{
    history.replaceState(nieuweState,"",naHref);
  }
}
function vulLandOpAchtergrond(beurt,lat,lon){
  plaatsnaamUitCoordinaten(lat,lon,{timeoutMs:2500}).then(g=>{
    if(beurt!==generatie||!g||!g.land)return;
    let gelijk=false,heeftLand=false;
    try{
      gelijk=Math.abs(Number(S.lat)-Number(lat))<0.000001&&Math.abs(Number(S.lon)-Number(lon))<0.000001;
      heeftLand=!!(typeof normLand==="function"?normLand(S.land):S.land);
    }catch(_){return;}
    if(!gelijk||heeftLand)return;
    try{
      if(typeof onthoudLand==="function")onthoudLand(g.land);
      else S.land=typeof normLand==="function"?normLand(g.land):g.land;
      if(typeof urlBij==="function")urlBij();
    }catch(_){ }
  }).catch(()=>{});
}

load=async function(lat,lon,label,stil,opslaan,land){
  const beurt=++generatie;
  const voorHref=typeof location!=="undefined"?location.href:"";
  const voorState=typeof history!=="undefined"?history.state:null;
  const voorLoc=snapshot();
  const hard=root.WeatherNowGlobalLocationHardening;
  const gedeeld=stil!==true&&opslaan===false&&hard&&typeof hard.gedeeldeUrlCoordinaten==="function"&&typeof location!=="undefined"
    ?hard.gedeeldeUrlCoordinaten(location.search):null;

  if(gedeeld&&gedeeld.aanwezig&&gedeeld.geldig){
    let meegestuurd=null;
    try{meegestuurd=canoniekeNaam(new URLSearchParams(location.search).get("plaats"));}catch(_){ }
    let naam=meegestuurd;
    let doelLand=land;
    /* Alleen wanneer géén expliciete identiteit bestaat, mag reverse geocoding
       de zichtbare naam bepalen. Een expliciete naam start de forecast direct;
       ontbrekende landmetadata wordt desgewenst los en niet-blokkerend gevuld. */
    if(!naam){
      try{
        const g=await plaatsnaamUitCoordinaten(gedeeld.latitude,gedeeld.longitude,{timeoutMs:2500});
        if(beurt!==generatie)return false;
        naam=canoniekeNaam(g&&g.naam)||"Gedeelde locatie";
        if(!doelLand&&g&&g.land)doelLand=g.land;
      }catch(_){naam="Gedeelde locatie";}
    }else if(!doelLand){
      vulLandOpAchtergrond(beurt,gedeeld.latitude,gedeeld.longitude);
    }
    if(beurt!==generatie)return false;
    const q=document.getElementById("q");if(q)q.value=naam;
    const result=await basisLoad(gedeeld.latitude,gedeeld.longitude,naam,stil,opslaan,doelLand);
    if(beurt!==generatie)return result;
    schrijfHistoryNaSucces(voorHref,voorState,voorLoc,snapshot(),opslaan,stil);
    return result;
  }

  const result=await basisLoad(lat,lon,label,stil,opslaan,land);
  if(beurt===generatie)schrijfHistoryNaSucces(voorHref,voorState,voorLoc,snapshot(),opslaan,stil);
  return result;
};

if(typeof addEventListener==="function")addEventListener("popstate",event=>{
  const doel=urlLocatie(typeof location!=="undefined"?location.search:"");
  if(!doel)return;
  const uitState=event&&event.state&&event.state.weatherLocation;
  const naam=canoniekeNaam(uitState&&uitState.plaats)||doel.naam||"Gedeelde locatie";
  const land=(uitState&&uitState.land)||doel.land||null;
  const opslaan=!(uitState&&uitState.opslaan===false);
  historyNavigatie++;
  Promise.resolve(load(doel.lat,doel.lon,naam,false,opslaan,land)).finally(()=>{historyNavigatie=Math.max(0,historyNavigatie-1);});
});

})(typeof globalThis!=="undefined"?globalThis:this);