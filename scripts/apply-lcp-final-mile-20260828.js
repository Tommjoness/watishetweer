"use strict";

const fs=require("fs");
const path=require("path");

const bestand=path.join(__dirname,"..","public","index.html");
if(!fs.existsSync(bestand))throw new Error("public/index.html ontbreekt; voer build eerst uit.");
let html=fs.readFileSync(bestand,"utf8");

const PRECONNECT='<link rel="preconnect" href="https://api.open-meteo.com" crossorigin>';
const DNS_PREFETCH='<link rel="dns-prefetch" href="//api.open-meteo.com">';
if(!html.includes(PRECONNECT)){
  const anker='<link rel="apple-touch-icon" href="/icon-192.png">';
  if(!html.includes(anker))throw new Error("Apple-touch-icon anker ontbreekt voor forecast-preconnect.");
  html=html.replace(anker,anker+"\n"+PRECONNECT+"\n"+DNS_PREFETCH);
}else if(!html.includes(DNS_PREFETCH)){
  html=html.replace(PRECONNECT,PRECONNECT+"\n"+DNS_PREFETCH);
}

const WOLKEN_OUD="weather_code,cloud_cover,pressure_msl,wind_speed_10m";
const WOLKEN_NIEUW="weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,pressure_msl,wind_speed_10m";
const wolkenAantal=html.split(WOLKEN_OUD).length-1;
if(wolkenAantal!==1)throw new Error("Current-wolkenanker ontbreekt of is dubbel: "+wolkenAantal);
html=html.replace(WOLKEN_OUD,WOLKEN_NIEUW);

const PRODUCT_CSS_MARK="/* ===== FINAL PRODUCT TRUTH 20260828 CSS ===== */";
if(!html.includes(PRODUCT_CSS_MARK)){
  const css='<style>'+PRODUCT_CSS_MARK+'\n.seo-plaatsnav{visibility:hidden}.seo-plaatsnav.weer-klaar{visibility:visible}\n</style>\n<noscript><style>.seo-plaatsnav{visibility:visible!important}</style></noscript>\n';
  if(!html.includes("</head>"))throw new Error("Head-eindanker ontbreekt voor CLS-stabilisatie.");
  html=html.replace("</head>",css+"</head>");
}

/* Intermitterende mobiele PageSpeed-runs lieten 0,528 CLS zien op main#app.
   UI-polish maakt #app vóór deze late laag al tot het main-landmark. Andere
   postbuildowners mogen extra niet-geometrische attributen aan dat landmark
   toevoegen, dus deze patch koppelt bewust aan de unieke semantische identiteit
   main#app en niet aan één volledige letterlijke openingstag.

   De oude display:none -> display:block-overgang gaf het volledige landmark vóór
   de eerste weerresponse geen layoutbox. Houd precies datzelfde main-element
   daarom vanaf first paint in de flow via visibility:hidden. De render vult de
   bestaande boxes en onthult daarna alleen painting, niet de complete structuur. */
