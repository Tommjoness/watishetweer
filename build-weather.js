"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm");
const {pasWaarschuwingRenderStateToe}=require("./scripts/warning-render-state.js");
const {pasPressureCopyToe}=require("./scripts/pressure-copy-owner.js");
const {pasWindGustCopyToe}=require("./scripts/wind-gust-copy-owner.js");
const {pasSunshineCopyToe}=require("./scripts/sunshine-copy-owner.js");
const {pasDailyForecastOwnerToe}=require("./scripts/daily-forecast-owner.js");
const {pasBriefingCopyToe}=require("./scripts/briefing-copy-owner.js");
const {pasSeoFoundationToe}=require("./scripts/seo-foundation.js");
const {vernieuwServiceworkerCache}=require("./scripts/postbuild-cache.js");
const {pasGlobalLocationHardeningToe}=require("./scripts/global-location-hardening.js");
const {pasPollenHourCorrectnessToe}=require("./scripts/pollen-hour-correctness.js");
const ROOT=__dirname,OUT=path.join(ROOT,"public");
const skip=new Set(["node_modules","public","scripts","data","qa","src"]);
const intern=n=>n==="AGENTS.md"||n==="package.json"||n==="package-lock.json"||n==="vercel.json"||n.endsWith(".test.js")||n.startsWith("test-")||n.startsWith("run-")||n.includes("README")||n==="SECURITY.md"||n==="PRIVACY.md"||n==="SECURITY.txt";
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
for(const n of fs.readdirSync(ROOT)){
  if(skip.has(n)||intern(n)||n.startsWith("."))continue;
  const s=path.join(ROOT,n),d=path.join(OUT,n),st=fs.statSync(s);
  if(st.isFile())fs.copyFileSync(s,d);
  else if(st.isDirectory())fs.cpSync(s,d,{recursive:true});
}

const ip=path.join(OUT,"index.html");let html=fs.readFileSync(ip,"utf8");
const canoniek=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
const cssBegin="/* ===== WEATHER NOW PRODUCT CSS ===== */",cssEind="/* ===== EINDE WEATHER NOW PRODUCT CSS ===== */";
const cssStart=canoniek.indexOf(cssBegin),cssStop=canoniek.indexOf(cssEind,cssStart+cssBegin.length);
if(cssStart<0||cssStop<0)throw new Error("Canonieke CSS-markers ontbreken.");
const css=canoniek.slice(cssStart,cssStop+cssEind.length);
const huidigStart=html.indexOf(cssBegin),huidigStop=html.indexOf(cssEind,huidigStart+cssBegin.length);
if(huidigStart<0||huidigStop<0)throw new Error("Product-CSS ontbreekt in buildartifact.");
html=html.slice(0,huidigStart)+css+html.slice(huidigStop+cssEind.length);

/* De rest van dit bestand is de bestaande base-build. De inhoud hieronder blijft
   ongewijzigd behalve waar expliciete owner-contracten worden toegepast. */
const baseOwner=require("./scripts/postbuild-pipeline.js");
/* postbuild-pipeline exporteert alleen helpers; uitvoeren gebeurt pas na de build. */
void baseOwner;

/* De canonieke bron bevat de volledige applicatie. Base-build owners wijzigen
   daarna uitsluitend hun eigen afgebakende contracten. */
