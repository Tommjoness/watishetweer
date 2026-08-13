/* Gedeelde URL-plaatsidentiteit.
   Een plaatsnaam uit de query is metadata van de afzender, geen bewijs van de
   locatie. Geldige gedeelde coördinaten worden daarom reverse-geocoded voordat
   de bestaande centrale load-grens ze als zichtbare plaatsidentiteit ontvangt. */
(function(root){
"use strict";

const canoniekeNaam=v=>typeof v==="string"&&v.trim()?v.trim():null;
const api={canoniekeNaam};
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
    const q=document.getElementById("q");
    if(q)q.value=naam;
    try{
      const g=await j("/api/plaatsnaam?lat="+gedeeld.latitude.toFixed(4)+"&lon="+gedeeld.longitude.toFixed(4),{timeoutMs:2500});
      naam=canoniekeNaam(g&&g.naam)||naam;
    }catch(_){ }

    /* Tijdens de reverse-geocode kan de gebruiker zelf een nieuwe plaats kiezen.
       De vertraagde gedeelde startup mag die nieuwere keuze nooit overschrijven. */
    if(beurt!==generatie)return false;
    if(q)q.value=naam;
    return basisLoad(gedeeld.latitude,gedeeld.longitude,naam,stil,opslaan,land);
  }

  return basisLoad(lat,lon,label,stil,opslaan,land);
};

})(typeof globalThis!=="undefined"?globalThis:this);
