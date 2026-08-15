"use strict";

const BASIS="https://anonymous.api.dataplatform.knmi.nl/wms/adaguc-server";
const DATASET="radar_forecast_2.0";
const LAAG="precipitation_nowcast";

function url(request,version="1.1.1"){
  const u=new URL(BASIS);
  u.searchParams.set("DATASET",DATASET);
  u.searchParams.set("SERVICE","WMS");
  u.searchParams.set("REQUEST",request);
  u.searchParams.set("VERSION",version);
  return u;
}
async function tekst(u,accept){
  const r=await fetch(u,{headers:{Accept:accept,"User-Agent":"watishetweer.nl-audit/1.0"}});
  const t=await r.text();
  if(!r.ok)throw new Error(`${u.searchParams.get("REQUEST")} ${r.status}: ${t.slice(0,500)}`);
  return t;
}
function refUit(xml){
  for(const m of String(xml).matchAll(/<(?:Dimension|Extent)\b([^>]*)>/gi)){
    if(!/\bname=["']reference_time["']/i.test(m[1]||""))continue;
    const d=/\bdefault=["']([^"']+)["']/i.exec(m[1]||"");
    if(d&&Number.isFinite(Date.parse(d[1])))return d[1];
  }
  return null;
}
function eind(ref){return new Date(Date.parse(ref)+120*60000).toISOString().replace(/\.000Z$/,"Z");}
function reeks(payload,ref){
  const item=Array.isArray(payload)&&payload[0];
  const data=item&&item.data&&(item.data[ref]||Object.values(item.data)[0]);
  return {
    point:item&&item.point,
    units:item&&item.units,
    waarden:Object.entries(data||{}).map(([tijd,waarde])=>({tijd,waarde:Number(waarde)})).filter(p=>Number.isFinite(p.waarde)&&p.waarde!==0)
  };
}
async function getPoint(lat,lon,ref){
  const u=url("GetPointValue");
  u.searchParams.set("SRS","EPSG:4326");
  u.searchParams.set("QUERY_LAYERS",LAAG);
  u.searchParams.set("X",lon.toFixed(5));u.searchParams.set("Y",lat.toFixed(5));
  u.searchParams.set("INFO_FORMAT","application/json");
  u.searchParams.set("time",ref+"/"+eind(ref));u.searchParams.set("DIM_reference_time",ref);
  return reeks(JSON.parse(await tekst(u,"application/json")),ref);
}
async function getFeatureInfo(lat,lon,ref){
  const delta=0.05;
  const u=url("GetFeatureInfo");
  u.searchParams.set("SRS","EPSG:4326");
  u.searchParams.set("LAYERS",LAAG);u.searchParams.set("QUERY_LAYERS",LAAG);
  u.searchParams.set("BBOX",[lon-delta,lat-delta,lon+delta,lat+delta].join(","));
  u.searchParams.set("WIDTH","101");u.searchParams.set("HEIGHT","101");
  u.searchParams.set("X","50");u.searchParams.set("Y","50");
  u.searchParams.set("INFO_FORMAT","application/json");
  u.searchParams.set("time",ref+"/"+eind(ref));u.searchParams.set("DIM_reference_time",ref);
  return reeks(JSON.parse(await tekst(u,"application/json")),ref);
}

(async()=>{
  const cap=url("GetCapabilities","1.3.0");
  const ref=refUit(await tekst(cap,"text/xml"));
  if(!ref)throw new Error("reference_time ontbreekt");
  console.log("REFERENCE",ref);
  for(const [naam,lat,lon] of [
    ["Amsterdam",52.3676,4.9041],
    ["Utrecht",52.0907,5.1214],
    ["Dronten",52.5250,5.7180],
    ["Maastricht",50.8514,5.6910],
    ["Brussel",50.8503,4.3517]
  ]){
    const point=await getPoint(lat,lon,ref);await new Promise(r=>setTimeout(r,1100));
    const feature=await getFeatureInfo(lat,lon,ref);await new Promise(r=>setTimeout(r,1100));
    console.log("VERGELIJK",JSON.stringify({naam,lat,lon,point,feature}));
  }
})().catch(e=>{console.error(e&&e.stack||e);process.exitCode=1;});
