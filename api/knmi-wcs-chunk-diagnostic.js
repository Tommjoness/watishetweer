const BASIS="https://anonymous.api.dataplatform.knmi.nl/wms/adaguc-server";

function basis(){
  const u=new URL(BASIS);
  u.searchParams.set("DATASET","radar_forecast_2.0");
  return u;
}

function refUitXml(xml){
  const laag=String(xml||"").match(/<Dimension\b[^>]*name=["']forecast_reference_time["'][^>]*default=["']([^"']+)/i)
    ||String(xml||"").match(/<Dimension\b[^>]*name=["']reference_time["'][^>]*default=["']([^"']+)/i);
  return laag&&laag[1]||null;
}

function iso(ms){return new Date(ms).toISOString().replace(/\.000Z$/,"Z");}

async function probeer(ref,lat,lon,aantal){
  const start=Date.now(),refMs=Date.parse(ref),eind=iso(refMs+(aantal-1)*5*60000);
  const u=basis();
  for(const [k,v] of Object.entries({SERVICE:"WCS",REQUEST:"GetCoverage",VERSION:"1.0.0",COVERAGE:"precipitation_nowcast",CRS:"EPSG:4326",BBOX:[lon-.01,lat-.01,lon+.01,lat+.01].join(","),WIDTH:"2",HEIGHT:"2",FORMAT:"NetCDF3",TIME:aantal===1?ref:ref+"/"+eind,DIM_forecast_reference_time:ref}))u.searchParams.set(k,v);
  try{
    const r=await fetch(u,{headers:{Accept:"application/x-netcdf,application/octet-stream;q=0.9,*/*;q=0.1","User-Agent":"watishetweer.nl-wcs-validatie/1.0"},signal:AbortSignal.timeout(12000)});
    const buf=Buffer.from(await r.arrayBuffer());
    return {aantal,status:r.status,ok:r.ok,ms:Date.now()-start,bytes:buf.length,type:r.headers.get("content-type"),magic:buf.subarray(0,4).toString("hex"),begin:buf.subarray(0,120).toString("base64")};
  }catch(e){return {aantal,ok:false,ms:Date.now()-start,fout:String(e&&e.message||e)};}
}

export default {
  async fetch(request){
    const q=new URL(request.url).searchParams,lat=Number(q.get("lat")||52.35),lon=Number(q.get("lon")||5.26);
    const cap=basis();
    for(const [k,v] of Object.entries({SERVICE:"WMS",REQUEST:"GetCapabilities",VERSION:"1.3.0"}))cap.searchParams.set(k,v);
    const xml=await (await fetch(cap,{signal:AbortSignal.timeout(8000)})).text();
    const ref=refUitXml(xml);
    const resultaten=ref?await Promise.all([1,2,3,5,7].map(n=>probeer(ref,lat,lon,n))):[];
    return Response.json({ref,resultaten},{headers:{"Cache-Control":"no-store"}});
  }
};