html=pasWaarschuwingRenderStateToe(html);
html=pasPressureCopyToe(html);
html=pasWindGustCopyToe(html);
html=pasSunshineCopyToe(html);
html=pasDailyForecastOwnerToe(html);
html=pasBriefingCopyToe(html);
html=pasGlobalLocationHardeningToe(html);
html=pasPollenHourCorrectnessToe(html);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline script gevonden.");
scripts.forEach((s,i)=>new vm.Script(s,{filename:"public/index.html:inline-"+(i+1)}));
const vereist=[
  "WeatherNowInterpretatie","WeatherNowCorrectnessV2","WeatherNowKansbeleidV3","WeatherNowPolishV2","WeatherNowSeniorRonde20260810","WeatherNowProgressiveLocation","WeatherNowGlobalLocationHardening","weatherNowActueleLokaleTijd","plaatsTijdDelen","weatherNowZoneOffset",
  "const beleid=root.WeatherNowKansbeleidV3;","typeof beleid.briefingZin===\"function\"",
  "const eind=Math.min(i+25,h.time.length);","const punten=n===24?25:n;",
  "hoeveelheid onzeker","daily.weather_code&&daily.weather_code[dagIndex]","117.000001",
  "c.visibility!=null?c.visibility","weatherNowUurWaardeOp(\"pressure_msl\"","zoekGeneratie",
  "klokKalenderdag","Komend uur","item.precipitation*item.fractie",
  "luchtBelofte","plaatsSpecifiek!==false","nachtzichtScore","grafiekNeerslagVerschuiving",
  "k<=9","k<=29","k<=69","k<=89","Zeer grote kans op neerslag",
  "grid-template-columns:repeat(3,minmax(0,1fr))","klokMinuutTimer=setInterval(klokBijwerken,60000)","tooltipWaardeKort","temperatuurLabelsBotsen","neerslagkans",
  "forecastMomentZinsdeel","Globale indicatie:","kop.textContent=\"Neerslag\"","senior-zoninfo","tooltipCompactMaten",
  "window.addEventListener(\"scroll\",plan,{passive:true})","r.bottom<=0","timer=setTimeout(zet,16)","senior-verstopt","verschil>0","(max-width:900px)",
  "Verwachting wordt aangevuld.","current=temperature_2m,apparent_temperature,is_day,weather_code",
  "geen plaats-specifieke dekking","dedupliceerZoekresultaten","grid-template-areas:","informatie informatie","overflow-wrap:anywhere",
  "Officiële weerwaarschuwingen controleren…","Geen officiële weerwaarschuwingen voor deze locatie.",
  "De luchtdruk is in de afgelopen drie uur licht ","De luchtdruk is in de afgelopen drie uur ",
  "De hoogste windstoot wordt vandaag tussen ","De hoogste windstoot werd vandaag tussen ",
  "weatherNowZonurenWoord","Naar verwachting bijna de hele dag zon.","Naar verwachting veel zon vandaag.",
  "weatherNowDagNeerslagTekst","<div class=\"bar\">Bereik</div>","<div class=\"drain\">Neerslag</div>",
  "weatherNowBriefingNachtzin","Het verwachte maximum ligt vandaag rond ","Het verwachte maximum ligt morgen rond ","Het verwachte maximum lag vandaag rond ","Het verwachte maximum voor morgen is ",
  "load(52.3676,4.9041,\"Amsterdam\",false,true,\"NL\")"
];
for(const x of vereist)if(!html.includes(x))throw new Error("Canonieke broninvariant ontbreekt: "+x);
if(html.includes("De officiële waarschuwing heeft voorrang op de modelverwachting."))throw new Error("Redundante waarschuwing-voorrangzin heeft de base briefingowner overleefd.");

/* SEO-fundering is productmetadata en hoort net als de overige canonieke
   productieconfiguratie in de base-build. De pure owner gebruikt uitsluitend
   seo-foundation.config.js; latere plaatsroutegeneratie erft deze rootmetadata. */
html=pasSeoFoundationToe(html);
fs.writeFileSync(path.join(OUT,"index.html"),html,"utf8");

/* Ook de eerste build gebruikt dezelfde eigenaar als alle latere postbuildlagen.
   Daarmee bestaan lijst, hashrecept, legacy-id-migratie en verificatie nog maar
   op één plek. Iedere volgende artifactmutatie kan dezelfde helper opnieuw
   aanroepen zonder dat build-weather een tweede cachecontract onderhoudt. */
const versie=vernieuwServiceworkerCache(OUT,"build-weather");

for(const n of fs.readdirSync(OUT))if(intern(n))throw new Error("Intern bestand publiek gebouwd: "+n);
console.log("WeatherNow-build geslaagd: expliciete productconfiguratie, waarschuwing-laad/leegstatus, luchtdrukcopy, windstootcopy, zonurencopy, dagverwachtingcopy, briefingcopy, lucht/pollen-correctheid, SEO-fundering, centrale interpretatie, correctheidslaag, neerslagkansbeleid, live-polish, senior-semantiek, progressieve locatielading, wereldwijde locatiehardening en cache "+versie+".");
