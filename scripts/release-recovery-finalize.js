"use strict";

const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const SEO=require("./seo-foundation.config.js");
const {LOCATIES}=require("./seo-locations.config.js");
const {TITLE_NIEUW,TITLE_WRITERS}=require("./apply-seo-location-h1.js");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const ROOT_HTML=path.join(OUT,"index.html");
const START_HAAK="(function(){\n  const p=new URLSearchParams(location.search);\n";
const URL_SYNC_HAAK=`  try{\n    const u=new URL(location.href);\n    u.searchParams.set("lat",S.lat.toFixed(3));u.searchParams.set("lon",S.lon.toFixed(3));\n    u.searchParams.set("plaats",S.label);\n    if(S.land) u.searchParams.set("land",S.land); else u.searchParams.delete("land");\n    history.replaceState(null,"",u);\n  }catch(e){}\n`;
const ROOT_ROUTE_MARKER="<!-- WEATHER NOW ROOT ROUTEDATA -->";
const WATCHDOG_ID="weather-bootstrap-watchdog";
const FAILURE_ID="bootstrap-failure";
const NOSCRIPT_ID="weather-js-required";
const READY_EVENT="weathernow:app-ready";

function tel(tekst,zoek){return String(tekst).split(zoek).length-1;}
function vervangExact(bron,oud,nieuw,label){
  const aantal=tel(bron,oud);
  if(aantal!==1)throw new Error(`${label}: verwacht exact één anker, gevonden ${aantal}.`);
  return bron.replace(oud,nieuw);
}
function hash12(v){return crypto.createHash("sha256").update(String(v)).digest("hex").slice(0,12);}

function watchdogBron(){
  return `(function(){\n"use strict";\nconst READY=${JSON.stringify(READY_EVENT)},APP=/\\/app-[0-9a-f]{12}\\.min\\.js(?:$|\\?)/;\nlet gefaald=false;\nfunction onderdelen(){return Array.from(document.querySelectorAll(".tools input,.tools button"));}\nfunction bediening(uit){\n  onderdelen().forEach(el=>{el.disabled=!!uit;el.setAttribute("aria-disabled",uit?"true":"false");});\n  const tools=document.querySelector(".tools");\n  if(tools){tools.style.opacity=uit?".55":"";tools.style.pointerEvents=uit?"none":"";}\n}\nfunction foutUi(){\n  document.documentElement.dataset.appBootstrap="failed";bediening(true);\n  const state=document.getElementById("state");\n  if(state){if(state.style.display!=="none")state.dataset.bootstrapHidden="1";state.style.display="none";}\n  const fout=document.getElementById(${JSON.stringify(FAILURE_ID)});if(fout)fout.hidden=false;\n}\nfunction herstel(){\n  gefaald=false;document.documentElement.dataset.appBootstrap="ready";bediening(false);\n  const fout=document.getElementById(${JSON.stringify(FAILURE_ID)});if(fout)fout.hidden=true;\n  const state=document.getElementById("state");\n  if(state&&state.dataset.bootstrapHidden==="1"){state.style.display="block";delete state.dataset.bootstrapHidden;}\n}\nfunction mislukt(){\n  if(window.__WEATHERNOW_APP_READY__)return;\n  gefaald=true;document.documentElement.dataset.appBootstrap="failed";\n  if(document.readyState==="loading")return;\n  foutUi();\n}\nfunction pending(){\n  if(window.__WEATHERNOW_APP_READY__){herstel();return;}\n  if(gefaald){foutUi();return;}\n  document.documentElement.dataset.appBootstrap="pending";bediening(true);\n}\nwindow.addEventListener(READY,herstel);\nwindow.addEventListener("error",e=>{const t=e&&e.target;if(t&&t.tagName==="SCRIPT"&&APP.test(String(t.src||"")))mislukt();},true);\ndocument.addEventListener("DOMContentLoaded",pending,{once:true});\nsetTimeout(mislukt,30000);\n})();`;
}
function schrijfWatchdogBundle(){
  const bron=watchdogBron();
  const naam=`bootstrap-${hash12(bron)}.js`;
  fs.writeFileSync(path.join(OUT,naam),bron,"utf8");
  return naam;
}

