"use strict";

const fs=require("fs");
const path=require("path");
const SEO=require("./seo-foundation.config.js");
const {LOCATIES}=require("./seo-locations.config.js");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const PUBLIC=path.join(ROOT,"public");
const ROOT_HTML=path.join(PUBLIC,"index.html");

const RELEASE_MARKER="/* WEATHER NOW RELEASE ROUTEBELEID 20260904 */";
const WATCHDOG_MARKER="WEATHER NOW BOOTSTRAP WATCHDOG 20260904";
const PAGESHOW_MARKER="WEATHER NOW BFCACHE FRESHNESS 20260904";
const START_HAAK="(function(){\n  const p=new URLSearchParams(location.search);\n";
const URL_SYNC_HAAK=`  try{
    const u=new URL(location.href);
    u.searchParams.set("lat",S.lat.toFixed(3));u.searchParams.set("lon",S.lon.toFixed(3));
    u.searchParams.set("plaats",S.label);
    if(S.land) u.searchParams.set("land",S.land); else u.searchParams.delete("land");
    history.replaceState(null,"",u);
  }catch(e){}
`;
const TITLE_SYNC_HAAK='document.title=S.label+" · watishetweer.nl";';
const TITLE_SYNC_WRITERS=2;
const NAV_MARKER="<!-- WEATHER NOW INDEXEERBARE PLAATSEN -->";

function tel(bron,zoek){return String(bron).split(zoek).length-1;}
function exactEen(bron,re,label){
  const m=String(bron).match(re);
  if(!m||m.length!==1)throw new Error(`${label}: verwacht exact één match, gevonden ${m?m.length:0}.`);
  return m[0];
}
function vervangEen(bron,oud,nieuw,label){
  const aantal=tel(bron,oud);
  if(aantal!==1)throw new Error(`${label}: verwacht exact één bronanker, gevonden ${aantal}.`);
  return bron.replace(oud,nieuw);
}

function voegGedeeldRoutebeleidToe(html){
  let bron=String(html||"");
  if(bron.includes(RELEASE_MARKER))return bron;
  if(tel(bron,START_HAAK)!==1)throw new Error("release-root: start-haak ontbreekt of is dubbel.");
  if(tel(bron,URL_SYNC_HAAK)!==1)throw new Error("release-root: URL-sync-haak ontbreekt of is dubbel.");
  if(tel(bron,TITLE_SYNC_HAAK)!==TITLE_SYNC_WRITERS)throw new Error(`release-root: verwacht ${TITLE_SYNC_WRITERS} dynamische title-writers, gevonden ${tel(bron,TITLE_SYNC_HAAK)}.`);

  const routeUrl=`  try{
    const route=window.__WEATHERNOW_ROUTE_LOCATION__;
    const zelfdeRoute=route&&Number(S.lat)===Number(route.lat)&&Number(S.lon)===Number(route.lon);
    if(!zelfdeRoute){
      if(route){
        window.__WEATHERNOW_ROUTE_LOCATION__=null;
        const canonical=document.querySelector('link[rel="canonical"]');
        if(canonical)canonical.href=${JSON.stringify(SEO.canonical)};
        const description=document.querySelector('meta[name="description"]');
        if(description)description.content=${JSON.stringify(SEO.description)};
        const ogTitle=document.querySelector('meta[property="og:title"]');
        if(ogTitle)ogTitle.content=${JSON.stringify(SEO.title)};
        const ogDescription=document.querySelector('meta[property="og:description"]');
        if(ogDescription)ogDescription.content=${JSON.stringify(SEO.description)};
        const ogUrl=document.querySelector('meta[property="og:url"]');
        if(ogUrl)ogUrl.content=${JSON.stringify(SEO.canonical)};
        const structured=document.querySelector('script[type="application/ld+json"]');
        if(structured)structured.textContent=${JSON.stringify(JSON.stringify({"@context":"https://schema.org","@type":"WebSite",name:SEO.siteName,url:SEO.canonical}))};
        const context=document.querySelector(".seo-route-context");
        if(context)context.hidden=true;
        const hoofdkop=document.querySelector(".mast h1");
        if(hoofdkop)hoofdkop.textContent="watishetweer.nl";
      }
      const u=new URL("/",location.origin);
      u.searchParams.set("lat",S.lat.toFixed(3));u.searchParams.set("lon",S.lon.toFixed(3));
      u.searchParams.set("plaats",S.label);
      if(S.land) u.searchParams.set("land",S.land); else u.searchParams.delete("land");
      history.replaceState(null,"",u);
    }
  }catch(e){}
`;
  const routeTitel=`{
    const route=window.__WEATHERNOW_ROUTE_LOCATION__;
    const zelfdeRoute=route&&Number(S.lat)===Number(route.lat)&&Number(S.lon)===Number(route.lon);
    if(!zelfdeRoute) document.title=S.label+" · watishetweer.nl";
  }`;
  const routeStart=`(function(){
  ${RELEASE_MARKER}
  const route=window.__WEATHERNOW_ROUTE_LOCATION__;
  if(route&&Number.isFinite(route.lat)&&Number.isFinite(route.lon)&&route.name){
    q.value=route.name;
    load(route.lat,route.lon,route.name,false,false,normLand(route.country));
    return;
  }
  const p=new URLSearchParams(location.search);
`;

  bron=bron.replace(URL_SYNC_HAAK,routeUrl);
  bron=bron.split(TITLE_SYNC_HAAK).join(routeTitel);
  bron=bron.replace(START_HAAK,routeStart);
  return bron;
}

