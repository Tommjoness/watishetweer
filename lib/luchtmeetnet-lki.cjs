"use strict";

const BASIS_URL="https://api.luchtmeetnet.nl/open_api/concentrations";
const MAX_OUD_MS=3*60*60*1000;
const TOEKOMST_MARGE_MS=5*60*1000;
const CACHE_TTL_MS=5*60*1000;
const CACHE_MAX=64;
const cache=new Map();

function coord(v){
  if(v==null||String(v).trim()==="")return NaN;
  return Number(v);
}
function geldigeCoord(lat,lon){
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
}
function landcode(v){
  const s=String(v||"").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s)?s:"";
}
function cacheSleutel(lat,lon){return Number(lat).toFixed(3)+","+Number(lon).toFixed(3);}
function cacheLees(sleutel,nuMs){
  const item=cache.get(sleutel);
  if(!item)return null;
  if(nuMs-item.opgeslagenOp>=CACHE_TTL_MS){cache.delete(sleutel);return null;}
  return item.waarde;
}
function cacheSchrijf(sleutel,waarde,nuMs){
  if(cache.size>=CACHE_MAX&&!cache.has(sleutel))cache.delete(cache.keys().next().value);
  cache.set(sleutel,{waarde,opgeslagenOp:nuMs});
}
function leegCache(){cache.clear();}

function parseLki(payload,nuMs){
  const rijen=payload&&Array.isArray(payload.data)?payload.data:[];
  const uitersteToekomst=nuMs+TOEKOMST_MARGE_MS;
  const oudste=nuMs-MAX_OUD_MS;
  return rijen
    .map(r=>{
      const formule=String(r&&r.formula||"").trim().toUpperCase();
      const waarde=Number(r&&r.value);
      const tijdMs=Date.parse(r&&r.timestamp_measured);
      return {formule,waarde,tijdMs,timestamp:r&&r.timestamp_measured};
    })
    .filter(r=>r.formule==="LKI"&&Number.isFinite(r.waarde)&&r.waarde>=1&&r.waarde<=11
      &&Number.isFinite(r.tijdMs)&&r.tijdMs>=oudste&&r.tijdMs<=uitersteToekomst)
    .sort((a,b)=>b.tijdMs-a.tijdMs)[0]||null;
}

async function haalLki({lat,lon,land,fetchImpl=fetch,nuMs=Date.now(),timeoutMs=4000}){
  const y=coord(lat),x=coord(lon),cc=landcode(land);
  if(!geldigeCoord(y,x))return {beschikbaar:false,provider:null,reden:"ongeldige coördinaten"};
  if(cc!=="NL")return {beschikbaar:false,provider:null,reden:"geen Nederlandse LKI voor deze locatie"};

  const sleutel=cacheSleutel(y,x);
  const hit=cacheLees(sleutel,nuMs);
  if(hit)return {...hit,cache:"memory"};

  const url=new URL(BASIS_URL);
  url.searchParams.set("formula","lki");
  url.searchParams.set("latitude",String(y));
  url.searchParams.set("longitude",String(x));

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetchImpl(url.toString(),{
      method:"GET",
      headers:{"Accept":"application/json"},
      signal:controller.signal
    });
    if(!response||!response.ok)throw new Error("Luchtmeetnet HTTP "+String(response&&response.status||0));
    const payload=await response.json();
    const rij=parseLki(payload,nuMs);
    if(!rij)return {beschikbaar:false,provider:"luchtmeetnet",reden:"geen verse Nederlandse LKI beschikbaar"};
    const resultaat={
      beschikbaar:true,
      provider:"luchtmeetnet",
      bron:"RIVM / Luchtmeetnet",
      type:"actuele_lki",
      lki:Math.max(1,Math.min(11,Math.round(rij.waarde))),
      lkiRaw:rij.waarde,
      schaal:"Nederlandse LKI 1–11",
      geldigOp:new Date(rij.tijdMs).toISOString(),
      opgehaaldOp:new Date(nuMs).toISOString(),
      cache:"miss"
    };
    cacheSchrijf(sleutel,resultaat,nuMs);
    return resultaat;
  }catch(error){
    return {
      beschikbaar:false,
      provider:"luchtmeetnet",
      reden:error&&error.name==="AbortError"?"Luchtmeetnet timeout":"Luchtmeetnet tijdelijk niet beschikbaar"
    };
  }finally{clearTimeout(timer);}
}

module.exports={
  haalLki,
  _intern:{
    BASIS_URL,MAX_OUD_MS,TOEKOMST_MARGE_MS,CACHE_TTL_MS,CACHE_MAX,
    coord,geldigeCoord,landcode,cacheSleutel,parseLki,leegCache
  }
};
