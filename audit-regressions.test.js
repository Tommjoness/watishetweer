"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const ROOT=__dirname;
const PUBLIC=path.join(ROOT,"public");
let geslaagd=0;

function ok(voorwaarde,naam){
  assert.ok(voorwaarde,naam);
  geslaagd++;
  console.log("OK  "+naam);
}

/* Productie-uitvoer: interne test- en bouwbestanden mogen nooit publiek staan. */
const publiekeBestanden=fs.readdirSync(PUBLIC);
const internPubliek=publiekeBestanden.filter(naam=>
  naam.endsWith(".test.js") ||
  ["run.js","run-built-matrix.js","kern.js","data.js","build-weather.js","interpretatie-engine.js"].includes(naam)
);
ok(internPubliek.length===0,"geen interne test- of bouwbestanden in public");

const sw=fs.readFileSync(path.join(PUBLIC,"sw.js"),"utf8");
ok(/const CACHE = "weerbriefing-[0-9a-f]{12}";/.test(sw),"serviceworker-cache volgt de gebouwde inhoudshash");
ok(!/weerbriefing-v\d+/.test(sw),"geen handmatig vast cacheversienummer in productie");

const gebouwd=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
ok(gebouwd.includes("S.actieveWaarschuwingen=[];"),"waarschuwingen van een vorige locatie worden direct gewist");
ok(gebouwd.includes("mijnBeurt!==waarschuwingTeller"),"een verouderd waarschuwingantwoord kan de nieuwe plaats niet overschrijven");
ok(gebouwd.includes("Officiële weerwaarschuwingen konden niet worden gecontroleerd."),"onbereikbare waarschuwingbron blijft niet stil");
ok(gebouwd.includes("zijn voor deze locatie niet beschikbaar"),"ontbrekende werelddekking wordt eerlijk gemeld");
ok(gebouwd.includes("const rondGetal="),"temperatuurweergaven blokkeren null als kunstmatige nul");

const vercel=JSON.parse(fs.readFileSync(path.join(ROOT,"vercel.json"),"utf8"));
const headers=(vercel.headers&&vercel.headers[0]&&vercel.headers[0].headers)||[];
const headerMap=Object.fromEntries(headers.map(h=>[String(h.key).toLowerCase(),h.value]));
ok(headerMap["x-content-type-options"]==="nosniff","nosniff-header staat aan");
ok(headerMap["x-frame-options"]==="DENY","framing is geblokkeerd");
ok(/geolocation=\(self\)/.test(headerMap["permissions-policy"]||""),"locatiebevoegdheid is tot de eigen site beperkt");

function nepResponse(){
  return {
    statusCode:200,
    headers:{},
    body:null,
    setHeader(k,v){this.headers[String(k).toLowerCase()]=v;},
    status(code){this.statusCode=code;return this;},
    json(body){this.body=body;return this;}
  };
}

async function roepWaarschuwingen(query,fetchImpl){
  const oud=global.fetch;
  const modulePad=require.resolve("./api/waarschuwingen.js");
  delete require.cache[modulePad];
  global.fetch=fetchImpl;
  try{
    const handler=require(modulePad);
    const res=nepResponse();
    await handler({query},res);
    return res;
  }finally{
    global.fetch=oud;
    delete require.cache[modulePad];
  }
}

(async()=>{
  const nws=await roepWaarschuwingen(
    {lat:"40.7128",lon:"-74.0060"},
    async()=>{throw new Error("teststoring");}
  );
  ok(nws.statusCode===200,"waarschuwingroute blijft technisch beschikbaar bij bronstoring");
  ok(nws.body&&nws.body.dekking===false,"NWS-storing wordt niet als geldige lege dekking gemeld");
  ok(nws.body&&nws.body.reden==="bron onbereikbaar","NWS-storing heeft een expliciete reden");

  const atom="<?xml version=\"1.0\"?><feed><entry><title>Code geel</title><summary>Landelijke waarschuwing</summary></entry></feed>";
  let aanroep=0;
  const meteo=await roepWaarschuwingen(
    {lat:"52.3676",lon:"4.9041"},
    async url=>{
      aanroep++;
      if(String(url).includes("bigdatacloud")){
        return {ok:true,json:async()=>({countryCode:"NL"})};
      }
      return {ok:true,text:async()=>atom};
    }
  );
  ok(aanroep>=2,"MeteoAlarm-test doorloopt land- en waarschuwingbron");
  ok(meteo.body&&meteo.body.dekking===true,"beschikbare MeteoAlarm-feed houdt dekking waar");
  ok(meteo.body&&meteo.body.lijst&&meteo.body.lijst[0]&&meteo.body.lijst[0].landelijk===true,
    "Atom-waarschuwing zonder gebied wordt expliciet als breder gebied gemarkeerd");

  console.log("Code-auditregressies: "+geslaagd+" controles geslaagd.");
})().catch(err=>{
  console.error(err&&err.stack||err);
  process.exitCode=1;
});
