"use strict";

/* Gedeeld servercontract voor Nominatim-compatible reverse geocoding.
   Eén configuratie-eigenaar voorkomt dat plaatsnaam- en waarschuwingroutes elk
   een eigen hardcoded providerhost of afwijkende URL-validatie krijgen. */
const STANDAARD_NOMINATIM_BASIS="https://nominatim.openstreetmap.org";
const NOMINATIM_UA="WatIsHetWeer/1.0 (watishetweer.nl; contact via github.com/Tommjoness/weathernow)";

function nominatimBasisUrl(){
  const ingesteld=String(process.env.NOMINATIM_BASE_URL||"").trim();
  if(!ingesteld)return STANDAARD_NOMINATIM_BASIS;

  let u;
  try{u=new URL(ingesteld);}catch(_){throw new Error("NOMINATIM_BASE_URL is geen geldige URL");}
  const localhost=u.hostname==="localhost"||u.hostname==="127.0.0.1"||u.hostname==="::1";
  if(u.protocol!=="https:"&&!(localhost&&u.protocol==="http:")){
    throw new Error("NOMINATIM_BASE_URL moet HTTPS gebruiken");
  }
  if(u.username||u.password||u.search||u.hash){
    throw new Error("NOMINATIM_BASE_URL mag geen login, query of fragment bevatten");
  }
  u.pathname=u.pathname.replace(/\/+$/,"");
  return u.toString().replace(/\/$/,"");
}

function reverseUrl(lat,lon,opt={}){
  const u=new URL(nominatimBasisUrl()+"/reverse");
  u.searchParams.set("format","jsonv2");
  u.searchParams.set("lat",String(lat));
  u.searchParams.set("lon",String(lon));
  u.searchParams.set("zoom",String(opt.zoom==null?12:opt.zoom));
  u.searchParams.set("accept-language",String(opt.language||"nl"));
  return u.toString();
}

module.exports={STANDAARD_NOMINATIM_BASIS,NOMINATIM_UA,nominatimBasisUrl,reverseUrl};
