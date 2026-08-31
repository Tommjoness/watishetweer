"use strict";

/* Windstootpresentatie heeft één inhoudelijke owner in de base-build. De tegel
   toont voortaan de verwachte maximale windstoot voor het lopende klokuur uit
   de uurlijkse forecast. Een hourly wind_gusts_10m-waarde hoort bij het
   voorafgaande uurvak, dus het punt op 21:00 beschrijft 20:00–21:00. Daarmee
   hebben titel, waarde en subtekst exact dezelfde tijdscope en wordt een actuele
   15-minutenwaarde niet meer gecombineerd met de piek van de hele dag. */
function weatherNowWindstootBegin(tijd){
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(tijd||""));
  if(!m)return null;
  const ms=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]))-3600000;
  if(!Number.isFinite(ms))return null;
  const d=new Date(ms);
  return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0")
    +"T"+String(d.getUTCHours()).padStart(2,"0")+":"+String(d.getUTCMinutes()).padStart(2,"0");
}

/* Legacy formatter blijft bewust beschikbaar voor briefing/verifiers die de
   dagpiek als forecastcontext controleren. De hoofdtegel gebruikt hem niet. */
function weatherNowWindstootTekst(pg,nu,dag,vak){
  if(!pg||!Number.isFinite(Number(pg.v))||!pg.t)return "Geen uurgegevens beschikbaar.";
  const waarde=Math.round(Number(pg.v));
  const dagNaam=String(dag||"").trim();
  const tijdvak=String(vak||"").trim();
  const tussen=tijdvak.replace("–"," en ");
  const toekomstOfGaand=String(pg.t)>String(nu||"");
  if(/^Vandaag$/i.test(dagNaam))return toekomstOfGaand
    ?`De hoogste windstoot wordt vandaag tussen ${tussen} verwacht: ${waarde} km/u.`
    :`De hoogste windstoot werd vandaag tussen ${tussen} verwacht: ${waarde} km/u.`;
  if(/^Morgen$/i.test(dagNaam))return `De hoogste windstoot wordt morgen tussen ${tussen} verwacht: ${waarde} km/u.`;
  if(/^Gisteren$/i.test(dagNaam))return `De hoogste windstoot werd gisteren tussen ${tussen} verwacht: ${waarde} km/u.`;
  const dagInZin=dagNaam?dagNaam.charAt(0).toLowerCase()+dagNaam.slice(1):"op dat moment";
  return toekomstOfGaand
    ?`De hoogste windstoot wordt ${dagInZin} tussen ${tussen} verwacht: ${waarde} km/u.`
    :`De hoogste windstoot werd ${dagInZin} tussen ${tussen} verwacht: ${waarde} km/u.`;
}

function weatherNowWindstootDitUur(hourly,index){
  const h=hourly||{},i=Number(index),tijden=Array.isArray(h.time)?h.time:[],waarden=Array.isArray(h.wind_gusts_10m)?h.wind_gusts_10m:[];
  if(!Number.isInteger(i)||i<0||i+1>=tijden.length||i+1>=waarden.length)return null;
  const v=waarden[i+1];
  if(v===null||v===undefined||v===""||!Number.isFinite(Number(v))||Number(v)<0)return null;
  const t=String(tijden[i+1]||"");
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t))return null;
  return {v:Number(v),t};
}

function weatherNowWindstootDitUurTekst(punt,vak){
  if(!punt||!Number.isFinite(Number(punt.v)))return "Geen windstootverwachting voor dit uur.";
  const tijdvak=String(vak||"").trim();
  return tijdvak&&tijdvak!=="voorafgaand uur"
    ?"Verwachte hoogste windstoot tussen "+tijdvak.replace("–"," en ")+"."
    :"Verwachte hoogste windstoot in dit uur.";
}

const HELPER_PRODUCTIE=weatherNowWindstootTekst.toString();
const HELPERS_PRODUCTIE=[
  weatherNowWindstootBegin.toString(),HELPER_PRODUCTIE,
  weatherNowWindstootDitUur.toString(),weatherNowWindstootDitUurTekst.toString()
].join("\n\n");
const METERS_MARKER="function meters(){";
const GUST_BRON=`  const windstootRuw=eindigGetal(c.wind_gusts_10m);
  const windstoot=windstootRuw!==null&&windstootRuw>=0?windstootRuw:null;
  set("gust",windstoot===null?"–":Math.round(windstoot)+"<s>km/u</s>");
  const pgRuw=piek("wind_gusts_10m"),pg=pgRuw&&pgRuw.v>=0?pgRuw:null;
  zetTekst("gustsub", !pg ? "Geen uurgegevens beschikbaar."
    : pg.t>nu ? dagAanduiding(pg.t,true)+" tot "+Math.round(pg.v)+" km/u tussen "+weatherNowUurvak(pg.t).replace("–"," en ")+"."
    : dagAanduiding(pg.t,true)+" maximaal "+Math.round(pg.v)+" km/u tussen "+weatherNowUurvak(pg.t).replace("–"," en ")+".");`;
const GUST_PRODUCTIE=`  const gustUur=weatherNowWindstootDitUur(h,i);
  set("gust",gustUur===null?"–":Math.round(gustUur.v)+"<s>km/u</s>");
  const gustStat=document.getElementById("gust")&&document.getElementById("gust").closest(".stat");
  const gustKop=gustStat&&gustStat.querySelector(".eyebrow");
  if(gustKop)gustKop.textContent="Max. windstoot dit uur";
  zetTekst("gustsub",weatherNowWindstootDitUurTekst(gustUur,gustUur?weatherNowUurvak(gustUur.t):""));`;

function pasWindGustCopyToe(html){
  let bron=String(html||"");
  if(bron.includes("function weatherNowWindstootDitUur(hourly,index){"))
    throw new Error("Windstootowner staat al in het aangeleverde artifact.");
  const metersAantal=bron.split(METERS_MARKER).length-1;
  if(metersAantal!==1)throw new Error("meters()-anker ontbreekt of is dubbel: "+metersAantal);
  const gustAantal=bron.split(GUST_BRON).length-1;
  if(gustAantal!==1)throw new Error("Windstootbronanker ontbreekt of is dubbel: "+gustAantal);

  bron=bron.replace(METERS_MARKER,HELPERS_PRODUCTIE+"\n\n"+METERS_MARKER);
  bron=bron.replace(GUST_BRON,GUST_PRODUCTIE);

  if((bron.split(HELPERS_PRODUCTIE).length-1)!==1)throw new Error("Windstoothelpers ontbreken of zijn dubbel na base-build.");
  if((bron.split(GUST_PRODUCTIE).length-1)!==1)throw new Error("Windstootproductiecontract ontbreekt of is dubbel na base-build.");
  if(bron.includes(GUST_BRON))throw new Error("Oude windstootpresentatie heeft de base-build overleefd.");
  return bron;
}

module.exports=Object.freeze({
  METERS_MARKER,GUST_BRON,GUST_PRODUCTIE,HELPER_PRODUCTIE,HELPERS_PRODUCTIE,
  windstootBegin:weatherNowWindstootBegin,windstootTekst:weatherNowWindstootTekst,
  windstootDitUur:weatherNowWindstootDitUur,windstootDitUurTekst:weatherNowWindstootDitUurTekst,
  pasWindGustCopyToe
});