const appOpenMatches=[...html.matchAll(/<main\b[^>]*\bid=(['"])app\1[^>]*>/gi)];
if(appOpenMatches.length!==1)throw new Error("Main-app-landmark ontbreekt of is dubbel: "+appOpenMatches.length);
const APP_OPEN_OUD=appOpenMatches[0][0];
let displayNoneAantal=0;
const APP_OPEN_NIEUW=APP_OPEN_OUD.replace(/\bstyle=(['"])(.*?)\1/i,(vol,quote,stijl)=>{
  const patroon=/(^|;)\s*display\s*:\s*none\s*(?=;|$)/gi;
  displayNoneAantal=(stijl.match(patroon)||[]).length;
  if(displayNoneAantal!==1)return vol;
  const nieuw=stijl.replace(/(^|;)\s*display\s*:\s*none\s*(?=;|$)/i,(_m,prefix)=>prefix+"visibility:hidden");
  return "style="+quote+nieuw+quote;
});
if(displayNoneAantal!==1)throw new Error("main#app moet vóór LCP-final-mile exact één display:none in zijn inline style hebben; gevonden: "+displayNoneAantal+"; opening: "+APP_OPEN_OUD);
if(APP_OPEN_NIEUW===APP_OPEN_OUD)throw new Error("main#app kon niet geometrisch worden gereserveerd.");
html=html.replace(APP_OPEN_OUD,APP_OPEN_NIEUW);

/* De progressieve locatiewissel mag na een bewuste gebruikersactie tijdelijk
   display:none gebruiken. Daarom herstelt de canonieke volledige forecast zowel
   display:block als visibility:visible. Op de eerste cold load is display al
   block dankzij de gereserveerde main-box; deze toekenning verandert daar dus
   geen geometrie. */
const APP_REVEAL_OUD='document.getElementById("app").style.display="block";';
const APP_REVEAL_NIEUW='Object.assign(document.getElementById("app").style,{display:"block",visibility:"visible"});';
const appRevealAantal=html.split(APP_REVEAL_OUD).length-1;
if(appRevealAantal!==2)throw new Error("App-revealanker verwacht exact twee keer, gevonden: "+appRevealAantal);
html=html.split(APP_REVEAL_OUD).join(APP_REVEAL_NIEUW);

const productRuntime=fs.readFileSync(path.join(__dirname,"final-product-truth-20260828.js"),"utf8");
const PRODUCT_JS_MARK="/* ===== FINAL PRODUCT TRUTH 20260828 ===== */";
const marker="/* ===== LCP FINAL MILE 20260828 ===== */";
if(!html.includes(marker)){
  const tekenAnker="function tekenAlles(){";
  if(!html.includes(tekenAnker))throw new Error("tekenAlles() ontbreekt; LCP-splitsing kan niet veilig worden toegepast.");
  const helper=`${PRODUCT_JS_MARK}\n${productRuntime}\n/* ===== EINDE FINAL PRODUCT TRUTH 20260828 ===== */\n\n${marker}\nlet nietKritiekeRenderToken=0;\nlet mobieleLuchtRenderUitgesteld=false;\nconst luchtVoorLcp=lucht;\nlucht=function(){\n  if(mobieleLuchtRenderUitgesteld&&S.air&&S.air.current)return;\n  return luchtVoorLcp.apply(this,arguments);\n};\nfunction mobieleLcpSplitsing(){\n  return typeof matchMedia===\"function\"&&matchMedia(\"(max-width: 900px)\").matches;\n}\nfunction toonSeoPlaatsnavNaRender(){\n  const waarheid=globalThis.WeatherNowFinalProductTruth;\n  if(waarheid&&typeof waarheid.toonSeoPlaatsnav===\"function\")waarheid.toonSeoPlaatsnav();\n}\nfunction planNietKritiekeWeergave(startIdx){\n  const token=++nietKritiekeRenderToken;\n  mobieleLuchtRenderUitgesteld=true;\n  const geldig=()=>token===nietKritiekeRenderToken;\n  const volgendFrame=fn=>{\n    if(!geldig())return;\n    if(typeof requestAnimationFrame===\"function\")requestAnimationFrame(()=>{if(geldig())fn();});\n    else setTimeout(()=>{if(geldig())fn();},16);\n  };\n  const stap4=()=>{\n    mobieleLuchtRenderUitgesteld=false;\n    lucht();nuTimerStart();klokTimerStart();toonSeoPlaatsnavNaRender();\n  };\n  const stap3=()=>{nachten();volgendFrame(stap4);};\n  const stap2=()=>{dagen();volgendFrame(stap3);};\n  const stap1=()=>{etmaal(startIdx,S.bereik);nowcast();volgendFrame(stap2);};\n  if(typeof requestAnimationFrame===\"function\")requestAnimationFrame(()=>requestAnimationFrame(()=>{if(geldig())stap1();}));\n  else setTimeout(()=>{if(geldig())stap1();},0);\n}\nfunction renderNietKritiekeWeergave(startIdx){\n  if(mobieleLcpSplitsing()){planNietKritiekeWeergave(startIdx);return;}\n  nietKritiekeRenderToken++;\n  mobieleLuchtRenderUitgesteld=false;\n  etmaal(startIdx,S.bereik);nowcast();dagen();nachten();lucht();nuTimerStart();klokTimerStart();toonSeoPlaatsnavNaRender();\n}\n\n`;
  html=html.replace(tekenAnker,helper+tekenAnker);
}

const oud=/meters\(\);briefing\(\);etmaal\(startIdx,S\.bereik\);nowcast\(\);dagen\(\);nachten\(\);lucht\(\);stempel\(\);\s*nuTimerStart\(\);\s*klokTimerStart\(\);/;
if(oud.test(html)){
  html=html.replace(oud,'if(mobieleLcpSplitsing()){briefing();meters();}else{meters();briefing();}stempel();\n  renderNietKritiekeWeergave(startIdx);');
}

if(!html.includes(marker))throw new Error("LCP-marker ontbreekt na patch.");
if(!html.includes(PRODUCT_JS_MARK))throw new Error("Final-product-truth runtime ontbreekt na patch.");
if(oud.test(html))throw new Error("Oude monolithische tekenAlles-renderroute is blijven staan.");
if(/<main\b[^>]*\bid=(['"])app\1[^>]*\bstyle=(['"])[^>]*\bdisplay\s*:\s*none/i.test(html))throw new Error("main#app staat nog op display:none in de finale artifact.");
if(html.includes(APP_REVEAL_OUD))throw new Error("Oude kale display:block-appreveal staat nog in de artifact.");
if((html.split(APP_REVEAL_NIEUW).length-1)!==2)throw new Error("Canonieke app-reveal moet exact twee keer display en visibility herstellen.");
if((html.match(/rel=\"preconnect\" href=\"https:\/\/api\.open-meteo\.com\"/g)||[]).length!==1)throw new Error("Forecast-preconnect moet exact één keer aanwezig zijn.");
if((html.match(/rel=\"dns-prefetch\" href=\"\/\/api\.open-meteo\.com\"/g)||[]).length!==1)throw new Error("Forecast DNS-prefetch moet exact één keer aanwezig zijn.");

fs.writeFileSync(bestand,html);
console.log("LCP final-mile toegepast: forecast preconnect + DNS fallback, wolkenlagen, geometrisch gereserveerd main#app, cold-load zonder progressieve display-toggle en finale consumentencopy.");
