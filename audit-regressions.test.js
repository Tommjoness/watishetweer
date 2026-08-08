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

  const atomEntiteiten="<?xml version=\"1.0\"?><feed><entry><title><![CDATA[Wind &amp; regen]]></title>"
    +"<summary>Kans op hagel &lt; lokaal &gt; &#33;</summary></entry></feed>";
  const meteoTekst=await roepWaarschuwingen(
    {lat:"52.3676",lon:"4.9041"},
    async url=>String(url).includes("bigdatacloud")
      ? {ok:true,json:async()=>({countryCode:"NL"})}
      : {ok:true,text:async()=>atomEntiteiten}
  );
  ok(meteoTekst.body.lijst[0].titel==="Wind & regen","Atom-titels decoderen XML-entiteiten en CDATA");
  ok(meteoTekst.body.lijst[0].tekst==="Kans op hagel < lokaal > !","Atom-omschrijvingen decoderen XML-entiteiten");

  async function landFeed(code,lat,lon){
    const urls=[];
    const antwoord=await roepWaarschuwingen({lat:String(lat),lon:String(lon)},async url=>{
      urls.push(String(url));
      if(String(url).includes("bigdatacloud")) return {ok:true,json:async()=>({countryCode:code})};
      if(String(url).includes("/api/v1/")) return {ok:false,status:404};
      return {ok:true,text:async()=>atom};
    });
    return {antwoord,urls};
  }
  const andorra=await landFeed("AD",42.5063,1.5218);
  ok(andorra.urls.some(u=>u.includes("meteoalarm-legacy-atom-andorra"))&&andorra.antwoord.body.dekking===true,
    "Andorra gebruikt de officiële MeteoAlarm-feed");
  const macedonie=await landFeed("MK",41.9981,21.4254);
  ok(macedonie.urls.some(u=>u.includes("meteoalarm-legacy-atom-republic-of-north-macedonia"))&&macedonie.antwoord.body.dekking===true,
    "Noord-Macedonië gebruikt de actuele officiële feedslug");

  const rood=await roepWaarschuwingen(
    {lat:"52.3676",lon:"4.9041"},
    async url=>String(url).includes("bigdatacloud")
      ? {ok:true,json:async()=>({countryCode:"NL"})}
      : {ok:true,text:async()=>JSON.stringify({warnings:[{title:"Extreem weer",level:4}]})}
  );
  ok(rood.body.lijst[0].niveau==="rood","MeteoAlarm-niveau 4 wordt als rood geïnterpreteerd");

  console.log("Code-auditregressies: "+geslaagd+" controles geslaagd.");
})().catch(err=>{
  console.error(err&&err.stack||err);
  process.exitCode=1;
});
