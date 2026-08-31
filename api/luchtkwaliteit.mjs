import providerHandler from "../lib/luchtkwaliteit.cjs";

function methodeNietToegestaan(){
  const headers=new Headers({
    "Allow":"GET, HEAD",
    "Cache-Control":"private, no-store",
    "Content-Type":"application/json; charset=utf-8"
  });
  return new Response(JSON.stringify({beschikbaar:false,provider:null,reden:"methode niet toegestaan"}),{status:405,headers});
}

export default {
  async fetch(request){
    const method=String(request.method||"GET").toUpperCase();
    if(method!=="GET"&&method!=="HEAD")return methodeNietToegestaan();

    const url=new URL(request.url);
    const query=Object.fromEntries(url.searchParams.entries());
    let statusCode=200,body=null;
    const headers=new Headers();
    const response={
      setHeader(name,value){headers.set(name,String(value));},
      status(code){statusCode=Number(code);return response;},
      json(value){body=value;return response;}
    };
    try{
      await providerHandler({query},response);
    }catch(error){
      console.error("[api/luchtkwaliteit] onverwachte serverfout",error);
      statusCode=503;
      body={beschikbaar:false,provider:"luchtmeetnet",reden:"luchtkwaliteitsservice tijdelijk niet beschikbaar"};
    }
    if(body&&body.reden==="ongeldige coördinaten")statusCode=400;
    if(statusCode>=400){
      headers.set("Cache-Control","private, no-store");
      headers.delete("Cloudflare-CDN-Cache-Control");
    }else{
      const internCache=headers.get("Cache-Control");
      if(internCache)headers.set("Cloudflare-CDN-Cache-Control",internCache);
      headers.set("Cache-Control","public, max-age=0, must-revalidate");
    }
    headers.set("Content-Type","application/json; charset=utf-8");
    return new Response(method==="HEAD"?null:JSON.stringify(body),{status:statusCode,headers});
  }
};