function voegBootstrapHerstelToe(html,watchdogNaam){
  let bron=String(html||"");
  if(bron.includes(`id=\"${WATCHDOG_ID}\"`)||bron.includes(`id='${WATCHDOG_ID}'`))return bron;
  if(!/^bootstrap-[0-9a-f]{12}\.js$/.test(String(watchdogNaam||"")))throw new Error("Ongeldige watchdog-bundlenaam.");

  /* De watchdog is bewust een eigen, zeer kleine first-party resource. Hij moet
     al luisteren vóór de hoofdapp wordt aangevraagd, zodat een geblokkeerde
     app-bundle aantoonbaar een foutstate oplevert. Hij wordt niet in de main
     app gebundeld en ook niet als delivery early-*.js behandeld. */
  const watchdog=`<script id="${WATCHDOG_ID}" src="/${watchdogNaam}"></script>\n`;
  const eersteStijl=bron.search(/<style\b/i);
  if(eersteStijl<0)throw new Error("Bootstrap-watchdog kan niet vóór het eerste stijlblok worden geplaatst.");
  bron=bron.slice(0,eersteStijl)+watchdog+bron.slice(eersteStijl);

  const sheet='<div class="sheet" data-nosnippet>';
  const noscript=`<noscript id="${NOSCRIPT_ID}"><style>.tools,#chips,#state,#stamp,#minibar{display:none!important}</style><div class="msg err" role="alert">JavaScript is nodig om actuele weergegevens op te halen. Schakel JavaScript in en <a href="">laad deze pagina opnieuw</a>.</div></noscript>`;
  bron=vervangExact(bron,sheet,sheet+"\n"+noscript,"noscript-shell");

  const state='<div id="state" class="msg" role="status" aria-live="polite">Gegevens ophalen.</div>';
  const failed=`<div id="${FAILURE_ID}" class="msg err" role="alert" hidden>De weerapp kon niet worden gestart. Controleer je verbinding en <a href="">laad de pagina opnieuw</a>.</div>`;
  bron=vervangExact(bron,state,state+"\n"+failed,"failed-js-state");

  const urlAnker="\nfunction urlBij(){";
  const pageshow=`\nwindow.addEventListener("pageshow",()=>{\n  if(!S.d)return;\n  klokBijwerken();\n  stempel();\n});\n`;
  bron=vervangExact(bron,urlAnker,pageshow+urlAnker,"BFCache-pageshow-haak");

  const swAnker='\nif("serviceWorker" in navigator){';
  const ready=`\nwindow.__WEATHERNOW_APP_READY__=true;\nwindow.dispatchEvent(new Event(${JSON.stringify(READY_EVENT)}));\n`;
  bron=vervangExact(bron,swAnker,ready+swAnker,"app-ready-signaal");
  return bron;
}

function voegGedeeldRouteUrlBeleidToe(html,label){
  let bron=String(html||"");
  if(tel(bron,URL_SYNC_HAAK)!==1)throw new Error(`${label}: URL-sync-haak ontbreekt of is dubbel.`);
  const websiteJson=JSON.stringify({"@context":"https://schema.org","@type":"WebSite",name:SEO.siteName,url:SEO.canonical});
  const gedeeld=`  try{\n    const route=window.__WEATHERNOW_ROUTE_LOCATION__;\n    const routeGeldig=route&&Number.isFinite(Number(route.lat))&&Number.isFinite(Number(route.lon))&&!!route.name;\n    const zelfdeRoute=routeGeldig&&Number(S.lat)===Number(route.lat)&&Number(S.lon)===Number(route.lon);\n    if(routeGeldig){\n      if(!zelfdeRoute){\n        window.__WEATHERNOW_ROUTE_LOCATION__=null;\n        const canonical=document.querySelector('link[rel="canonical"]');\n        if(canonical)canonical.href=${JSON.stringify(SEO.canonical)};\n        const description=document.querySelector('meta[name="description"]');\n        if(description)description.content=${JSON.stringify(SEO.description)};\n        const ogTitle=document.querySelector('meta[property="og:title"]');\n        if(ogTitle)ogTitle.content=${JSON.stringify(SEO.title)};\n        const ogDescription=document.querySelector('meta[property="og:description"]');\n        if(ogDescription)ogDescription.content=${JSON.stringify(SEO.description)};\n        const ogUrl=document.querySelector('meta[property="og:url"]');\n        if(ogUrl)ogUrl.content=${JSON.stringify(SEO.canonical)};\n        const structured=document.querySelector('script[type="application/ld+json"]');\n        if(structured)structured.textContent=${JSON.stringify(websiteJson)};\n        const context=document.querySelector(".seo-route-context");\n        if(context)context.hidden=true;\n        const hoofdkop=document.querySelector(".mast h1");\n        if(hoofdkop)hoofdkop.textContent="watishetweer.nl";\n        const u=new URL("/",location.origin);\n        u.searchParams.set("lat",S.lat.toFixed(3));u.searchParams.set("lon",S.lon.toFixed(3));\n        u.searchParams.set("plaats",S.label);\n        if(S.land) u.searchParams.set("land",S.land); else u.searchParams.delete("land");\n        history.replaceState(null,"",u);\n      }\n    }else{\n      const u=new URL(location.href);\n      u.searchParams.set("lat",S.lat.toFixed(3));u.searchParams.set("lon",S.lon.toFixed(3));\n      u.searchParams.set("plaats",S.label);\n      if(S.land) u.searchParams.set("land",S.land); else u.searchParams.delete("land");\n      history.replaceState(null,"",u);\n    }\n  }catch(e){}\n`;
  return bron.replace(URL_SYNC_HAAK,gedeeld);
}

