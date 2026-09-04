"use strict";

const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const {LOCATIES,plaatsUrl}=require("./seo-locations.config.js");
const {MANIFEST_NAAM,htmlBestanden,mainScript}=require("./release-client-unify-20260904.js");
const {RELEASE_MARKER,PAGESHOW_MARKER}=require("./release-recovery-precleanup-20260904.js");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const PUBLIC=path.join(ROOT,"public");
const SOURCE=path.join(ROOT,".weather-runtime-source.tmp");
const BUILD_RE=/<meta name="weather-build-sha" content="([^"]+)">/;
const MANIFEST_META='<meta name="weather-client-manifest" content="/'+MANIFEST_NAAM+'">';

function hash(v){return crypto.createHash("sha256").update(v).digest("hex");}
function één(bron,re,label){
  const m=[...String(bron).matchAll(re)];
  if(m.length!==1)throw new Error(`${label}: verwacht exact één match, gevonden ${m.length}.`);
  return m[0];
}
function assert(cond,msg){if(!cond)throw new Error(msg);}
function controlUit(html,id){
  const m=één(html,new RegExp(`<(?:input|button)\\b[^>]*\\bid="${id}"[^>]*>`,`g`),`control #${id}`)[0];
  assert(/\sdisabled(?:\s|=|>)/.test(m),`#${id} is niet standaard disabled vóór succesvolle bootstrap.`);
  assert(/aria-disabled="true"/.test(m),`#${id} mist aria-disabled vóór succesvolle bootstrap.`);
}
function parseRouteData(html,slug){
  const m=één(html,/<script type="application\/json" id="weather-now-route">([\s\S]*?)<\/script>/g,`${slug}: route-data`);
  try{return JSON.parse(m[1]);}catch(e){throw new Error(`${slug}: ongeldige route-data: ${e.message}`);}
}

