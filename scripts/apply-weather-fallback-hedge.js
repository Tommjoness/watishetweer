"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");

const BRON=`    let vol=null;
    try{vol=await weatherNowEisGeldigeForecast(j(f,{timeoutMs:10000,signal:weerController.signal}));}
    catch(e){
      if(mijnBeurt!==laadTeller) return;
      try{vol=await weatherNowEisGeldigeForecast(j(fmin,{timeoutMs:10000,signal:weerController.signal}));}
      catch(e2){
        if(mijnBeurt!==laadTeller) return;
        vol=await weatherNowEisGeldigeForecast(j(w,{timeoutMs:10000,signal:weerController.signal}));
      }
    }`;

const PRODUCTIE=`    let vol=null;
    const WEER_HEDGE_MS=5000;
    const WEER_FALLBACK_TIMEOUT_MS=5000;
    let hedgeTimer=null,fallbackBelofte=null,fallbackVerzoeken=null;
    const volledigeRequest=weatherNowChildRequest(weerController.signal);
    const volledigeBelofte=weatherNowEisGeldigeForecast(j(f,{timeoutMs:10000,signal:volledigeRequest.signal}))
      .finally(volledigeRequest.ontkoppel);
    const startFallback=()=>{
      if(!fallbackBelofte){
        const openMeteoRequest=weatherNowChildRequest(weerController.signal);
        const weatherApiRequest=weatherNowChildRequest(weerController.signal);
        fallbackVerzoeken=[openMeteoRequest,weatherApiRequest];
        fallbackBelofte=weatherNowEersteGeslaagdeForecast([
          {belofte:weatherNowEisGeldigeForecast(j(fmin,{timeoutMs:WEER_FALLBACK_TIMEOUT_MS,signal:openMeteoRequest.signal})),annuleer:openMeteoRequest.annuleer},
          {belofte:weatherNowEisGeldigeForecast(j(w,{timeoutMs:WEER_FALLBACK_TIMEOUT_MS,signal:weatherApiRequest.signal})),annuleer:weatherApiRequest.annuleer}
        ]).finally(()=>fallbackVerzoeken.forEach(verzoek=>verzoek.ontkoppel()));
      }
      return fallbackBelofte;
    };
    const annuleerFallback=()=>{if(fallbackVerzoeken)fallbackVerzoeken.forEach(verzoek=>verzoek.annuleer());};
    try{
      const eerste=await new Promise(resolve=>{
        hedgeTimer=setTimeout(()=>resolve({soort:"traag"}),WEER_HEDGE_MS);
        volledigeBelofte.then(
          value=>resolve({soort:"volledig",ok:true,value}),
          error=>resolve({soort:"volledig",ok:false,error})
        );
      });
      if(hedgeTimer!==null){clearTimeout(hedgeTimer);hedgeTimer=null;}
      if(eerste.soort==="volledig"){
        if(eerste.ok)vol=eerste.value;
        else{
          if(mijnBeurt!==laadTeller) return;
          vol=await startFallback();
        }
      }else{
        if(mijnBeurt!==laadTeller) return;
        const fallback=startFallback();
        vol=await weatherNowEersteGeslaagdeForecast([
          {belofte:volledigeBelofte,annuleer:volledigeRequest.annuleer},
          {belofte:fallback,annuleer:annuleerFallback}
        ]);
      }
    }finally{
      if(hedgeTimer!==null)clearTimeout(hedgeTimer);
      volledigeRequest.ontkoppel();
    }`;

/* De bestaande mobiele bronowner structureert de losse attributielinks pas in
   de browser. WeatherAPI is later aan de ruwe footer toegevoegd; zonder deze
   gerichte integratie zou die link bij structureerBronnen() weer verdwijnen.
   Houd alle bestaande bronitems ongewijzigd en voeg alleen de nieuwe forecast-
   provider direct naast Open-Meteo toe. */
const BRONNEN_DECLARATIE='    const open=pak("Open-Meteo"),cams=pak("CAMS"),alarm=pak("MeteoAlarm"),nws=pak("National Weather Service"),bdc=pak("BigDataCloud"),osm=pak("© OpenStreetMap-bijdragers");';
const BRONNEN_DECLARATIE_PRODUCTIE='    const open=pak("Open-Meteo"),weatherApi=pak("WeatherAPI.com"),cams=pak("CAMS"),alarm=pak("MeteoAlarm"),nws=pak("National Weather Service"),bdc=pak("BigDataCloud"),osm=pak("© OpenStreetMap-bijdragers");';
const BRONNEN_GUARD='    if(!open||!cams||!alarm||!nws||!bdc||!osm)return false;';
const BRONNEN_GUARD_PRODUCTIE='    if(!open||!weatherApi||!cams||!alarm||!nws||!bdc||!osm)return false;';
const BRONNEN_OPEN_ITEM="      +'<span class=\"bronitem\">'+open.outerHTML+'</span>'";
const BRONNEN_OPEN_ITEM_PRODUCTIE="      +'<span class=\"bronitem\">'+open.outerHTML+'</span>'\n      +'<span class=\"bronitem\">'+weatherApi.outerHTML+'</span>'";

function vervangEenmaal(html,bron,productie,label){
  const aantal=html.split(bron).length-1;
  if(aantal!==1)throw new Error(label+" ontbreekt of is dubbel: "+aantal);
  return html.replace(bron,productie);
}

function pasToe(html){
  const bronAantal=html.split(BRON).length-1;
  const productieAantal=html.split(PRODUCTIE).length-1;
  if(bronAantal!==1)throw new Error("Sequentieel weerfallbackblok ontbreekt of is dubbel: "+bronAantal);
  if(productieAantal!==0)throw new Error("Hedged weerfallback staat al in artifact: "+productieAantal);
  let uit=html.replace(BRON,PRODUCTIE);
  uit=vervangEenmaal(uit,BRONNEN_DECLARATIE,BRONNEN_DECLARATIE_PRODUCTIE,"WeatherAPI-brondeclaratieanker");
  uit=vervangEenmaal(uit,BRONNEN_GUARD,BRONNEN_GUARD_PRODUCTIE,"WeatherAPI-bronguardanker");
  uit=vervangEenmaal(uit,BRONNEN_OPEN_ITEM,BRONNEN_OPEN_ITEM_PRODUCTIE,"WeatherAPI-bronitemanker");
  return uit;
}

if(require.main===module){
  let html=fs.readFileSync(htmlPad,"utf8");
  html=pasToe(html);
  const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  if(!scripts.length)throw new Error("Geen inline runtime na weerfallbackcorrectie.");
  scripts.forEach((code,i)=>new vm.Script(code,{filename:"public/index.html:weather-fallback-"+(i+1)}));
  fs.writeFileSync(htmlPad,html,"utf8");
  const versie=vernieuwServiceworkerCache(OUT,"weather-fallback-hedge");
  console.log("Trage volledige Open-Meteo-forecast krijgt na 5 s een begrensde race tussen lichte Open-Meteo en WeatherAPI; eerste volledige geldige bron wint, verliezende fallbackrequests worden afgebroken en WeatherAPI-attributie blijft in de gestructureerde footer behouden; cache "+versie+".");
}

module.exports={BRON,PRODUCTIE,BRONNEN_DECLARATIE,BRONNEN_DECLARATIE_PRODUCTIE,BRONNEN_GUARD,BRONNEN_GUARD_PRODUCTIE,BRONNEN_OPEN_ITEM,BRONNEN_OPEN_ITEM_PRODUCTIE,pasToe};
