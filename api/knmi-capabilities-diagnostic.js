const BASIS="https://anonymous.api.dataplatform.knmi.nl/wms/adaguc-server";

export default {
  async fetch(request) {
    const url=new URL(request.url);
    const service=String(url.searchParams.get("service")||"WCS").toUpperCase();
    const operation=String(url.searchParams.get("request")||"GetCapabilities");
    const upstream=new URL(BASIS);
    upstream.searchParams.set("DATASET","radar_forecast_2.0");
    upstream.searchParams.set("SERVICE",service);
    upstream.searchParams.set("REQUEST",operation);
    upstream.searchParams.set("VERSION",service==="WCS"?"1.0.0":"1.3.0");
    if(operation==="DescribeCoverage"||operation==="GetCoverage")upstream.searchParams.set("COVERAGE",url.searchParams.get("coverage")||"precipitation_nowcast");
    for(const naam of ["CRS","BBOX","WIDTH","HEIGHT","FORMAT","TIME","DIM_forecast_reference_time"]){
      const waarde=url.searchParams.get(naam)||url.searchParams.get(naam.toLowerCase());
      if(waarde)upstream.searchParams.set(naam,waarde);
    }
    const response=await fetch(upstream,{headers:{"Accept":"application/xml,text/xml;q=0.9,*/*;q=0.1","User-Agent":"watishetweer.nl-diagnostiek/1.0"}});
    const body=await response.text();
    return Response.json({ok:response.ok,status:response.status,contentType:response.headers.get("content-type"),url:upstream.toString(),body},{status:200,headers:{"Cache-Control":"no-store"}});
  }
};
