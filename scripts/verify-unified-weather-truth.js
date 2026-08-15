"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");

function bevat(tekst,reden){if(!html.includes(tekst))throw new Error(reden+": "+tekst);}
function mist(tekst,reden){if(html.includes(tekst))throw new Error(reden+": "+tekst);}

bevat("/* ===== UNIFIED WEATHER TRUTH 20260815 ===== */","unified-weather-truth marker ontbreekt");
bevat("Weekneerslag heeft één finale runtime-owner: WeatherNowKansbeleidV3/dagen()","finale dagowner is niet geconsolideerd");
bevat('const dagMm=num(a&&a.hoeveelheid);',"resterende daghoeveelheid wordt niet uit centrale analyse gelezen");
bevat('small.className="q1-dag-mm";small.textContent=hoeveelheidTekst(dagMm)',"daghoeveelheid wordt niet uit hetzelfde analyseobject getoond");
mist("Weekverwachting: de zichtbare kans en hoeveelheid komen beide uit de officiële","oude Q1 daily-owner staat nog in runtime");
mist("const p=dagNeerslagPresentatie(kans,mm,beleid.kansHoofd,beleid.hoeveelheidTekst);","Q1 schrijft ruwe hele-dagtotalen nog over de resterende-daganalyse heen");
/* De oorspronkelijke basisrenderer mag de daily velden nog gebruiken om zijn
   eerste DOM op te bouwen: de centrale policy-wrapper is de finale eigenaar en
   herschrijft die waarden in dezelfde synchrone render. De regressie bewaakt dus
   de bewezen late Q1-override, niet een onschadelijke bronverwijzing in de basis. */
mist("Geen goed zichtvenster","Nachtzicht gebruikt nog ambigu zichtvenster");
bevat("Geen gunstig kijkvenster","Nachtzicht gebruikt geen helder kijkvensterbegrip");
bevat('De temperatuur blijft tot rond "+hhmm(volledigePiekVandaag.t)+" ongeveer <b>"+huidigAfgerond+" graden</b>.',"temperatuurplateau-copy ontbreekt");
bevat('verrijkAnalyseMetKnmi(basisAnalyseerNeerslag(data,duur,nuOverride),data,duur,interpretatie,Date.now())',"KNMI freshness gebruikt niet de absolute browserklok");
mist('verrijkAnalyseMetKnmi(basisAnalyseerNeerslag(data,duur,nuOverride),data,duur,interpretatie,nuNaarMs(nuOverride))',"offsetloze plaatstijd kan KNMI freshness nog beïnvloeden");
bevat('const radarDroog=!!(actueel&&num(actueel.waarde)!==null&&num(actueel.waarde)<KNMI_ACTUEEL_DREMPEL_MMU);',"verse droge radarwaarheid ontbreekt in actuele hero");
bevat('const currentHeroCode=radarDroog&&modelCode!==null&&modelCode>=51&&modelCode<=99&&cc!==null',"hero neutraliseert conflicterende modelregen niet");
bevat("weatherNowHadController","serviceworker-updatebewustzijn ontbreekt");
bevat('navigator.serviceWorker.addEventListener("controllerchange"',"nieuwe appcontroller leidt niet tot gecontroleerde reload");
bevat('window.addEventListener("pageshow",weatherNowSwUpdate)',"terugkerende tab controleert appupdate niet");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("geen inline scripts om syntactisch te valideren");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:verify-unified-"+(i+1)}));

console.log("Unified weather truth verifier: actuele neerslag/hero, resterende dag, Nachtzicht-copy, temperatuurplateau en appupdate geslaagd.");
