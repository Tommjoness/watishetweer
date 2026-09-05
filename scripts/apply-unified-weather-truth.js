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
   die ruwe daily totalen over iedere rij terugschreef. Dat is voor vandaag fout:
   de daily velden bevatten ook verstreken uren. Voor toekomstige dagen beschrijven
   diezelfde officiële daily velden juist exact de volledige kalenderdag die de rij
   voorstelt. Vervang daarom uitsluitend de oude algemene wrapper door een
   horizonbewuste wrapper: vandaag blijft volledig eigendom van de resterende-
   daganalyse; toekomstige dagen gebruiken kans én hoeveelheid uit dezelfde daily
   kalenderdag. De rest van de Q1-functionaliteit blijft intact. */
const Q1_DAG_START="/* Weekverwachting: de zichtbare kans en hoeveelheid komen beide uit de officiële";
const Q1_DAG_END="/* De bestaande tooltip blijft compact.";
const q1Start=html.indexOf(Q1_DAG_START),q1End=html.indexOf(Q1_DAG_END,q1Start);
if(q1Start<0||q1End<=q1Start)throw new Error("Q1-dagwrapper kon niet veilig worden afgebakend.");
if(html.indexOf(Q1_DAG_START,q1Start+1)>=0)throw new Error("Q1-dagwrapper is dubbel aanwezig.");
const Q1_DAG_NIEUW=[
  MARK,
  "/* Weekneerslag heeft één horizon per rij: vandaag resterend, toekomstige dagen volledig. */",
  'if(typeof dagen==="function"){',
  '  const basisDagenVolledigeToekomst=dagen;',
  '  dagen=function(){',
  '    basisDagenVolledigeToekomst();',
  '    const beleid=root.WeatherNowKansbeleidV3,day=S.d&&S.d.daily;',
  '    if(!beleid||!day||!Array.isArray(day.time))return;',
  '    const huidigeDatum=String(S.d&&S.d.current&&S.d.current.time||"").slice(0,10);',
  '    document.querySelectorAll("#days .row.day:not(.kop)").forEach(rij=>{',
  '      const i=Number(rij.dataset.i),datum=day.time[i];',
  '      if(!datum||datum===huidigeDatum)return;',
  '      const kans=getal(day.precipitation_probability_max&&day.precipitation_probability_max[i]),mm=getal(day.precipitation_sum&&day.precipitation_sum[i]);',
  '      const kansEl=rij.querySelector(".drain");if(!kansEl)return;',
  '      const presentatie=dagNeerslagPresentatie(kans,mm,beleid.kansHoofd,beleid.hoeveelheidTekst);',
  '      kansEl.textContent=presentatie.hoofd;',
  '      kansEl.title=presentatie.hoofd==="Onzeker"?"Kans en hoeveelheid spreken elkaar tegen":presentatie.hoofd==="Droog"?"Geen neerslag verwacht":presentatie.hoofd==="–"?"Geen betrouwbare kans beschikbaar":"Neerslagkans "+presentatie.hoofd;',
  '      if(presentatie.hoeveelheid){',
  '        const small=document.createElement("small");small.className="q1-dag-mm";small.textContent=presentatie.hoeveelheid;kansEl.appendChild(small);',
  '        kansEl.title+=(kansEl.title?". ":"")+"Verwachte daghoeveelheid: "+presentatie.hoeveelheid;',
  '      }',
  '      const cond=rij.querySelector(".dcond"),code=getal(day.weather_code&&day.weather_code[i]);',
  '      if(cond&&typeof beleid.dagKansSamenvatting==="function"){',
  '        const basis=code!==null&&typeof txt==="function"?txt(code,true):"Verwachting";',
  '        const soort=root.WeatherNowInterpretatie&&typeof root.WeatherNowInterpretatie.neerslagSoortUitCode==="function"?root.WeatherNowInterpretatie.neerslagSoortUitCode(code):"neerslag";',
  '        cond.textContent=beleid.dagKansSamenvatting({genoeg:kans!==null||mm!==null,kans,hoeveelheid:mm,code,soort},basis);',
  '      }',
  '    });',
  '  };',
  '}',
  ""
].join("\n");
html=html.slice(0,q1Start)+Q1_DAG_NIEUW+html.slice(q1End);

