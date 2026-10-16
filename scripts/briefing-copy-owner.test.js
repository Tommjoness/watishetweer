"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  briefingGraden,briefingNachtzin,pasBriefingCopyToe,HELPER_PRODUCTIE,
  NACHTZIN_BRON,NACHTZIN_PRODUCTIE,VANDAAG_PIEK_BRON,VANDAAG_PIEK_PRODUCTIE,
  MORGEN_BRON,MORGEN_PRODUCTIE,VANDAAG_VERLEDEN_BRON,VANDAAG_VERLEDEN_PRODUCTIE,
  VANDAAG_MAX_BRON,VANDAAG_MAX_PRODUCTIE,NACHT_STANDALONE_BRON,NACHT_STANDALONE_PRODUCTIE,
  WAARSCHUWING_VOORRANG_BRON,WAARSCHUWING_VOORRANG_PRODUCTIE
}=require("./briefing-copy-owner.js");

assert.equal(briefingGraden(1),"1 graad");
assert.equal(briefingGraden(-1),"-1 graad");
assert.equal(briefingGraden(2),"2 graden");
assert.equal(briefingNachtzin(null,"2026-08-20T02:00",18),"");
/* Dezelfde regels in de browserhelper die in de app terechtkomt: een
   ontbrekend minimum (pooldag) geeft geen zin, ook niet om 23:30. */
{
  const vm=require("vm");
  const ctx={eindigGetal:v=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?null:Number(v),globalThis:{}};
  vm.runInNewContext(HELPER_PRODUCTIE.replace("function briefing(){\n",""),ctx);
  for(const leeg of [null,undefined,"","geen"])assert.equal(ctx.weatherNowBriefingNachtzin(leeg,"2026-07-22T23:30",18),"",`browserhelper maakt geen nachtzin zonder minimum (${leeg})`);
  assert.equal(ctx.weatherNowBriefingNachtzin(0,"2026-07-22T23:30",4),"Vannacht koelt het af naar ongeveer <b>0 graden</b>.","0 graden blijft een geldige waarde");
}
/* De regen van morgen in de avondsamenvatting: tijdvak en hoeveelheid uit dezelfde
   periodefunctie als de grafiektekst (uurwaarde hoort bij het voorafgaande uur). */
{
  const vm=require("vm");
  const ctx={eindigGetal:v=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?null:Number(v),globalThis:{WeatherNowFinalAudit20260901:require("./final-audit-20260901.js")}};
  vm.runInNewContext(HELPER_PRODUCTIE.replace("function briefing(){\n",""),ctx);
  const dagen=(d1,d2)=>{const t=[];for(const d of [d1,d2])for(let u=0;u<24;u++)t.push(d+"T"+String(u).padStart(2,"0")+":00");t.push("2026-10-18T00:00");return t;};
  const bouw=(waarden,kans,code)=>{const tijd=dagen("2026-10-16","2026-10-17");const neerslag=tijd.map(()=>0),pk=tijd.map(()=>5),wc=tijd.map(()=>3);
    for(const [uur,mm] of Object.entries(waarden)){const i=tijd.indexOf("2026-10-17T"+String(uur).padStart(2,"0")+":00");neerslag[i]=mm;pk[i]=kans;wc[i]=code;}
    return {time:tijd,precipitation:neerslag,precipitation_probability:pk,weather_code:wc};};
  const regen={18:1.0,19:1.2,20:0.6,21:0.3};
  assert.equal(ctx.weatherNowBriefingMorgenRegen(bouw(regen,90,61),"2026-10-17"),"Morgen wordt tussen 17:00 en 21:00 regen verwacht (ongeveer 3,1 mm).","verwachte regen met tijdvak en hoeveelheid");
  assert.equal(ctx.weatherNowBriefingMorgenRegen(bouw(regen,50,61),"2026-10-17"),"Morgen kan tussen 17:00 en 21:00 regen vallen (ongeveer 3,1 mm).","middelhoge kans: kan vallen");
  assert.equal(ctx.weatherNowBriefingMorgenRegen(bouw(regen,20,61),"2026-10-17"),"","lage kans: geen zin");
  assert.equal(ctx.weatherNowBriefingMorgenRegen(bouw({},0,3),"2026-10-17"),"","droog: geen zin");
  assert.equal(ctx.weatherNowBriefingMorgenRegen(bouw({18:0.1,19:0.1},90,61),"2026-10-17"),"","minder dan 0,3 mm: geen zin");
  assert.equal(ctx.weatherNowBriefingMorgenRegen(bouw(regen,90,73),"2026-10-17"),"Morgen wordt tussen 17:00 en 21:00 sneeuw verwacht (ongeveer 3,1 mm).","sneeuwcodes: sneeuw");
  assert.equal(ctx.weatherNowBriefingMorgenRegen(bouw(regen,90,95),"2026-10-17"),"Morgen wordt tussen 17:00 en 21:00 neerslag verwacht (ongeveer 3,1 mm).","andere codes: neutraal 'neerslag'");
  assert.equal(ctx.weatherNowBriefingMorgenRegen(bouw(regen,90,61),"2026-10-19"),"","datum zonder uurdata: geen zin");
  assert.equal(ctx.weatherNowBriefingMorgenRegen(null,"2026-10-17"),"","geen data: geen zin");
  /* Wintertijddag (25 oktober 2026, 25 uur): het dubbele uur 02:00 verstoort de periode niet. */
  const winter=[];for(let u=0;u<24;u++){winter.push("2026-10-25T"+String(u).padStart(2,"0")+":00");if(u===2)winter.push("2026-10-25T02:00");}
  winter.push("2026-10-26T00:00");
  const wn=winter.map(()=>0),wk=winter.map(()=>5),wc=winter.map(()=>3);
  for(const u of [19,20,21]){const i=winter.lastIndexOf("2026-10-25T"+u+":00");wn[i]=1;wk[i]=95;wc[i]=63;}
  assert.equal(ctx.weatherNowBriefingMorgenRegen({time:winter,precipitation:wn,precipitation_probability:wk,weather_code:wc},"2026-10-25"),"Morgen wordt tussen 18:00 en 21:00 regen verwacht (ongeveer 3,0 mm).","wintertijddag: de regenperiode klopt");
  /* Engels: dezelfde zinnen, vertaald. */
  const {maakVertaler}=require("../taal/vertaalkern.js");
  const en=maakVertaler(require("../taal/en.js"));
  assert.equal(en.vertaal("Morgen wordt tussen 17:00 en 21:00 regen verwacht (ongeveer 3,1 mm)."),"Rain is expected tomorrow between 17:00 and 21:00 (about 3.1 mm).");
  assert.equal(en.vertaal("Morgen kan tussen 17:00 en 21:00 sneeuw vallen (ongeveer 3,1 mm)."),"Tomorrow, snow may fall between 17:00 and 21:00 (about 3.1 mm).");
  assert.equal(en.vertaal("Morgen wordt tussen 06:00 en 08:00 neerslag verwacht (ongeveer 0,4 mm)."),"Precipitation is expected tomorrow between 06:00 and 08:00 (about 0.4 mm).");
  /* Avondvolgorde: vannacht eerst, dan het maximum van morgen, dan de regen van morgen. */
  assert(MORGEN_PRODUCTIE.indexOf("nachtZin?nachtZin+")<MORGEN_PRODUCTIE.indexOf("Het verwachte maximum ligt morgen"),"vannacht staat vóór morgen");
  assert(MORGEN_PRODUCTIE.indexOf("Het verwachte maximum")<MORGEN_PRODUCTIE.indexOf("weatherNowBriefingMorgenRegen(h,morgenDatum)"),"de regen van morgen staat na het maximum");
}
assert.equal(briefingNachtzin(16,"2026-08-20T23:30",19),"Vannacht koelt het af naar ongeveer <b>16 graden</b>.");
assert.equal(briefingNachtzin(1,"2026-08-20T23:30",4),"Vannacht koelt het af naar ongeveer <b>1 graad</b>.");
assert.equal(briefingNachtzin(-1,"2026-08-20T23:30",3),"Vannacht koelt het af naar ongeveer <b>-1 graad</b>.");
assert.equal(briefingNachtzin(16,"2026-08-20T00:03",19),"Vannacht daalt de temperatuur naar ongeveer <b>16 graden</b>.");
assert.equal(briefingNachtzin(16,"2026-08-20T04:59",16),"Vannacht blijft de temperatuur rond <b>16 graden</b>.");
assert.equal(briefingNachtzin(16,"2026-08-20T04:59",15.5),"Vannacht blijft de temperatuur rond <b>16 graden</b>.");
assert.equal(briefingNachtzin(16,"2026-08-20T02:15",14),"Vannacht loopt de temperatuur op naar ongeveer <b>16 graden</b>.");
assert.equal(briefingNachtzin(16,"2026-08-20T02:15",null),"De minimumtemperatuur vannacht ligt rond <b>16 graden</b>.");
assert.equal(briefingNachtzin(16,"2026-08-20T05:00",19),"Vannacht koelt het af naar ongeveer <b>16 graden</b>.");

