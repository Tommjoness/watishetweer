const ENDPOINT="https://anonymous.api.dataplatform.knmi.nl/wms/adaguc-server";
const DATASETS=["radar_forecast_2.0","nl_rdr_data_rtcor_5m"];

function uniek(reeks){return [...new Set(reeks)];}
function decodeXml(s){return String(s).replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'");}

for(const dataset of DATASETS){
  const u=new URL(ENDPOINT);
  u.searchParams.set("DATASET",dataset);
  u.searchParams.set("SERVICE","WMS");
  u.searchParams.set("REQUEST","GetCapabilities");
  u.searchParams.set("VERSION","1.3.0");
  const r=await fetch(u,{headers:{"user-agent":"watishetweer.nl capability validation"},signal:AbortSignal.timeout(10000)});
  const xml=await r.text();
  const names=uniek([...xml.matchAll(/<Name>([\s\S]*?)<\/Name>/gi)].map(m=>decodeXml(m[1].trim()))).filter(Boolean);
  const times=[...xml.matchAll(/<(?:Dimension|Extent)\b[^>]*name=["']time["'][^>]*>([\s\S]*?)<\/(?:Dimension|Extent)>/gi)].map(m=>decodeXml(m[1].trim()));
  console.log("KNMI_CAPABILITIES",JSON.stringify({dataset,status:r.status,contentType:r.headers.get("content-type"),names,timeDimensions:times.slice(0,10),xmlStart:xml.slice(0,300)}));
  if(!r.ok)process.exitCode=1;
}
