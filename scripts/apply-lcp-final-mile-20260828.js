"use strict";

const fs=require("fs");
const path=require("path");

const bestand=path.join(__dirname,"..","public","index.html");
if(!fs.existsSync(bestand))throw new Error("public/index.html ontbreekt; voer build eerst uit.");
let html=fs.readFileSync(bestand,"utf8");

const PRECONNECT='<link rel="preconnect" href="https://api.open-meteo.com" crossorigin>';
const DNS_PREFETCH='<link rel="dns-prefetch" href="//api.open-meteo.com">';
if(!html.includes(PRECONNECT)){
  const anker='<link rel="apple-touch-icon" href="icon-192.png">';
  if(!html.includes(anker))throw new Error("Apple-touch-icon anker ontbreekt voor forecast-preconnect.");
  html=html.replace(anker,anker+"\n"+PRECONNECT+"\n"+DNS_PREFETCH);
}else if(!html.includes(DNS_PREFETCH)){
  html=html.replace(PRECONNECT,PRECONNECT+"\n"+DNS_PREFETCH);
}

/* Voor de actuele wolkenomschrijving zijn de verticale lagen nodig. Alleen de
   current-response wordt uitgebreid; de 170-uurs forecastpayload blijft dus
   ongewijzigd groot. Open-Meteo ondersteunt deze drie waarden als instant
   cloud-covervelden. */
const WOLKEN_OUD="weather_code,cloud_cover,pressure_msl,wind_speed_10m";
const WOLKEN_NIEUW="weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,pressure_msl,wind_speed_10m";
const wolkenAantal=html.split(WOLKEN_OUD).length-1;
if(wolkenAantal!==1)throw new Error("Current-wolkenanker ontbreekt of is dubbel: "+wolkenAantal);
html=html.replace(WOLKEN_OUD,WOLKEN_NIEUW);

/* De SEO-plaatsnav stond al in de eerste paint terwijl de mobiele onderliggende
   secties daarna over frames werden gevuld. Daardoor was de nav het zichtbare
   element dat 0,116 CLS opliep. Houd hem wel in de DOM/layout, maar nog niet
   zichtbaar; pas na de laatste geplande mobiele renderstap wordt hij onthuld.
   visibility verandert de geometrie niet. Zonder JavaScript blijft de navigatie
   via de noscript-regel gewoon zichtbaar. */
const PRODUCT_CSS_MARK="/* ===== FINAL PRODUCT TRUTH 20260828 CSS ===== */";
if(!html.includes(PRODUCT_CSS_MARK)){
  const css='<style>'+PRODUCT_CSS_MARK+'\n.seo-plaatsnav{visibility:hidden}.seo-plaatsnav.weer-klaar{visibility:visible}\n</style>\n<noscript><style>.seo-plaatsnav{visibility:visible!important}</style></noscript>\n';
  if(!html.includes("</head>"))throw new Error("Head-eindanker ontbreekt voor CLS-stabilisatie.");
  html=html.replace("</head>",css+"</head>");
}

/* Intermitterende mobiele PageSpeed-runs lieten 0,528 CLS zien op main#app.
   UI-polish heeft #app vóór deze late laag al bewust tot het main-landmark
   gemaakt. De oude display:none -> display:block-overgang gaf dat volledige
   landmark vóór de eerste weerresponse geen layoutbox. Houd precies datzelfde
   main-element daarom vanaf first paint in de flow via visibility:hidden. De
   render vult de bestaande boxes en onthult daarna alleen painting, niet de
   complete documentstructuur. */
const APP_OUD='<main id="app" style="display:none">';
const APP_NIEUW='<main id="app" style="visibility:hidden">';
const appAantal=html.split(APP_OUD).length-1;
if(appAantal!==1)throw new Error("Main-app-startanker ontbreekt of is dubbel: "+appAantal);
html=html.replace(APP_OUD,APP_NIEUW);
const APP_REVEAL_OUD='document.getElementById("app").style.display="block";';
const appRevealAantal=html.split(APP_REVEAL_OUD).length-1;
if(appRevealAantal!==2)throw new Error("App-revealanker verwacht exact twee keer, gevonden: "+appRevealAantal);
html=html.split(APP_REVEAL_OUD).join('document.getElementById("app").style.visibility="visible";');

