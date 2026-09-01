"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  briefingTemperatuurHtml,briefingNachtzin,pasBriefingCopyToe,HELPER_PRODUCTIE,
  NACHTZIN_BRON,NACHTZIN_PRODUCTIE,VANDAAG_PIEK_BRON,VANDAAG_PIEK_PRODUCTIE,
  MORGEN_BRON,MORGEN_PRODUCTIE,VANDAAG_VERLEDEN_BRON,VANDAAG_VERLEDEN_PRODUCTIE,
  VANDAAG_MAX_BRON,VANDAAG_MAX_PRODUCTIE,NACHT_STANDALONE_BRON,NACHT_STANDALONE_PRODUCTIE,
  WAARSCHUWING_VOORRANG_BRON,WAARSCHUWING_VOORRANG_PRODUCTIE
}=require("./briefing-copy-owner.js");

assert.equal(briefingTemperatuurHtml(1),"<b>1 graad</b>");
assert.equal(briefingTemperatuurHtml(-1),"<b>-1 graad</b>");
assert.equal(briefingTemperatuurHtml(0),"<b>0 graden</b>");
assert.equal(briefingTemperatuurHtml(2),"<b>2 graden</b>");
assert.equal(briefingNachtzin(null,"2026-08-20T02:00",18),"");
assert.equal(briefingNachtzin(16,"2026-08-20T23:30",19),"Vannacht koelt het af naar ongeveer <b>16 graden</b>.");
assert.equal(briefingNachtzin(16,"2026-08-20T00:03",19),"Vannacht daalt de temperatuur naar ongeveer <b>16 graden</b>.");
assert.equal(briefingNachtzin(16,"2026-08-20T04:59",16),"Vannacht blijft de temperatuur rond <b>16 graden</b>.");
assert.equal(briefingNachtzin(16,"2026-08-20T04:59",15.5),"Vannacht blijft de temperatuur rond <b>16 graden</b>.");
assert.equal(briefingNachtzin(16,"2026-08-20T02:15",14),"Vannacht loopt de temperatuur op naar ongeveer <b>16 graden</b>.");
assert.equal(briefingNachtzin(16,"2026-08-20T02:15",null),"De minimumtemperatuur vannacht ligt rond <b>16 graden</b>.");
assert.equal(briefingNachtzin(16,"2026-08-20T05:00",19),"Vannacht koelt het af naar ongeveer <b>16 graden</b>.");
assert.equal(briefingNachtzin(1,"2026-08-20T23:30",4),"Vannacht koelt het af naar ongeveer <b>1 graad</b>.");
assert.equal(briefingNachtzin(-1,"2026-08-20T23:30",2),"Vannacht koelt het af naar ongeveer <b>-1 graad</b>.");

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
assert(!uit.includes("De officiële waarschuwing heeft voorrang op de modelverwachting."),"redundante waarschuwingzin bleef in briefingbron staan");
assert(!uit.includes("Later vannacht koelt het af"),"onnatuurlijke later-vannacht-copy bleef in briefingowner staan");
assert(uit.includes("Vannacht daalt de temperatuur naar ongeveer"),"middernachtcopy benoemt resterende daling natuurlijk");
assert(uit.includes("Vannacht blijft de temperatuur rond"),"middernachtcopy ondersteunt stabiele temperatuur");
assert(uit.includes('Math.abs(n)===1?"graad":"graden"'),"briefingowner borgt enkelvoud voor 1 en -1 graad in de runtime");
assert(!/Math\.round\([^\n]+\)\+" graden<\/b>/.test(uit),"briefingmaxima bouwen geen ongeconditioneerde graden-eenheid meer");

for(const oud of [NACHTZIN_BRON,VANDAAG_PIEK_BRON,MORGEN_BRON,VANDAAG_VERLEDEN_BRON,VANDAAG_MAX_BRON,NACHT_STANDALONE_BRON,WAARSCHUWING_VOORRANG_BRON])
  assert(!uit.includes(oud),"oude briefingcopy bleef in base-build staan");

/* Analyse en inputs blijven bij de bestaande renderer. De owner mag geen
   neerslag-, temperatuur-, wind-, provider- of tijdzoneselectie verplaatsen. */
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

console.log("Briefingcopy-owner contract groen: natuurlijke nachtcopy, correcte graad/graden-grammatica, bron-/tijdsemantiek en waarschuwingcopy zitten vóór runtime in één owner; forecast/wind/neerslaginputs zijn ongewijzigd.");