function voegBootstrapHerstelToe(html){
  let bron=String(html||"");
  if(bron.includes(WATCHDOG_MARKER))return bron;

  const watchdog=`<script>
/* ${WATCHDOG_MARKER} */
(function(){
  const root=document.documentElement;
  root.classList.add("weather-app-booting");
  let timer=null;
  function controls(uit){
    for(const id of ["q","here","ververs","thema"]){
      const el=document.getElementById(id);
      if(!el)continue;
      if(uit){el.disabled=true;el.setAttribute("aria-disabled","true");}
      else{el.disabled=false;el.removeAttribute("aria-disabled");}
    }
  }
  function syncControls(){controls(root.dataset.weatherAppReady!=="1");}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",syncControls,{once:true});else syncControls();
  window.__weatherNowMarkAppReady=function(){
    root.dataset.weatherAppReady="1";
    root.classList.remove("weather-app-booting","weather-app-failed");
    if(timer!==null){clearTimeout(timer);timer=null;}
    controls(false);
    const status=document.getElementById("weather-bootstrap-status");
    if(status)status.hidden=true;
  };
  timer=setTimeout(function(){
    if(root.dataset.weatherAppReady==="1")return;
    root.classList.remove("weather-app-booting");
    root.classList.add("weather-app-failed");
    controls(true);
    const status=document.getElementById("weather-bootstrap-status");
    if(status)status.hidden=false;
  },15000);
})();
</script>`;
  const css=`<style id="weather-release-recovery-styles">
.weather-app-booting .tools,.weather-app-failed .tools{opacity:.58}
.weather-app-failed #state,.weather-app-failed #app{display:none!important}
#weather-bootstrap-status[hidden]{display:none!important}
#weather-bootstrap-status a,#weather-noscript a{color:inherit;font-weight:500}
</style>
<noscript><style>
.tools input,.tools button{pointer-events:none!important;opacity:.55!important}
#state,#app,#weather-bootstrap-status{display:none!important}
</style></noscript>`;
  const eersteStijl=bron.search(/<style\b/i);
  if(eersteStijl<0)throw new Error("Bootstrap-watchdog: eerste styleblok ontbreekt.");
  bron=bron.slice(0,eersteStijl)+watchdog+"\n"+css+"\n"+bron.slice(eersteStijl);

  for(const id of ["q","here","ververs","thema"]){
    const re=new RegExp(`(<(?:input|button)\\b[^>]*\\bid="${id}"[^>]*)(>)`);
    const m=bron.match(re);
    if(!m||m.length<2)throw new Error(`Bootstrap-watchdog: control #${id} ontbreekt.`);
    if(!/\sdisabled(?:\s|=|>)/.test(m[0]))bron=bron.replace(re,`$1 disabled aria-disabled="true"$2`);
  }

  const stateAnker='<div id="state" class="msg" role="status" aria-live="polite">Gegevens ophalen.</div>';
  const bodyFallback=`<div id="weather-bootstrap-status" class="msg err" role="alert" hidden>De weerapp kon niet starten. <a href="">Laad de pagina opnieuw</a>.</div>
<noscript><div id="weather-noscript" class="msg err" role="status">JavaScript is nodig om actuele weergegevens op te halen. Schakel JavaScript in en <a href="">laad de pagina opnieuw</a>.</div></noscript>

${stateAnker}`;
  bron=vervangEen(bron,stateAnker,bodyFallback,"bootstrap-fallback");

  const readyAnker=`})();

// bij draaien of vergroten opnieuw tekenen, want de grafiek heeft een eigen maat per schermbreedte`;
  const readyNieuw=`})();
if(typeof window.__weatherNowMarkAppReady==="function")window.__weatherNowMarkAppReady();

// bij draaien of vergroten opnieuw tekenen, want de grafiek heeft een eigen maat per schermbreedte`;
  bron=vervangEen(bron,readyAnker,readyNieuw,"bootstrap-ready-haak");
  return bron;
}