/* De centrale dagenrenderer bezit vandaag en gebruikt exact de resterende lokale
   horizon. Toon ook de hoeveelheid uit diezelfde analyse, zodat kans en mm nooit
   meer uit verschillende tijdvensters komen. De horizonbewuste Q1-wrapper hierboven
   overschrijft daarna uitsluitend toekomstige kalenderdagen met hun officiële
   daily kans én hoeveelheid. */
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

/* De briefingowner gebruikt inmiddels één centrale graadformatter. Deze laag
   bewaart die eigenaar ook wanneer het verwachte maximum naar plateaucopy wordt
   omgezet: enkelvoud/meervoud wordt hier dus niet opnieuw handmatig opgebouwd. */
const TEMP_OUD=[
  '  if(volledigePiekVandaag&&volledigePiekVandaag.t>nuLokaal){',
  '    /* Koppel een maximum alleen aan het uurpunt waaruit dat maximum zelf komt.',
  '       Zo krijgt de gebruiker vóór de avond steeds antwoord op zowel "hoe warm"',
  '       als "wanneer", zonder een eventueel afwijkend daily-getal aan een verkeerd',
  '       uur te hangen. */',
  '    zin2="Het verwachte maximum ligt vandaag rond "+hhmm(volledigePiekVandaag.t)+" op <b>"',
  '      +weatherNowBriefingGraden(Math.round(volledigePiekVandaag.v))+"</b>."+(nachtZin?" "+nachtZin:"");',
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
  '      ?"De temperatuur blijft tot rond "+hhmm(volledigePiekVandaag.t)+" ongeveer <b>"+weatherNowBriefingGraden(huidigAfgerond)+"</b>."+(nachtZin?" "+nachtZin:"")',
  '      :"Het verwachte maximum ligt vandaag rond "+hhmm(volledigePiekVandaag.t)+" op <b>"+weatherNowBriefingGraden(piekAfgerond)+"</b>."+(nachtZin?" "+nachtZin:"");',
  '  }'
].join("\n");
if((html.split(TEMP_OUD).length-1)!==1)throw new Error("Temperatuurpiek-anchor ontbreekt of is dubbel.");
html=html.replace(TEMP_OUD,TEMP_NIEUW);

/* De forecastanalyse gebruikt lokale kloktekst; KNMI-brontijden zijn absolute
   UTC-instants. Gebruik voor freshness daarom de echte browserklok, niet Date.parse
   op een offsetloze lokale plaats-string (dat zou afhangen van de tijdzone van
   het apparaat van de bezoeker). */
const KNMI_NU_OUD='  return verrijkAnalyseMetKnmi(basisAnalyseerNeerslag(data,duur,nuOverride),data,duur,interpretatie,nuNaarMs(nuOverride));';
const KNMI_NU_NIEUW='  return verrijkAnalyseMetKnmi(basisAnalyseerNeerslag(data,duur,nuOverride),data,duur,interpretatie,Date.now());';
if((html.split(KNMI_NU_OUD).length-1)!==1)throw new Error("KNMI-freshness browseranchor ontbreekt of is dubbel.");
html=html.replace(KNMI_NU_OUD,KNMI_NU_NIEUW);

/* Als de verse radar droog meet maar de model-weathercode nog een neerslagcode
   heeft, mag de hero niet opnieuw 'regen' tonen. Gebruik dan uitsluitend voor
   de actuele hero een neutrale bewolkingscode uit de eveneens actuele
   cloud_cover. Zonder verse droge KNMI-meting blijft de modelcode ongewijzigd. */
