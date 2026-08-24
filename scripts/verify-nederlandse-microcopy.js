"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const ROOT=path.join(__dirname,"..");
const htmlPad=path.join(ROOT,"public","index.html");
const html=fs.readFileSync(htmlPad,"utf8");
const policyBron=fs.readFileSync(path.join(ROOT,"neerslagkans-policy-v3.js"),"utf8");
const seniorBron=fs.readFileSync(path.join(ROOT,"senior-correctness-v2.js"),"utf8");
const pressureBron=fs.readFileSync(path.join(__dirname,"pressure-copy-owner.js"),"utf8");
const windGustBron=fs.readFileSync(path.join(__dirname,"wind-gust-copy-owner.js"),"utf8");
const briefingBron=fs.readFileSync(path.join(__dirname,"briefing-copy-owner.js"),"utf8");
const OUDE_MARK="<!-- ===== NEDERLANDSE MICROCOPY 20260815 ===== -->";

if(html.includes(OUDE_MARK))throw new Error("Verouderde Nederlandse microcopy-compatibilitymarker staat nog in het artifact.");

/* De neerslagowner moet de definitieve Nederlandse zinnen nu zelf leveren. */
for(const tekst of [
  "Voor "+'"+venster+"'+" wordt er geen neerslag verwacht.",
  "De komende twee uur wordt er geen neerslag verwacht.",
  "Het komende uur wordt neerslag verwacht.",
  "Het komende uur zijn enkele druppels mogelijk.",
  "Het komende uur is er een zeer kleine kans op neerslag.",
  "Het komende uur is er een kleine kans op neerslag.",
  "Het komende uur is neerslag mogelijk.",
  "Het komende uur is er een grote kans op neerslag.",
  "Het komende uur is er een zeer grote kans op neerslag."
]){
  if(!policyBron.includes(tekst))throw new Error("Canonieke neerslagowner mist definitieve Nederlandse copy: "+tekst);
}

/* Senior-correctness mag de korte neerslagcopy niet opnieuw bezitten. De helper
   blijft uitsluitend als compatibility-API bestaan en delegeert naar hetzelfde
   kansbeleid dat later de zichtbare kaart definitief schrijft. */
for(const invariant of [
  'require("./neerslagkans-policy-v3.js")',
  'const beleid=(root&&root.WeatherNowKansbeleidV3)||kansbeleidNode;',
  'typeof beleid.komendUurTekst==="function"',
  'beleid.komendUurTekst(a)'
]){
  if(!seniorBron.includes(invariant))throw new Error("Senior-correctness mist neerslagcopydelegatie: "+invariant);
}

for(const tekst of [
  " wordt geen neerslag verwacht.",
  "Neerslag wordt verwacht het komende uur.",
  "Enkele druppels zijn mogelijk het komende uur.",
  "Zeer kleine kans op neerslag het komende uur.",
  "Kleine kans op neerslag het komende uur.",
  "Neerslag is mogelijk het komende uur.",
  "Grote kans op neerslag het komende uur.",
  "Zeer grote kans op neerslag het komende uur."
]){
  if(policyBron.includes(tekst))throw new Error("Verouderde Nederlandse neerslagcopy staat nog in de canonieke owner: "+tekst);
  if(seniorBron.includes(tekst))throw new Error("Senior-correctness bezit nog verouderde Nederlandse neerslagcopy: "+tekst);
  if(html.includes(tekst))throw new Error("Verouderde Nederlandse neerslagcopy staat nog in het finale artifact: "+tekst);
}
for(const tekst of [
  "De komende twee uur wordt er geen neerslag verwacht.",
  "Het komende uur wordt neerslag verwacht.",
  "Het komende uur is er een kleine kans op neerslag."
]){
  if(!html.includes(tekst))throw new Error("Definitieve neerslagcopy ontbreekt uit het finale artifact: "+tekst);
}

/* Luchtdrukcopy is uit de brede UI-polish gemigreerd. Bewaak dat de pure
   base-build owner de finale zinnen bezit en dat de oude late DOM-owner echt
   verdwenen is. Drukwaarden en tendensberekening worden elders bevroren. */
for(const invariant of [
  "function pasPressureCopyToe(html){",
  "De luchtdruk is in de afgelopen drie uur licht ",
  "De luchtdruk is in de afgelopen drie uur "
]){
  if(!pressureBron.includes(invariant))throw new Error("Luchtdrukcopy-owner mist invariant: "+invariant);
}
for(const tekst of [
  "De luchtdruk is in de afgelopen drie uur licht ",
  "De luchtdruk is in de afgelopen drie uur "
]){
  if(!html.includes(tekst))throw new Error("Definitieve luchtdrukcopy ontbreekt uit artifact: "+tekst);
}
if(html.includes("function uiLuchtdrukTekst(tekst){"))throw new Error("Verouderde UI-polish luchtdrukcopy-owner staat nog in artifact.");