function voegPageshowFreshnessToe(html){
  let bron=String(html||"");
  if(bron.includes(PAGESHOW_MARKER))return bron;
  const anker=`setInterval(stempel,30000);
const WEATHERNOW_VERVERS_INTERVAL=`;
  const nieuw=`setInterval(stempel,30000);
/* ${PAGESHOW_MARKER} */
function weatherNowPageshowFreshness(){
  klokBijwerken();
  stempel();
}
window.addEventListener("pageshow",weatherNowPageshowFreshness);
const WEATHERNOW_VERVERS_INTERVAL=`;
  return vervangEen(bron,anker,nieuw,"pageshow-freshness");
}

function routeSeoFragmenten(routeHtml,slug){
  const één=(re,label)=>exactEen(routeHtml,re,`${slug}: ${label}`);
  return {
    title:één(/<title>[^<]*<\/title>/g,"title"),
    description:één(/<meta name="description" content="[^"]*">/g,"description"),
    canonical:één(/<link rel="canonical" href="[^"]+">/g,"canonical"),
    ogTitle:één(/<meta property="og:title" content="[^"]*">/g,"og:title"),
    ogDescription:één(/<meta property="og:description" content="[^"]*">/g,"og:description"),
    ogUrl:één(/<meta property="og:url" content="[^"]*">/g,"og:url"),
    ld:één(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g,"JSON-LD"),
    h1:één(/<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/g,"H1"),
    context:één(/<section class="seo-route-context"[\s\S]*?<\/section>/g,"routecontext")
  };
}
function kopieerMeta(bron,fragmenten){
  const vervang=(re,nieuw,label)=>{
    const matches=bron.match(re);
    if(!matches||matches.length!==1)throw new Error(`release-root: ${label} verwacht exact één match, gevonden ${matches?matches.length:0}.`);
    bron=bron.replace(matches[0],nieuw);
  };
  vervang(/<title>[^<]*<\/title>/g,fragmenten.title,"title");
  vervang(/<meta name="description" content="[^"]*">/g,fragmenten.description,"description");
  vervang(/<link rel="canonical" href="[^"]+">/g,fragmenten.canonical,"canonical");
  vervang(/<meta property="og:title" content="[^"]*">/g,fragmenten.ogTitle,"og:title");
  vervang(/<meta property="og:description" content="[^"]*">/g,fragmenten.ogDescription,"og:description");
  vervang(/<meta property="og:url" content="[^"]*">/g,fragmenten.ogUrl,"og:url");
  vervang(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g,fragmenten.ld,"JSON-LD");
  return bron;
}
function voegBaseToe(bron,slug){
  if(bron.includes('<base href="/">'))return bron;
  const re=/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/g;
  const matches=[...bron.matchAll(re)];
  if(matches.length!==1)throw new Error(`${slug}: CSP-meta ontbreekt of is dubbel.`);
  const csp=matches[0][1];
  if(!csp.includes("base-uri 'none'"))throw new Error(`${slug}: base-uri 'none' ontbreekt.`);
  return bron.replace(matches[0][0],`<meta http-equiv="Content-Security-Policy" content="${csp.replace("base-uri 'none'","base-uri 'self'")}">\n<base href="/">`);
}
function maakPlaatsPagina(gedeeldeRoot,oudeRoute,loc){
  const fragmenten=routeSeoFragmenten(oudeRoute,loc.slug);
  let html=kopieerMeta(gedeeldeRoot,fragmenten);
  html=voegBaseToe(html,loc.slug);

  const route={slug:loc.slug,name:loc.naam,lat:loc.lat,lon:loc.lon,country:loc.land};
  const bootstrap=`<!-- WEATHER NOW PLAATSROUTE -->\n<script>window.__WEATHERNOW_ROUTE_LOCATION__=Object.freeze(${JSON.stringify(route)});</script>`;
  if(tel(html,"</head>")!==1)throw new Error(`${loc.slug}: head-einde ontbreekt of is dubbel.`);
  html=html.replace("</head>",bootstrap+"\n</head>");

  const rootH1=exactEen(html,/<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/g,"release-root H1");
  html=html.replace(rootH1,fragmenten.h1);

  if(tel(html,NAV_MARKER)!==1)throw new Error(`${loc.slug}: plaatsnavigatiemarker ontbreekt of is dubbel.`);
  html=html.replace(NAV_MARKER,fragmenten.context+"\n"+NAV_MARKER);
  return html;
}