function voegGedeeldTitelBeleidToe(html,label){
  let bron=String(html||"");
  const aantal=tel(bron,TITLE_NIEUW);
  if(aantal!==TITLE_WRITERS)throw new Error(`${label}: verwacht exact ${TITLE_WRITERS} finale merk-title-writers, gevonden ${aantal}.`);
  const routeBewust=`{\n    const route=window.__WEATHERNOW_ROUTE_LOCATION__;\n    const routeGeldig=route&&Number.isFinite(Number(route.lat))&&Number.isFinite(Number(route.lon))&&!!route.name;\n    const zelfdeRoute=routeGeldig&&Number(S.lat)===Number(route.lat)&&Number(S.lon)===Number(route.lon);\n    if(!zelfdeRoute) document.title=S.label+" · watishetweer.nl";\n  }`;
  return bron.split(TITLE_NIEUW).join(routeBewust);
}

function voegGedeeldeRouteRuntimeToe(html,label){
  let bron=voegGedeeldRouteUrlBeleidToe(String(html||""),label);
  bron=voegGedeeldTitelBeleidToe(bron,label);
  if(tel(bron,START_HAAK)!==1)throw new Error(`${label}: start-haak ontbreekt of is dubbel.`);
  const routeStart=`(function(){\n  const route=window.__WEATHERNOW_ROUTE_LOCATION__;\n  if(route&&Number.isFinite(Number(route.lat))&&Number.isFinite(Number(route.lon))&&route.name){\n    q.value=route.name;\n    load(Number(route.lat),Number(route.lon),route.name,false,false,normLand(route.country));\n    return;\n  }\n  const p=new URLSearchParams(location.search);\n`;
  return bron.replace(START_HAAK,routeStart);
}

function isDataScript(attrs){
  return /\btype\s*=\s*["'](?:application\/ld\+json|application\/json)["']/i.test(String(attrs||""));
}
function isExternScript(attrs){return /\bsrc\s*=/i.test(String(attrs||""));}
function isRouteBootstrap(body){return /^\s*window\.__WEATHERNOW_ROUTE_LOCATION__=Object\.freeze\(/.test(String(body||""));}
function executableScripts(html,routeBootstrapOverslaan){
  const uit=[];
  for(const m of String(html||"").matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)){
    if(isDataScript(m[1]))continue;
    if(routeBootstrapOverslaan&&isRouteBootstrap(m[2]))continue;
    uit.push(m[0]);
  }
  return uit;
}
function normaliseerRouteScripts(routeHtml,gedeeldHtml,slug){
  const gedeeld=executableScripts(gedeeldHtml,false);
  let index=0;
  const uit=String(routeHtml||"").replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi,(vol,attrs,body)=>{
    if(isDataScript(attrs)||isRouteBootstrap(body))return vol;
    if(index>=gedeeld.length)throw new Error(`${slug}: route bevat meer executable scripts dan de gedeelde runtime.`);
    return gedeeld[index++];
  });
  if(index!==gedeeld.length)throw new Error(`${slug}: route bevat ${index} gedeelde executable scripts, verwacht ${gedeeld.length}.`);
  return uit;
}

