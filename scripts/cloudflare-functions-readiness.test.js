"use strict";

const assert=require("assert");
const {
  ROUTES,
  geldigeRoot,
  routeIsGereed,
  probeer,
  wachtTotGereed,
  readinessTimeoutMs
}=require("./cloudflare-functions-readiness.js");

function antwoord(status,body){
  return {status,async text(){return typeof body==="string"?body:JSON.stringify(body);}};
}

(async()=>{
  assert.deepStrictEqual(ROUTES.map(x=>x.naam),["plaatsnaam","neerslag","waarschuwingen"],"readiness moet alle drie productie-API's afwachten");
  assert(ROUTES.some(x=>x.pad.startsWith("/api/neerslag?")),"neerslagroute ontbreekt uit readiness");
  assert(ROUTES.some(x=>x.pad.startsWith("/api/waarschuwingen?")),"waarschuwingenroute ontbreekt uit readiness");

  assert.equal(geldigeRoot("https://abc123.watishetweer.pages.dev/"),"https://abc123.watishetweer.pages.dev");
  assert.throws(()=>geldigeRoot("https://watishetweer.nl"),/pages\.dev-deployment/);

  assert.equal(routeIsGereed(200,'{"ok":true}'),true,"200 + JSON is gereed");
  assert.equal(routeIsGereed(503,'{"beschikbaar":false}'),true,"providerdegradatie mag readiness niet blokkeren als de Function bestaat");
  assert.equal(routeIsGereed(404,'{"error":"not found"}'),false,"404 moet readiness blokkeren");
  assert.equal(routeIsGereed(200,"geen json"),false,"niet-JSON moet readiness blokkeren");

  const gezien=[];
  const allesGroen=await probeer("https://test.watishetweer.pages.dev",1,async url=>{
    gezien.push(url);
    return antwoord(200,{ok:true});
  });
  assert.equal(allesGroen,true,"alle drie geldige routes moeten readiness groen maken");
  assert.equal(gezien.length,3,"iedere poging moet alle drie routes controleren");
  assert(gezien.some(url=>url.includes("/api/neerslag?")),"neerslag moet live worden gecontroleerd");

  const een404=await probeer("https://test.watishetweer.pages.dev",2,async url=>{
    return url.includes("/api/neerslag?")?antwoord(404,{error:"not found"}):antwoord(200,{ok:true});
  });
  assert.equal(een404,false,"één ontbrekende Function moet de deployment tegenhouden");

  let klok=0;
  let pogingen=0;
  await assert.rejects(
    ()=>wachtTotGereed(
      "https://test.watishetweer.pages.dev",
      async()=>{pogingen+=1;return antwoord(404,{error:"not found"});},
      ()=>klok,
      async ms=>{klok+=ms;}
    ),
    /nog niet alle drie gereed/,
    "readiness moet begrensd falen als een route niet actief wordt"
  );
  assert.equal(klok,readinessTimeoutMs,"timeout moet exact binnen het afgesproken 90s-venster blijven");
  assert(pogingen>=3,"readiness moet opnieuw proberen vóór hij opgeeft");

  console.log("Cloudflare Functions-readiness: drie API-routes, 404-blokkade, degradatie en timeout geslaagd.");
})().catch(error=>{console.error(error&&error.stack||error);process.exit(1);});