function main(){
  if(!fs.existsSync(ROOT_HTML))throw new Error("public/index.html ontbreekt voor release-herstel.");
  const oudeRoutes=new Map();
  for(const loc of LOCATIES){
    const pad=path.join(PUBLIC,"weer",loc.slug,"index.html");
    if(!fs.existsSync(pad))throw new Error(`${loc.slug}: bestaande plaatsroute ontbreekt; herstel mag SEO-routes niet omzeilen.`);
    oudeRoutes.set(loc.slug,fs.readFileSync(pad,"utf8"));
  }

  let root=fs.readFileSync(ROOT_HTML,"utf8");
  root=voegGedeeldRoutebeleidToe(root);
  root=voegBootstrapHerstelToe(root);
  root=voegPageshowFreshnessToe(root);
  fs.writeFileSync(ROOT_HTML,root,"utf8");

  for(const loc of LOCATIES){
    const pad=path.join(PUBLIC,"weer",loc.slug,"index.html");
    const html=maakPlaatsPagina(root,oudeRoutes.get(loc.slug),loc);
    fs.writeFileSync(pad,html,"utf8");
  }

  const versie=vernieuwServiceworkerCache(PUBLIC,"release-recovery-20260904");
  console.log(`Release-herstel pre-cleanup: final root gesynchroniseerd naar ${LOCATIES.length} plaatsroutes; routebeleid, no-JS/failed-JS watchdog en BFCache-freshness toegepast; cache ${versie}.`);
}

if(require.main===module)main();
module.exports={
  RELEASE_MARKER,WATCHDOG_MARKER,PAGESHOW_MARKER,
  voegGedeeldRoutebeleidToe,voegBootstrapHerstelToe,voegPageshowFreshnessToe,
  routeSeoFragmenten,maakPlaatsPagina
};
