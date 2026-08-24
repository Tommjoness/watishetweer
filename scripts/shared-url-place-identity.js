/* Gedeelde URL-plaatsidentiteit.
   Coördinaten blijven de autoriteit. Een meegestuurde naam blijft alleen staan
   wanneer een onafhankelijke voorwaartse geocode die naam op vrijwel dezelfde
   plek vindt. Zo blijft "Tokio" herkenbaar, maar wordt een gespoofte naam als
   "Amsterdam" bij coördinaten van New York verworpen. */
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
async function valideerGedeeldeNaam(naam,lat,lon,opt){
  const n=canoniekeNaam(naam);
  if(!n)return null;
  const timeoutMs=opt&&Number.isFinite(opt.timeoutMs)?opt.timeoutMs:2500;
  /* Houd de centrale zoek-URL-owner uniek; j() past op runtime hetzelfde
     deduplicatie-, fallbacktaal- en timeoutbeleid toe als bij handmatig zoeken. */
  const d=await j("https://geocoding-api.open-meteo.com"+"/v1/search?name="+encodeURIComponent(n)+"&count=12&language=nl&format=json",{timeoutMs});
  return naamPastBijCoordinaten(d&&d.results,lat,lon,opt&&opt.maxKm)?n:null;
}
async function plaatsnaamUitCoordinaten(lat,lon,opt){
  const la=Number(lat),lo=Number(lon);
  if(!Number.isFinite(la)||la< -90||la>90||!Number.isFinite(lo)||lo< -180||lo>180)return null;
  const timeoutMs=opt&&Number.isFinite(opt.timeoutMs)?opt.timeoutMs:10000;
  return j("/api/plaatsnaam?lat="+la.toFixed(4)+"&lon="+lo.toFixed(4),{timeoutMs});
}
const api={canoniekeNaam,afstandKm,naamPastBijCoordinaten,valideerGedeeldeNaam,plaatsnaamUitCoordinaten};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowSharedUrlPlaceIdentity=api;

if(typeof document==="undefined"||typeof j!=="function"||typeof load!=="function")return;

const basisLoad=load;
let generatie=0;
load=async function(lat,lon,label,stil,opslaan,land){
  const beurt=++generatie;
  const hard=root.WeatherNowGlobalLocationHardening;
  const gedeeld=stil!==true&&opslaan===false&&hard&&typeof hard.gedeeldeUrlCoordinaten==="function"&&typeof location!=="undefined"
    ?hard.gedeeldeUrlCoordinaten(location.search):null;

  if(gedeeld&&gedeeld.aanwezig&&gedeeld.geldig){
    let naam="Gedeelde locatie";
    let meegestuurd=null;
    try{meegestuurd=canoniekeNaam(new URLSearchParams(location.search).get("plaats"));}catch(_){ }
    const q=document.getElementById("q");
    if(q)q.value=naam;
    try{
      const [gevalideerd,g]=await Promise.all([
        valideerGedeeldeNaam(meegestuurd,gedeeld.latitude,gedeeld.longitude,{timeoutMs:2500,maxKm:30}).catch(()=>null),
        plaatsnaamUitCoordinaten(gedeeld.latitude,gedeeld.longitude,{timeoutMs:2500}).catch(()=>null)
      ]);
      naam=gevalideerd||canoniekeNaam(g&&g.naam)||naam;
    }catch(_){ }
    if(beurt!==generatie)return false;
    if(q)q.value=naam;
    return basisLoad(gedeeld.latitude,gedeeld.longitude,naam,stil,opslaan,land);
  }

  return basisLoad(lat,lon,label,stil,opslaan,land);
};

})(typeof globalThis!=="undefined"?globalThis:this);