/* Ook windstootcopy hoort nu bij één pure base-build owner. De data en
   piekselectie blijven in meters(); alleen de zichtbare gustsub-zinnen zijn
   uit de generieke UI-polish verwijderd. De piekwaarde blijft forecastdata,
   dus ook na het piekuur mag de copy geen gemeten historische waarde claimen. */
for(const invariant of [
  "function weatherNowWindstootTekst(pg,nu,dag,vak){",
  "De hoogste windstoot wordt vandaag tussen ",
  "De hoogste windstoot werd vandaag tussen ",
  "verwacht: ",
  "function pasWindGustCopyToe(html){"
]){
  if(!windGustBron.includes(invariant))throw new Error("Windstootcopy-owner mist invariant: "+invariant);
}
for(const tekst of [
  "De hoogste windstoot wordt vandaag tussen ",
  "De hoogste windstoot werd vandaag tussen ",
  "verwacht: "
]){
  if(!html.includes(tekst))throw new Error("Definitieve windstootcopy ontbreekt uit artifact: "+tekst);
}
if(/\bbedroeg\b/i.test(windGustBron))throw new Error("Windstootcopy-owner bevat nog een meetwaarde-achtige verledenclaim: bedroeg.");
if(html.includes("function uiWindstootTekst(pg,nu,dag,vak){"))throw new Error("Verouderde UI-polish windstootcopy-owner staat nog in artifact.");
if(html.includes("const uiBasisMeters=meters;"))throw new Error("UI-polish wrapt meters() nog in het finale artifact.");

/* De briefingcopy heeft nu eveneens één pure base-build owner. De bestaande
   briefingrenderer blijft alle forecast/wind/neerslaginputs selecteren; de owner
   maakt alleen bronstatus en nacht-tijdtaal direct definitief in briefing(). */
for(const invariant of [
  "function weatherNowBriefingNachtzin(tmin,nuLokaal,huidigeTemperatuur){",
  "Het verwachte maximum ligt vandaag rond ",
  "Het verwachte maximum ligt morgen rond ",
  "Het verwachte maximum lag vandaag rond ",
  "Het verwachte maximum voor morgen is ",
  "De minimumtemperatuur vannacht ligt rond ",
  "Later vannacht koelt het af naar ",
  "function pasBriefingCopyToe(html){"
]){
  if(!briefingBron.includes(invariant))throw new Error("Briefingcopy-owner mist invariant: "+invariant);
}
for(const tekst of [
  "function weatherNowBriefingNachtzin(tmin,nuLokaal,huidigeTemperatuur){",
  "Het verwachte maximum ligt vandaag rond ",
  "Het verwachte maximum ligt morgen rond ",
  "Het verwachte maximum lag vandaag rond ",
  "Het verwachte maximum voor morgen is ",
  "De minimumtemperatuur vannacht ligt rond ",
  "Later vannacht koelt het af naar "
]){
  if(!html.includes(tekst))throw new Error("Definitieve briefingcopy ontbreekt uit artifact: "+tekst);
}
for(const verouderd of ["uiBriefingBronSemantiek","uiBriefingTijdtaal","const uiBasisBriefing=briefing;"]){
  if(html.includes(verouderd))throw new Error("Verouderde UI-polish briefingcopy-owner staat nog in artifact: "+verouderd);
}
if(html.includes("De officiële waarschuwing heeft voorrang op de modelverwachting."))throw new Error("Verouderde briefing-waarschuwingcopy staat nog in artifact.");

/* De overige taal hoort aantoonbaar bij de inhoudelijke runtime-owner. */
for(const eigenaar of [
  "function normaliseerNachtDagdata(data,nuLokaal){",
  "function corrigeerNachtVensterBron(tekst,horizonDagen,score,opties={}){",
  "function formatteerMaanTekst(tekst){",
  "function pollenKop(tekst){"
]){
  if(!html.includes(eigenaar))throw new Error("Presentatie-owner ontbreekt uit artifact: "+eigenaar);
}

/* De nachtbriefing moet temperatuurgedreven blijven. Een klok-only formulering
   kan bij een al bereikt minimum ten onrechte toekomstige afkoeling suggereren. */
for(const invariant of [
  "const huidige=eindigGetal(huidigeTemperatuur);",
  "doel>=huidige-0.75",
  "De minimumtemperatuur vannacht ligt rond ",
  "Later vannacht koelt het af naar "
]){
  if(!html.includes(invariant))throw new Error("Temperatuurgedreven nachtbriefing mist invariant: "+invariant);
}

if(html.includes("Beste modeluren")||html.includes("Relatief gunstigste modeluren"))throw new Error("Nachtzicht bevat nog modeljargon in het finale artifact.");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime gevonden voor microcopy-verificatie.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:verify-nederlandse-microcopy-"+(i+1)}));

console.log("Nederlandse microcopy geverifieerd: neerslagcopy uit de canonieke neerslagowner, luchtdruk-, windstoot- en briefingcopy uit base-build owners en overige taal bij de eigen runtime-owner.");