const HERO_OUD=[
  'function modelConditieHerstellen(){',
  '  if(!S.d||!S.d.current)return;',
  '  const c=S.d.current,cond=document.getElementById("cond"),ico=document.getElementById("nowicon"),mini=document.getElementById("minicond");',
  '  if(cond&&typeof txt==="function")cond.textContent=txt(c.weather_code,c.is_day!==0);',
  '  if(ico&&typeof icon==="function")ico.innerHTML=icon(c.weather_code,c.is_day===1,46);',
  '  if(mini&&typeof txt==="function")mini.textContent=txt(c.weather_code,c.is_day!==0);',
  '}'
].join("\n");
const HERO_NIEUW=[
  'function modelConditieHerstellen(){',
  '  if(!S.d||!S.d.current)return;',
  '  const c=S.d.current,cond=document.getElementById("cond"),ico=document.getElementById("nowicon"),mini=document.getElementById("minicond");',
  '  const modelCode=num(c.weather_code),actueel=knmiActueleKandidaat(S.d.__knmiNeerslag,Date.now());',
  '  const radarDroog=!!(actueel&&num(actueel.waarde)!==null&&num(actueel.waarde)<KNMI_ACTUEEL_DREMPEL_MMU);',
  '  const cc=num(c.cloud_cover);',
  '  const currentHeroCode=radarDroog&&modelCode!==null&&modelCode>=51&&modelCode<=99&&cc!==null',
  '    ?(cc>=95?3:cc>=40?2:cc>=15?1:0):modelCode;',
  '  if(cond&&typeof txt==="function")cond.textContent=txt(currentHeroCode,c.is_day!==0);',
  '  if(ico&&typeof icon==="function")ico.innerHTML=icon(currentHeroCode,c.is_day===1,46);',
  '  if(mini&&typeof txt==="function")mini.textContent=txt(currentHeroCode,c.is_day!==0);',
  '}'
].join("\n");
if((html.split(HERO_OUD).length-1)!==1)throw new Error("Actuele hero-anchor ontbreekt of is dubbel.");
html=html.replace(HERO_OUD,HERO_NIEUW);

/* Een dataverversing mag niet betekenen dat een lang openstaande tab oude
   productlogica blijft draaien. De serviceworker claimt nieuwe clients al; de
   pagina controleert voortaan bij terugkeer expliciet op een update en herlaadt
   één keer wanneer een nieuwe controller daadwerkelijk actief wordt. Eerste
   bezoeken zonder bestaande controller krijgen geen extra reload. */
const SW_OUD='if("serviceWorker" in navigator){\n  window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));\n}';
const SW_NIEUW='if("serviceWorker" in navigator){\n  const weatherNowHadController=!!navigator.serviceWorker.controller;\n  let weatherNowSwReloading=false;\n  const weatherNowSwActiveerWachtend=reg=>{\n    if(reg&&reg.waiting)reg.waiting.postMessage("weathernow:skip-waiting");\n    return reg;\n  };\n  const weatherNowSwUpdate=()=>navigator.serviceWorker.getRegistration().then(reg=>{\n    if(!reg)return null;\n    weatherNowSwActiveerWachtend(reg);\n    return reg.update().then(()=>weatherNowSwActiveerWachtend(reg));\n  }).catch(()=>{});\n  navigator.serviceWorker.addEventListener("controllerchange",()=>{\n    if(!weatherNowHadController||weatherNowSwReloading)return;\n    weatherNowSwReloading=true;\n    location.reload();\n  });\n  window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").then(reg=>{weatherNowSwActiveerWachtend(reg);return weatherNowSwUpdate();}).catch(()=>{}));\n  window.addEventListener("pageshow",weatherNowSwUpdate);\n  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")weatherNowSwUpdate();});\n}';
if((html.split(SW_OUD).length-1)!==1)throw new Error("Serviceworker-registratieanchor ontbreekt of is dubbel.");
html=html.replace(SW_OUD,SW_NIEUW);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline scripts na unified-weather-truth.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:unified-weather-truth-"+(i+1)}));

fs.writeFileSync(htmlPad,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"unified-weather-truth");
console.log("Unified weather truth toegepast; daghorizons, actuele neerslag, hero, copy en updateflow geconsolideerd; cache "+versie+".");