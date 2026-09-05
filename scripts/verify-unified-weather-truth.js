"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");

function bevat(tekst,reden){if(!html.includes(tekst))throw new Error(reden+": "+tekst);}
function mist(tekst,reden){if(html.includes(tekst))throw new Error(reden+": "+tekst);}

bevat("/* ===== UNIFIED WEATHER TRUTH 20260815 ===== */","unified-weather-truth marker ontbreekt");
bevat("Weekneerslag heeft één horizon per rij: vandaag resterend, toekomstige dagen volledig","daghorizon is niet expliciet geconsolideerd");
bevat('if(!datum||datum===huidigeDatum)return;',"huidige dag wordt niet beschermd tegen volledige daily totalen");
bevat('day.precipitation_probability_max&&day.precipitation_probability_max[i]','toekomstige dagkans gebruikt niet het officiële daily veld');
bevat('day.precipitation_sum&&day.precipitation_sum[i]','toekomstige daghoeveelheid gebruikt niet het officiële daily veld');
bevat('const dagMm=num(a&&a.hoeveelheid);',"resterende daghoeveelheid wordt niet uit centrale analyse gelezen");
bevat('small.className="q1-dag-mm";small.textContent=hoeveelheidTekst(dagMm)',"daghoeveelheid wordt niet uit hetzelfde analyseobject getoond");
mist("Weekverwachting: de zichtbare kans en hoeveelheid komen beide uit de officiële","oude algemene Q1 daily-owner staat nog in runtime");
mist("const p=dagNeerslagPresentatie(kans,mm,beleid.kansHoofd,beleid.hoeveelheidTekst);","oude onvoorwaardelijke Q1 daily-owner staat nog in runtime");
/* De oorspronkelijke basisrenderer mag de daily velden nog gebruiken om zijn
   eerste DOM op te bouwen. Daarna gelden twee expliciete, niet-overlappende
   horizons: de centrale policy bezit vandaag vanaf lokaal nu; de horizonbewuste
   Q1-laag bezit uitsluitend toekomstige volledige kalenderdagen. */
mist("Geen goed zichtvenster","Nachtzicht gebruikt nog ambigu zichtvenster");
bevat("Geen gunstig kijkvenster","Nachtzicht gebruikt geen helder kijkvensterbegrip");
bevat('De temperatuur blijft tot rond "+hhmm(volledigePiekVandaag.t)+" ongeveer <b>"+weatherNowBriefingGraden(huidigAfgerond)+"</b>.',"temperatuurplateau gebruikt niet de centrale graadformatter");
bevat('Het verwachte maximum ligt vandaag rond "+hhmm(volledigePiekVandaag.t)+" op <b>"+weatherNowBriefingGraden(piekAfgerond)+"</b>.',"temperatuurpiek gebruikt niet de centrale graadformatter");
bevat('verrijkAnalyseMetKnmi(basisAnalyseerNeerslag(data,duur,nuOverride),data,duur,interpretatie,Date.now())',"KNMI freshness gebruikt niet de absolute browserklok");
mist('verrijkAnalyseMetKnmi(basisAnalyseerNeerslag(data,duur,nuOverride),data,duur,interpretatie,nuNaarMs(nuOverride))',"offsetloze plaatstijd kan KNMI freshness nog beïnvloeden");
bevat('const radarDroog=!!(actueel&&num(actueel.waarde)!==null&&num(actueel.waarde)<KNMI_ACTUEEL_DREMPEL_MMU);',"verse droge radarwaarheid ontbreekt in actuele hero");
bevat('const currentHeroCode=radarDroog&&modelCode!==null&&modelCode>=51&&modelCode<=99&&cc!==null',"hero neutraliseert conflicterende modelregen niet");
bevat("weatherNowHadController","serviceworker-updatebewustzijn ontbreekt");
bevat('navigator.serviceWorker.addEventListener("controllerchange"',"nieuwe appcontroller leidt niet tot gecontroleerde reload");
bevat('reg.waiting.postMessage("weathernow:skip-waiting")',"wachtende appcontroller krijgt geen expliciete activatiefallback");
bevat('window.addEventListener("pageshow",weatherNowSwUpdate)',"terugkerende tab controleert appupdate niet");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("geen inline scripts om syntactisch te valideren");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:verify-unified-"+(i+1)}));

console.log("Unified weather truth verifier: actuele neerslag/hero, daghorizons, Nachtzicht-copy, centrale graadformatter, temperatuurplateau en appupdate geslaagd.");