function voegRootRouteDataToe(html){
  let bron=String(html||"");
  if(bron.includes(ROOT_ROUTE_MARKER))return bron;
  if(tel(bron,"</head>")!==1)throw new Error("Root-routedata verwacht exact één head-einde.");
  const bootstrap=`${ROOT_ROUTE_MARKER}\n<script>window.__WEATHERNOW_ROUTE_LOCATION__=Object.freeze({});</script>`;
  return bron.replace("</head>",bootstrap+"\n</head>");
}

function verifieerVoorDelivery(rootHtml,watchdogNaam){
  const vereist=[
    `id="${WATCHDOG_ID}"`,`src="/${watchdogNaam}"`,`id="${FAILURE_ID}"`,`id="${NOSCRIPT_ID}"`,
    'window.addEventListener("pageshow"','klokBijwerken();','stempel();',
    'window.__WEATHERNOW_APP_READY__=true',READY_EVENT,ROOT_ROUTE_MARKER,
    'const routeGeldig=route&&Number.isFinite(Number(route.lat))'
  ];
  for(const marker of vereist)if(!rootHtml.includes(marker))throw new Error("Release-herstelmarker ontbreekt vóór delivery: "+marker);
  if(!rootHtml.includes("AbortController")||!rootHtml.includes("laadTeller")||!rootHtml.includes("zoekGeneratie"))throw new Error("Bestaande request/race-hardening ontbreekt na release-herstel.");
  const watchdogPad=path.join(OUT,watchdogNaam);
  if(!fs.existsSync(watchdogPad)||fs.readFileSync(watchdogPad,"utf8")!==watchdogBron())throw new Error("Watchdog-bundle ontbreekt of hoort niet bij de actuele herstelcode.");
}

function finaliseerRelease(){
  if(!fs.existsSync(ROOT_HTML))throw new Error("public/index.html ontbreekt voor release-herstel.");
  const watchdogNaam=schrijfWatchdogBundle();
  const finaleRoot=fs.readFileSync(ROOT_HTML,"utf8");
  const rootHersteld=voegBootstrapHerstelToe(finaleRoot,watchdogNaam);
  const gedeeld=voegGedeeldeRouteRuntimeToe(rootHersteld,"release-root");

  for(const loc of LOCATIES){
    const routePad=path.join(OUT,"weer",loc.slug,"index.html");
    if(!fs.existsSync(routePad))throw new Error(`${loc.slug}: finale plaatsroute ontbreekt vóór release-herstel.`);
    const routeBestaand=fs.readFileSync(routePad,"utf8");
    if(!routeBestaand.includes("<!-- WEATHER NOW PLAATSROUTE -->"))throw new Error(`${loc.slug}: routebootstrap ontbreekt in finale plaatsroute.`);
    const routeHersteld=voegBootstrapHerstelToe(routeBestaand,watchdogNaam);
    const routeMetGedeeldeRuntime=normaliseerRouteScripts(routeHersteld,gedeeld,loc.slug);
    fs.writeFileSync(routePad,routeMetGedeeldeRuntime,"utf8");
  }

  const rootMetRouteData=voegRootRouteDataToe(gedeeld);
  fs.writeFileSync(ROOT_HTML,rootMetRouteData,"utf8");
  verifieerVoorDelivery(rootMetRouteData,watchdogNaam);
  const cache=vernieuwServiceworkerCache(OUT,"release-recovery-finalize");
  console.log(`Release-herstel gefinaliseerd: ${LOCATIES.length} bestaande finale plaatsroutes delen nu exact de finale root-runtime; onafhankelijke ${watchdogNaam}, no/failed-JS en BFCache-freshness actief; cache ${cache}.`);
  return {routes:LOCATIES.length,cache,watchdogNaam};
}

if(require.main===module)finaliseerRelease();
module.exports={
  watchdogBron,schrijfWatchdogBundle,voegBootstrapHerstelToe,voegGedeeldRouteUrlBeleidToe,voegGedeeldTitelBeleidToe,
  voegGedeeldeRouteRuntimeToe,normaliseerRouteScripts,voegRootRouteDataToe,finaliseerRelease,
  WATCHDOG_ID,FAILURE_ID,NOSCRIPT_ID,ROOT_ROUTE_MARKER
};
