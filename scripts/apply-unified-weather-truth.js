"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
let html=fs.readFileSync(htmlPad,"utf8");

const MARK="/* ===== UNIFIED WEATHER TRUTH 20260815 ===== */";
if(html.includes(MARK))throw new Error("Unified-weather-truth is al toegepast.");

/* Q1 voegde na de centrale dagenrenderer opnieuw een tweede runtime-owner toe
   die ruwe daily totalen terugschreef. Voor 'vandaag' zijn die velden inclusief
   verstreken uren en dus niet dezelfde horizon als de resterende-daganalyse.
   Verwijder uitsluitend deze duplicerende runtime-wrapper; de pure Q1-helper en
   de rest van de Q1-functionaliteit blijven intact. */
const Q1_DAG_START="/* Weekverwachting: de zichtbare kans en hoeveelheid komen beide uit de officiële";
const Q1_DAG_END="/* De bestaande tooltip blijft compact.";
const q1Start=html.indexOf(Q1_DAG_START),q1End=html.indexOf(Q1_DAG_END,q1Start);
if(q1Start<0||q1End<=q1Start)throw new Error("Q1-dagwrapper kon niet veilig worden afgebakend.");
if(html.indexOf(Q1_DAG_START,q1Start+1)>=0)throw new Error("Q1-dagwrapper is dubbel aanwezig.");
html=html.slice(0,q1Start)
  +MARK+"\n/* Weekneerslag heeft één finale runtime-owner: WeatherNowKansbeleidV3/dagen(). */\n\n"
  +html.slice(q1End);

/* De overblijvende centrale dagenrenderer gebruikt exact de resterende lokale
   horizon. Toon ook de hoeveelheid uit diezelfde analyse, zodat kans en mm nooit
   meer uit verschillende tijdvensters komen. */
const DAG_HOOFD='      kansEl.textContent=hoofd;';
if((html.split(DAG_HOOFD).length-1)!==1)throw new Error("Centrale dagrenderer-anchor ontbreekt of is dubbel.");
html=html.replace(DAG_HOOFD,DAG_HOOFD+'\n'
  +'      const dagMm=num(a&&a.hoeveelheid);\n'
  +'      if(a&&a.genoeg&&dagMm!==null&&dagMm>=0.1){\n'
  +'        const small=document.createElement("small");small.className="q1-dag-mm";small.textContent=hoeveelheidTekst(dagMm);kansEl.appendChild(small);\n'
  +'      }');

/* Astronomisch kijkvenster en meteorologisch zicht zijn verschillende begrippen.
   De screenshot liet 0/10 door wolken/neerslag naast 10+ km horizontaal zicht
   zien. 'Kijkvenster' voorkomt dat die twee met elkaar worden verward. */
const oudeZichtvensters=(html.match(/Geen goed zichtvenster/g)||[]).length;
if(oudeZichtvensters<1)throw new Error("Nachtzicht-copyanchor ontbreekt.");
html=html.replace(/Geen goed zichtvenster/g,"Geen gunstig kijkvenster");

/* De temperatuurzin heeft in de echte briefingbron een toelichtend commentaar en
   is over twee regels opgebouwd. Match precies dat bestaande blok; daardoor
   faalt de build gesloten als deze logica later opnieuw wordt herschreven. */
const TEMP_OUD=[
  '  if(volledigePiekVandaag&&volledigePiekVandaag.t>nuLokaal){',
  '    /* Koppel een maximum alleen aan het uurpunt waaruit dat maximum zelf komt.',
  '       Zo krijgt de gebruiker vóór de avond steeds antwoord op zowel "hoe warm"',
  '       als "wanneer", zonder een eventueel afwijkend daily-getal aan een verkeerd',
  '       uur te hangen. */',
  '    zin2="Vandaag wordt het rond "+hhmm(volledigePiekVandaag.t)+" het warmst, met maximaal <b>"',
  '      +Math.round(volledigePiekVandaag.v)+" graden</b>."+nachtZin;',
  '  }'
].join("\n");
const TEMP_NIEUW=[
  '  if(volledigePiekVandaag&&volledigePiekVandaag.t>nuLokaal){',
  '    /* Een later uurpunt dat op dezelfde hele graad uitkomt als de actuele',
  '       temperatuur is geen betekenisvolle toekomstige stijging. Beschrijf dan',
  '       het plateau in plaats van te suggereren dat 24 graden nog bereikt moet',
  '       worden terwijl de hero al 24 graden laat zien. */',
  '    const piekAfgerond=Math.round(volledigePiekVandaag.v),huidigAfgerond=huidige===null?null:Math.round(huidige);',
  '    zin2=huidigAfgerond!==null&&piekAfgerond<=huidigAfgerond',
  '      ?"De temperatuur blijft tot rond "+hhmm(volledigePiekVandaag.t)+" ongeveer <b>"+huidigAfgerond+" graden</b>."+nachtZin',
  '      :"Vandaag wordt het rond "+hhmm(volledigePiekVandaag.t)+" het warmst, met maximaal <b>"+piekAfgerond+" graden</b>."+nachtZin;',
  '  }'
].join("\n");
if((html.split(TEMP_OUD).length-1)!==1)throw new Error("Temperatuurpiek-anchor ontbreekt of is dubbel.");
html=html.replace(TEMP_OUD,TEMP_NIEUW);

/* Een dataverversing mag niet betekenen dat een lang openstaande tab oude
   productlogica blijft draaien. De serviceworker claimt nieuwe clients al; de
   pagina controleert voortaan bij terugkeer expliciet op een update en herlaadt
   één keer wanneer een nieuwe controller daadwerkelijk actief wordt. Eerste
   bezoeken zonder bestaande controller krijgen geen extra reload. */
const SW_OUD='if("serviceWorker" in navigator){\n  window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));\n}';
const SW_NIEUW='if("serviceWorker" in navigator){\n  const weatherNowHadController=!!navigator.serviceWorker.controller;\n  let weatherNowSwReloading=false;\n  const weatherNowSwUpdate=()=>navigator.serviceWorker.getRegistration().then(reg=>reg&&reg.update()).catch(()=>{});\n  navigator.serviceWorker.addEventListener("controllerchange",()=>{\n    if(!weatherNowHadController||weatherNowSwReloading)return;\n    weatherNowSwReloading=true;\n    location.reload();\n  });\n  window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").then(()=>weatherNowSwUpdate()).catch(()=>{}));\n  window.addEventListener("pageshow",weatherNowSwUpdate);\n  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")weatherNowSwUpdate();});\n}';
if((html.split(SW_OUD).length-1)!==1)throw new Error("Serviceworker-registratieanchor ontbreekt of is dubbel.");
html=html.replace(SW_OUD,SW_NIEUW);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline scripts na unified-weather-truth.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:unified-weather-truth-"+(i+1)}));

fs.writeFileSync(htmlPad,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"unified-weather-truth");
console.log("Unified weather truth toegepast; daghorizon, actuele neerslag, copy en updateflow geconsolideerd; cache "+versie+".");