const bron=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const engine=fs.readFileSync(path.join(__dirname,"..","interpretatie-engine.js"),"utf8");
const start="/* ---------- start ---------- */";
assert.equal(bron.split(start).length-1,1,"bron mist unieke startmarker");
assert.equal(engine.split(WAARSCHUWING_VOORRANG_BRON).length-1,1,"interpretatie-engine mist de historische waarschuwingzin");
const samengesteld=bron.replace(start,"/* ===== CENTRALE INTERPRETATIE-ENGINE ===== */\n"+engine+"\n/* ===== EINDE CENTRALE INTERPRETATIE-ENGINE ===== */\n\n"+start);

assert.equal(samengesteld.split(NACHTZIN_BRON).length-1,1,"bron mist exact de nachtzin");
assert.equal(samengesteld.split(VANDAAG_PIEK_BRON).length-1,2,"bron mist de twee vandaag-piekpaden");
assert.equal(samengesteld.split(MORGEN_BRON).length-1,1,"bron mist morgenpad");
assert.equal(samengesteld.split(VANDAAG_VERLEDEN_BRON).length-1,1,"bron mist verstreken-vandaagpad");
assert.equal(samengesteld.split(VANDAAG_MAX_BRON).length-1,1,"bron mist vandaag-maxpad");
assert.equal(samengesteld.split(NACHT_STANDALONE_BRON).length-1,1,"bron mist losse nachtzin");
assert.equal(samengesteld.split(WAARSCHUWING_VOORRANG_BRON).length-1,1,"geassembleerde bron mist waarschuwing-voorrangzin");

