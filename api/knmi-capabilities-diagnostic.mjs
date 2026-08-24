const BASIS="https://anonymous.api.dataplatform.knmi.nl/wms/adaguc-server";

export default {
  async fetch(request) {
    const url=new URL(request.url);
    const service=String(url.searchParams.get("service")||"WCS").toUpperCase();
    const upstream=new URL(BASIS);
    upstream.searchParams.set("DATASET","radar_forecast_2.0");
    upstream.searchParams.set("SERVICE",service);
    upstream.searchParams.set("REQUEST","GetCapabilities");
    upstream.searchParams.set("VERSION",service==="WCS"?"1.0.0":"1.3.0");
    const response=await fetch(upstream,{headers:{"Accept":"application/xml,text/xml;q=0.9,*/*;q=0.1","User-Agent":"watishetweer.nl-diagnostiek/1.0"}});
    const body=await response.text();
    return new Response(body,{status:response.status,headers:{"Content-Type":response.headers.get("content-type")||"text/plain; charset=utf-8","Cache-Control":"no-store"}});
  }
};