function main(){
  const rootPad=path.join(PUBLIC,"index.html");
  assert(fs.existsSync(rootPad),"public/index.html ontbreekt.");
  assert(fs.existsSync(SOURCE),"Delivery-runtimebron ontbreekt voor release-verificatie.");
  const rootHtml=fs.readFileSync(rootPad,"utf8");
  const bron=fs.readFileSync(SOURCE,"utf8");
  const build=(BUILD_RE.exec(rootHtml)||[])[1];
  assert(build&&/^[0-9a-f]{40}$/i.test(build),"Homepage mist geldige build-SHA.");
  const rootBundle=mainScript(rootHtml,"homepage");

  const weatherPages=[["/",rootHtml]];
  for(const loc of LOCATIES){
    const pad=path.join(PUBLIC,"weer",loc.slug,"index.html");
    assert(fs.existsSync(pad),`${loc.slug}: plaatsroute ontbreekt.`);
    weatherPages.push([`/weer/${loc.slug}/`,fs.readFileSync(pad,"utf8")]);
  }
  for(const [route,html] of weatherPages){
    assert(mainScript(html,route)===rootBundle,`${route}: hoofdclient wijkt af van homepage (${mainScript(html,route)} versus ${rootBundle}).`);
    const b=(BUILD_RE.exec(html)||[])[1];
    assert(b===build,`${route}: buildmarker ${b||"ontbreekt"} wijkt af van ${build}.`);
    assert(html.includes(MANIFEST_META),`${route}: gedeeld clientmanifest ontbreekt.`);
    assert(html.includes("JavaScript is nodig om actuele weergegevens op te halen."),`${route}: no-JS-melding ontbreekt.`);
    assert(html.includes('id="weather-bootstrap-status"'),`${route}: failed-JS-herstelstate ontbreekt.`);
    for(const id of ["q","here","ververs","thema"])controlUit(html,id);
  }

  for(const loc of LOCATIES){
    const route=`/weer/${loc.slug}/`,html=weatherPages.find(x=>x[0]===route)[1];
    assert(html.includes(`href="${plaatsUrl(loc)}"`),`${route}: canonical plaatsroute ontbreekt.`);
    const data=parseRouteData(html,loc.slug);
    assert(data.slug===loc.slug&&data.name===loc.naam&&Number(data.lat)===Number(loc.lat)&&Number(data.lon)===Number(loc.lon),`${route}: route-data wijkt af van locatieconfig.`);
    assert(/<script src="\/route-bootstrap-[0-9a-f]{12}\.min\.js"><\/script>/.test(html),`${route}: onafhankelijke route-bootstrap ontbreekt.`);
  }
  assert(!/route-bootstrap-[0-9a-f]{12}\.min\.js/.test(rootHtml),"Homepage mag geen route-bootstrap laden.");

  const manifestPad=path.join(PUBLIC,MANIFEST_NAAM);
  assert(fs.existsSync(manifestPad),"release-client-manifest ontbreekt.");
  const manifest=JSON.parse(fs.readFileSync(manifestPad,"utf8"));
  assert(manifest.buildSha===build,"Clientmanifest-buildSha wijkt af van HTML-buildmarker.");
  assert(manifest.mainScript==="/"+rootBundle,"Clientmanifest-mainScript wijkt af van homepage.");
  const rootBundlePad=path.join(PUBLIC,rootBundle);
  assert(fs.existsSync(rootBundlePad),"Actieve hoofdclient ontbreekt op schijf.");
  assert(manifest.mainScriptSha256===hash(fs.readFileSync(rootBundlePad)),"Clientmanifest-hash hoort niet bij actieve hoofdclient.");
  assert(manifest.weatherHtmlRoutes===LOCATIES.length+1,"Clientmanifest-routeaantal wijkt af.");

  const refs=new Set();
  for(const bestand of htmlBestanden(PUBLIC)){
    const html=fs.readFileSync(bestand,"utf8");
    assert(html.includes(MANIFEST_META),`${path.relative(PUBLIC,bestand)}: release-client-manifest-meta ontbreekt.`);
    for(const m of html.matchAll(/src="\/(app-[0-9a-f]{12}\.min\.js)"/g)){
      refs.add(m[1]);
      assert(fs.existsSync(path.join(PUBLIC,m[1])),`${path.relative(PUBLIC,bestand)} verwijst naar ontbrekende ${m[1]}.`);
    }
  }
  for(const naam of fs.readdirSync(PUBLIC)){
    if(/^app-[0-9a-f]{12}\.min\.js$/.test(naam))assert(refs.has(naam),`Verouderde/onbereikbare hoofdclient bleef in public staan: ${naam}.`);
  }

  const sw=fs.readFileSync(path.join(PUBLIC,"sw.js"),"utf8");
  const swApps=[...new Set([...sw.matchAll(/app-[0-9a-f]{12}\.min\.js/g)].map(m=>m[0]))];
  assert(swApps.length===1&&swApps[0]===rootBundle,`Serviceworker verwijst niet eenduidig naar ${rootBundle}: ${swApps.join(", ")||"geen app-ref"}.`);
  assert(sw.includes(`"./${MANIFEST_NAAM}"`),"Serviceworker precachet het release-client-manifest niet.");
  verifieerServiceworkerCache(PUBLIC,"release-recovery-final");

  assert(bron.includes(RELEASE_MARKER),"Gedeeld routebeleid ontbreekt uit de werkelijk gebundelde runtime.");
  assert(bron.includes('window.__weatherNowMarkAppReady==="function"'),"Hoofdapp markeert succesvolle initialisatie niet.");
  const earlyBestanden=fs.readdirSync(PUBLIC).filter(n=>/^early-[0-9a-f]{12}\.min\.js$/.test(n));
  const watchdogs=earlyBestanden.filter(n=>fs.readFileSync(path.join(PUBLIC,n),"utf8").includes("__weatherNowMarkAppReady"));
  assert(watchdogs.length===1,`Bootstrap-watchdog moet exact één onafhankelijke early bundle hebben; gevonden ${watchdogs.length}.`);

  assert(bron.includes(PAGESHOW_MARKER),"BFCache-freshnessmarker ontbreekt uit gebundelde runtimebron.");
  assert((bron.match(/window\.addEventListener\("pageshow",weatherNowPageshowFreshness\);/g)||[]).length===1,"pageshow-listener ontbreekt of is dubbel.");
  const pageshow=één(bron,/function weatherNowPageshowFreshness\(\)\{[\s\S]*?\n\}/g,"pageshow-handler")[0];
  assert(pageshow.includes("klokBijwerken();")&&pageshow.includes("stempel();"),"pageshow roept bestaande klok- en freshnessrenderer niet beide aan.");
  assert(!/\bload\s*\(/.test(pageshow)&&!/\bsetInterval\s*\(/.test(pageshow)&&!/\bsetTimeout\s*\(/.test(pageshow),"pageshow-handler start onbedoeld een request of timer.");

  for(const [anker,label] of [
    ["new AbortController()","AbortController"],
    ["mijnBeurt!==laadTeller","requestgeneratie"],
    ["Number.isFinite(Number(S.op))","freshness-validatie"],
    ["timeZone:S.d.timezone","geselecteerde-locatie-timezone"],
    ["&forecast_days=7&timezone=auto&wind_speed_unit=kmh","Open-Meteo timezone=auto"],
    ["forecast:15*60*1000","forecast-freshnessdrempel"]
  ])assert(bron.includes(anker),`Bestaande beveiliging verdwenen uit delivery-runtime: ${label}.`);

  console.log(`Release recovery verifier groen: build ${build}, ${weatherPages.length} weerroutes -> /${rootBundle}; no-JS/failed-JS watchdog onafhankelijk; pageshow-freshness direct zonder request/timer; SW/cache/manifest consistent.`);
}

if(require.main===module)main();