const uit=pasBriefingCopyToe(samengesteld);
assert.equal(uit.split(HELPER_PRODUCTIE).length-1,1,"briefinghelper ontbreekt of is dubbel");
assert.equal(uit.split(NACHTZIN_PRODUCTIE).length-1,1,"finale nachtzin-call ontbreekt of is dubbel");
assert.equal(uit.split(VANDAAG_PIEK_PRODUCTIE).length-1,2,"finale vandaag-piekcopy ontbreekt of is dubbel");
assert.equal(uit.split(MORGEN_PRODUCTIE).length-1,1,"finale morgencopy ontbreekt of is dubbel");
assert.equal(uit.split(VANDAAG_VERLEDEN_PRODUCTIE).length-1,1,"finale verstreken-vandaagcopy ontbreekt of is dubbel");
assert.equal(uit.split(VANDAAG_MAX_PRODUCTIE).length-1,1,"finale vandaag-maxcopy ontbreekt of is dubbel");
assert.equal(uit.split(NACHT_STANDALONE_PRODUCTIE).length-1,1,"finale losse nachtzin ontbreekt of is dubbel");
assert.equal(uit.split(WAARSCHUWING_VOORRANG_PRODUCTIE).length-1,1,"waarschuwing blijft vooraan staan zonder redundante voorrangzin");
assert(uit.includes('function weatherNowBriefingGraden(waarde){'),"centrale graadhelper ontbreekt in productieowner");
assert(uit.includes('WeatherNowNederlandseGrammatica'),"briefingowner delegeert niet naar centrale grammatica");
assert(!uit.includes("De officiële waarschuwing heeft voorrang op de modelverwachting."),"redundante waarschuwingzin bleef in briefingbron staan");
assert(!uit.includes("Later vannacht koelt het af"),"onnatuurlijke later-vannacht-copy bleef in briefingowner staan");

for(const oud of [NACHTZIN_BRON,VANDAAG_PIEK_BRON,MORGEN_BRON,VANDAAG_VERLEDEN_BRON,VANDAAG_MAX_BRON,NACHT_STANDALONE_BRON,WAARSCHUWING_VOORRANG_BRON])
  assert(!uit.includes(oud),"oude briefingcopy bleef in base-build staan");

for(const invariant of [
  "const kt=kortetermijn();","const eind=Math.min(i+25,h.time.length);",
  "const volledigePiekVandaag=piekOpDag(vandaag,null);","day.temperature_2m_max&&day.temperature_2m_max[dagIndexVandaag]",
  "h.temperature_2m&&h.temperature_2m[k]","h.wind_speed_10m&&h.wind_speed_10m[k]","h.wind_gusts_10m&&h.wind_gusts_10m[k]",
  "const plaatsDelen=plaatsTijdDelen(),vandaag=plaatsVandaag();",
  "document.getElementById(\"brief\").innerHTML=nbsp(zin1+\"<!--brief-rest--> \"+zin2+\" \"+zin3);",
  "const waars=(S.actieveWaarschuwingen||[]).filter(w=>w&&w.plaatsSpecifiek!==false);",
  "voor=\"<b>\"+waarschKop+\":</b> \"+esc(w.titel)+\". \"+voor;"
])assert(uit.includes(invariant),"briefing invariant is onbedoeld geraakt: "+invariant);

assert.throws(()=>pasBriefingCopyToe(uit),/staat al in het aangeleverde artifact/,
  "owner moet fail-fast zijn op een reeds gemigreerd artifact");

console.log("Briefingcopy-owner contract groen: centrale graadformatter, natuurlijke nachtcopy, bron-/tijdsemantiek en waarschuwingcopy zitten vóór runtime in één owner; forecast/wind/neerslaginputs zijn ongewijzigd.");