const productRuntime=fs.readFileSync(path.join(__dirname,"final-product-truth-20260828.js"),"utf8");
const PRODUCT_JS_MARK="/* ===== FINAL PRODUCT TRUTH 20260828 ===== */";
const marker="/* ===== LCP FINAL MILE 20260828 ===== */";
if(!html.includes(marker)){
  const tekenAnker="function tekenAlles(){";
  if(!html.includes(tekenAnker))throw new Error("tekenAlles() ontbreekt; LCP-splitsing kan niet veilig worden toegepast.");
  const helper=`${PRODUCT_JS_MARK}\n${productRuntime}\n/* ===== EINDE FINAL PRODUCT TRUTH 20260828 ===== */\n\n${marker}\nlet nietKritiekeRenderToken=0;\nlet mobieleLuchtRenderUitgesteld=false;\nconst luchtVoorLcp=lucht;\nlucht=function(){\n  /* Een geslaagde AQI-response mag de geplande mobiele framevolgorde niet\n     inhalen. Een foutstatus (S.air=null) moet juist meteen eerlijk zichtbaar\n     zijn; performancepolish mag degradatiefeedback nooit verbergen. */\n  if(mobieleLuchtRenderUitgesteld&&S.air&&S.air.current)return;\n  return luchtVoorLcp.apply(this,arguments);\n};\nfunction mobieleLcpSplitsing(){\n  return typeof matchMedia===\"function\"&&matchMedia(\"(max-width: 900px)\").matches;\n}\nfunction toonSeoPlaatsnavNaRender(){\n  const waarheid=globalThis.WeatherNowFinalProductTruth;\n  if(waarheid&&typeof waarheid.toonSeoPlaatsnav===\"function\")waarheid.toonSeoPlaatsnav();\n}\nfunction planNietKritiekeWeergave(startIdx){\n  const token=++nietKritiekeRenderToken;\n  mobieleLuchtRenderUitgesteld=true;\n  const geldig=()=>token===nietKritiekeRenderToken;\n  const volgendFrame=fn=>{\n    if(!geldig())return;\n    if(typeof requestAnimationFrame===\"function\")requestAnimationFrame(()=>{if(geldig())fn();});\n    else setTimeout(()=>{if(geldig())fn();},16);\n  };\n  const stap4=()=>{\n    mobieleLuchtRenderUitgesteld=false;\n    lucht();nuTimerStart();klokTimerStart();toonSeoPlaatsnavNaRender();\n  };\n  const stap3=()=>{nachten();volgendFrame(stap4);};\n  const stap2=()=>{dagen();volgendFrame(stap3);};\n  const stap1=()=>{etmaal(startIdx,S.bereik);nowcast();volgendFrame(stap2);};\n  /* Alleen de mobiele PageSpeed-route wordt opgesplitst. Desktop behoudt de\n     bewezen directe rendersemantiek. Twee frames geven mobiel een echte\n     paintkans voor de briefing voordat onder-de-vouwmodules renderen.\n     Een geslaagde luchtkwaliteitresponse blijft tot stap 4 geblokkeerd zodat\n     de framevolgorde ook in WebKit deterministisch blijft; fouten renderen\n     direct via de wrapper hierboven. */\n  if(typeof requestAnimationFrame===\"function\")requestAnimationFrame(()=>requestAnimationFrame(()=>{if(geldig())stap1();}));\n  else setTimeout(()=>{if(geldig())stap1();},0);\n}\nfunction renderNietKritiekeWeergave(startIdx){\n  if(mobieleLcpSplitsing()){planNietKritiekeWeergave(startIdx);return;}\n  nietKritiekeRenderToken++;\n  mobieleLuchtRenderUitgesteld=false;\n  etmaal(startIdx,S.bereik);nowcast();dagen();nachten();lucht();nuTimerStart();klokTimerStart();toonSeoPlaatsnavNaRender();\n}\n\n`;
  html=html.replace(tekenAnker,helper+tekenAnker);
}

const oud=/meters\(\);briefing\(\);etmaal\(startIdx,S\.bereik\);nowcast\(\);dagen\(\);nachten\(\);lucht\(\);stempel\(\);\s*nuTimerStart\(\);\s*klokTimerStart\(\);/;
if(oud.test(html)){
  /* Op mobiel is de briefing het gemeten LCP-element. Hij heeft geen DOM-output
     van meters() nodig en mag daarom vóór de meterrender aan de browser worden
     aangeboden. Desktop behoudt de bestaande volgorde. */
  html=html.replace(oud,'if(mobieleLcpSplitsing()){briefing();meters();}else{meters();briefing();}stempel();\n  renderNietKritiekeWeergave(startIdx);');
}

if(!html.includes(marker))throw new Error("LCP-marker ontbreekt na patch.");
if(!html.includes(PRODUCT_JS_MARK))throw new Error("Final-product-truth runtime ontbreekt na patch.");
if(oud.test(html))throw new Error("Oude monolithische tekenAlles-renderroute is blijven staan.");
if(html.includes(APP_OUD))throw new Error("main#app staat nog op display:none in de finale artifact.");
if(html.includes(APP_REVEAL_OUD))throw new Error("main#app wordt nog via display:block onthuld.");
if((html.match(/rel=\"preconnect\" href=\"https:\/\/api\.open-meteo\.com\"/g)||[]).length!==1)throw new Error("Forecast-preconnect moet exact één keer aanwezig zijn.");
if((html.match(/rel=\"dns-prefetch\" href=\"\/\/api\.open-meteo\.com\"/g)||[]).length!==1)throw new Error("Forecast DNS-prefetch moet exact één keer aanwezig zijn.");

fs.writeFileSync(bestand,html);
console.log("LCP final-mile toegepast: forecast preconnect + DNS fallback, wolkenlagen, geometrisch gereserveerd main#app, CLS-stabiele plaatsnav, vroegere mobiele briefing en finale consumentencopy.");
