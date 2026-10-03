"use strict";

const assert=require("assert");
const fs=require("fs");
const os=require("os");
const path=require("path");
const vm=require("vm");
const {
  CONNECT_SOURCE,GOOGLE_SCRIPT_SOURCE,GOOGLE_CONNECT_SOURCES,GOOGLE_IMG_SOURCES,
  SCRIPT_TAG,DELIVERY_META,verruimConnectSrc,verruimGoogleAnalyticsCsp,pasHtmlAan,pasArtifactAan
}=require("./apply-posthog-analytics.js");

const root=path.join(__dirname,"..");
const analytics=fs.readFileSync(path.join(root,"posthog-analytics.js"),"utf8");
new vm.Script(analytics,{filename:"posthog-analytics.js"});
assert(analytics.includes("grid-template-columns:minmax(0,1fr) auto"),"toestemmingsbanner mist compacte desktopcompositie");
assert(analytics.includes("width:min(760px,calc(100% - 24px))"),"toestemmingsbanner gebruikt niet de lage, brede desktopcompositie");
assert(analytics.includes("min-height:44px"),"mobiele toestemmingsacties missen een ruim touchdoel");
for(const tekst of [
  'aria-modal","false',
  'aria-labelledby","analytics-toestemming-titel',
  'aria-describedby","analytics-toestemming-uitleg',
  'href="/privacy"',
  'weather_view_ready',
  'weather_view_failed',
  'saved_location_added',
  'forecast_day_selected',
  'hourly_details_toggled',
  'night_details_toggled',
  'load_time_bucket',
  'failure_type'
])assert(analytics.includes(tekst),"analytics UX-contract mist: "+tekst);

assert.equal(CONNECT_SOURCE,"https://eu.i.posthog.com","PostHog capture moet uitsluitend de EU-ingestion origin gebruiken");
assert(analytics.includes('const ENDPOINT="https://eu.i.posthog.com/i/v0/e/"'),"capture endpoint moet de officiële EU single-event endpoint zijn");
assert(analytics.includes('"$geoip_disable":true'),"PostHog mag events niet automatisch met GeoIP-locatie verrijken");
assert(analytics.includes('"$process_person_profile":false'),"events moeten anoniem blijven zonder person profile");
assert(analytics.includes('credentials:"omit"'),"PostHog-request mag geen browsercredentials meesturen");
assert(analytics.includes('referrerPolicy:"no-referrer"'),"PostHog-request mag geen Referer lekken");
assert(analytics.includes('return "/weer/:location"'),"weerroutes moeten plaatsnamen vóór PostHog-capture generaliseren");
/* Herkomst en startmodus: de verwijzer wordt uitsluitend in de categoriefunctie
   gelezen en alleen als vaste categorie verstuurd. */
assert.equal((analytics.match(/document\.referrer/g)||[]).length,1,"document.referrer mag maar op één plek worden gelezen");
assert(analytics.includes("const entrySource=herkomstCategorie(document.referrer);"),"verwijzer moet direct naar een categorie worden omgezet");
assert(analytics.includes('const HERKOMST_CATEGORIEEN=Object.freeze(["search","ai_assistant","internal","other","none"]);'),"vaste set herkomstcategorieën ontbreekt");
assert(analytics.includes('"entry_source":entrySource,')&&analytics.includes('"launch_mode":launchMode,'),"herkomst en startmodus horen als vaste eigenschappen mee te gaan");
assert(!/referrer\s*:/.test(analytics.slice(0,analytics.indexOf("/* Google Analytics draait in basic consent mode")))&&!analytics.includes('"$referrer"')&&!analytics.includes('"$referring_domain"'),"PostHog mag nooit de ruwe verwijzer of het verwijzende domein ontvangen");
assert(analytics.includes("},{capture:true,passive:true});"),"taakuitkomsten horen in de capture-fase te worden gemeten: de dagenlijst wordt bij een klik opnieuw getekend");
assert(analytics.includes('["#chipdeel","location_share_requested"]'),"op Delen tikken hoort als generieke taakuitkomst te tellen, zonder plaats of URL");
assert(analytics.includes('[".chipplaats","saved_location_opened"]'),"openen van een bewaarde plaats hoort als generieke taakuitkomst te tellen");
assert(analytics.includes('saved_locations:bewaard')&&analytics.includes('?"some":"none"'),"bewaarde plaatsen gaan alleen als ja/nee mee");
assert(analytics.includes('window.addEventListener("appinstalled",()=>stuur("app_installed"),{once:true})'),"app-installatie hoort als generieke gebeurtenis te tellen");
assert(analytics.includes('navigator.globalPrivacyControl===true'),"Global Privacy Control moet analytics uitschakelen");
assert(analytics.includes('if(navigator.webdriver===true||GEAUTOMATISEERD.test(String(navigator.userAgent||"")))return;'),"geautomatiseerde browsers (eigen productiecontroles) mogen niet als bezoek tellen");
assert(analytics.indexOf("GEAUTOMATISEERD.test")<analytics.indexOf("function stuur("),"automatiseringsuitsluiting moet vóór iedere capture gelden");
assert(analytics.includes('navigator.doNotTrack==="1"'),"Do Not Track moet analytics uitschakelen");

const ga4Marker="/* Google Analytics draait in basic consent mode";
const markerPos=analytics.indexOf(ga4Marker);
assert(markerPos>0,"GA4-laag moet expliciet van de cookie-vrije PostHog-laag zijn gescheiden");
/* Toegestane opslag in de PostHog-laag: de afmelding per apparaat (één vaste
   sleutel, alleen op uitdrukkelijk verzoek) en de anonieme bezoekers-ID (één
   vaste sleutel, 90 dagen geldig, pas na alle uitsluitingen). Buiten die twee
   blokken blijven localStorage, cookies, querystring en hash verboden. */
const afmeldStart=analytics.indexOf("/* AFMELDING PER APPARAAT.");
const afmeldEinde=analytics.indexOf("/* EINDE AFMELDING PER APPARAAT */");
assert(afmeldStart>0&&afmeldEinde>afmeldStart,"afmeldblok per apparaat ontbreekt");
assert(afmeldEinde<analytics.indexOf("function stuur("),"afmelding moet vóór iedere capture gelden");
assert(afmeldEinde<analytics.indexOf("GEAUTOMATISEERD.test"),"afmelding hoort direct na de hostcontrole");
const afmeldDeel=analytics.slice(afmeldStart,afmeldEinde);
assert(afmeldDeel.includes('const AFMELD_KEY="weerbriefing.analytics.uit.v1";'),"afmelding gebruikt één vaste sleutel");
assert.deepEqual([...new Set(afmeldDeel.match(/localStorage\.\w+\([^)]*\)/g))].sort(),['localStorage.getItem(AFMELD_KEY)','localStorage.removeItem(AFMELD_KEY)','localStorage.removeItem(BEZOEKER_KEY)','localStorage.setItem(AFMELD_KEY,"1")'],"afmelding leest en schrijft alleen de eigen sleutel en wist de bezoekers-ID");
assert(afmeldDeel.includes('const BEZOEKER_KEY="weerbriefing.analytics.id.v1";'),"bezoekers-ID gebruikt één vaste sleutel");
const idStart=analytics.indexOf("/* BEZOEKERS-ID OP DIT APPARAAT.");
const idEinde=analytics.indexOf("/* EINDE BEZOEKERS-ID */");
assert(idStart>0&&idEinde>idStart,"bezoekers-ID-blok ontbreekt");
for(const uitsluiting of ["if(afgemeld())return;","navigator.globalPrivacyControl===true","GEAUTOMATISEERD.test"])
  assert(analytics.indexOf(uitsluiting)<idStart,"bezoekers-ID mag pas na de uitsluiting bestaan: "+uitsluiting);
const idDeel=analytics.slice(idStart,idEinde);
assert.deepEqual([...new Set(idDeel.match(/localStorage\.\w+\([^)]*\)/g))].sort(),['localStorage.getItem(BEZOEKER_KEY)','localStorage.setItem(BEZOEKER_KEY,JSON.stringify({id,sinds:nu})'],"bezoekers-ID leest en schrijft uitsluitend de eigen sleutel");
assert(idDeel.includes("const BEZOEKER_GELDIG_MS=90*24*60*60*1000;"),"bezoekers-ID vervalt na 90 dagen");
assert(idDeel.includes("catch(e){return tijdelijkId();}"),"zonder opslag valt de meting terug op een tijdelijke identifier");
assert(analytics.includes('"$process_person_profile":false'),"er komt nooit een PostHog-personenprofiel");
assert(afmeldDeel.includes("if(afgemeld())return;"),"na afmelding mag niets meer starten");
const posthogDeel=analytics.slice(0,afmeldStart)+analytics.slice(afmeldEinde,idStart)+analytics.slice(idEinde,markerPos);
for(const [label,patroon] of [
  ["localStorage-gebruik",/\blocalStorage\s*(?:\.|\[)/],
  ["sessionStorage-gebruik",/\bsessionStorage\s*(?:\.|\[)/],
  ["cookie-gebruik",/\bdocument\s*\.\s*cookie\b/],
  ["PostHog SDK-init",/\bposthog\s*\.\s*init\s*\(/i],
  ["PostHog SDK-assets",/eu-assets\.i\.posthog\.com/i],
  ["querystring-uitlezing",/\blocation\s*\.\s*search\b/],
  ["hash-uitlezing",/\blocation\s*\.\s*hash\b/]
])assert(!patroon.test(posthogDeel),"PostHog privacycontract verbiedt "+label);

for(const tekst of [
  'const GA4_MEASUREMENT_ID="G-H498VPZ9Z1"',
  'const GA4_CONSENT_KEY="weerbriefing.ga4.consent.v1"',
  'gtag("consent","default"',
  'analytics_storage:"denied"',
  'gtag("consent","update"',
  'analytics_storage:"granted"',
  'ad_storage:"denied"',
  'ad_user_data:"denied"',
  'ad_personalization:"denied"',
  'allow_google_signals:false',
  'allow_ad_personalization_signals:false',
  'https://www.googletagmanager.com/gtag/js?id=',
  'page_location:location.origin+pad',
  'page_path:pad',
  'data-ga4-consent-toggle',
  'Weigeren',
  'Toestaan'
])assert(analytics.includes(tekst),"GA4 consentcontract mist: "+tekst);
assert(!/location\s*\.\s*(?:search|hash)/.test(analytics.slice(markerPos)),"GA4 mag querystring of hash niet als pagina-identiteit uitlezen");
assert(analytics.indexOf("appendChild(script)")>analytics.indexOf('analytics_storage:"granted"'),"Google-tag mag pas na expliciet verleende analytics-toestemming worden toegevoegd");

const policy="default-src 'self'; script-src 'self'; connect-src 'self' https://api.open-meteo.com; base-uri 'none'";
const posthogCsp=verruimConnectSrc(policy);
assert(posthogCsp.includes("connect-src 'self' https://api.open-meteo.com https://eu.i.posthog.com"),"PostHog EU-origin moet aan connect-src worden toegevoegd");
assert.equal(verruimConnectSrc(posthogCsp),posthogCsp,"PostHog CSP-bewerking moet idempotent zijn");
const csp=verruimGoogleAnalyticsCsp(posthogCsp);
assert(csp.includes(GOOGLE_SCRIPT_SOURCE),"GA4-scriptorigin moet in CSP staan");
for(const bron of GOOGLE_CONNECT_SOURCES)assert(csp.includes(bron),"GA4 connect-src mist "+bron);
for(const bron of GOOGLE_IMG_SOURCES)assert(csp.includes(bron),"GA4 img-src mist "+bron);
assert.equal(verruimGoogleAnalyticsCsp(csp),csp,"GA4 CSP-bewerking moet idempotent zijn");
const defaultOnly="default-src 'self'; script-src 'self'";
assert(verruimConnectSrc(defaultOnly).includes("connect-src 'self' https://eu.i.posthog.com"),"default-src moet veilig naar expliciete connect-src worden vertaald");

const html=`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"></head><body><p>x</p></body></html>`;
const eersteHtml=pasHtmlAan(html);
assert(eersteHtml.html.includes(SCRIPT_TAG),"analytics-script moet vóór body-einde worden geïnjecteerd");
assert(eersteHtml.html.includes(CONNECT_SOURCE),"meta-CSP moet EU-ingestion toestaan zolang delivery nog niet naar headers is gemigreerd");
assert(eersteHtml.html.includes(GOOGLE_SCRIPT_SOURCE),"meta-CSP moet consent-gated GA4 toestaan");
const tweedeHtml=pasHtmlAan(eersteHtml.html);
assert.equal(tweedeHtml.html,eersteHtml.html,"HTML-injectie moet idempotent zijn");

const deliveryHtml=`<!doctype html><html><head>${DELIVERY_META}</head><body><p>x</p></body></html>`;
const deliveryResultaat=pasHtmlAan(deliveryHtml);
assert.equal(deliveryResultaat.metas,0,"definitieve delivery-HTML hoort geen meta-CSP meer te hebben");
assert(deliveryResultaat.html.includes(SCRIPT_TAG),"analytics-script moet ook na CSP-headermigratie worden geïnjecteerd");
assert(!deliveryResultaat.html.includes(CONNECT_SOURCE),"delivery-injectie mag geen CSP-meta terugintroduceren");
assert.equal(pasHtmlAan(deliveryResultaat.html).html,deliveryResultaat.html,"delivery-injectie moet idempotent zijn");

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"watishetweer-analytics-"));
try{
  fs.writeFileSync(path.join(tmp,"posthog-analytics.js"),analytics);
  fs.writeFileSync(path.join(tmp,"index.html"),html);
  fs.mkdirSync(path.join(tmp,"weer","almere"),{recursive:true});
  fs.writeFileSync(path.join(tmp,"weer","almere","index.html"),html);
  const eerste=pasArtifactAan(tmp);
  assert.equal(eerste.bestanden,2);
  assert.equal(eerste.scripts,2);
  assert.equal(eerste.deliveryActief,false);
  const tweede=pasArtifactAan(tmp);
  assert.equal(tweede.gewijzigd,0,"tweede analytics artifactpass moet noop zijn");

  fs.writeFileSync(path.join(tmp,"index.html"),deliveryHtml);
  fs.writeFileSync(path.join(tmp,"weer","almere","index.html"),deliveryHtml);
  const delivery=pasArtifactAan(tmp);
  assert.equal(delivery.deliveryActief,true,"deliverymarker moet de header-CSP-route activeren");
  assert.equal(delivery.metas,0,"deliverypass mag geen verwijderde meta-CSP vereisen of terugzetten");
  assert.equal(delivery.scripts,2,"deliverypass moet beide HTML-bestanden van de lokale analyticsfile voorzien");
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

const headers=fs.readFileSync(path.join(root,"cloudflare","_headers"),"utf8");
const middleware=fs.readFileSync(path.join(root,"functions","_middleware.js"),"utf8");
assert(headers.includes("https://eu.i.posthog.com"),"Cloudflare CSP moet PostHog EU capture expliciet toestaan");
assert(middleware.includes("https://eu.i.posthog.com"),"middleware-CSP moet PostHog EU capture expliciet toestaan");
for(const bron of [GOOGLE_SCRIPT_SOURCE,...GOOGLE_CONNECT_SOURCES,...GOOGLE_IMG_SOURCES]){
  assert(headers.includes(bron),"Cloudflare CSP mist GA4-origin "+bron);
  assert(middleware.includes(bron),"middleware-CSP mist GA4-origin "+bron);
}
assert(!headers.includes("eu-assets.i.posthog.com"),"CSP mag geen externe PostHog SDK-assets toestaan");

const cloudflareCspScript=fs.readFileSync(path.join(root,"scripts","apply-cloudflare-web-analytics-csp.js"),"utf8");
const deliveryCleanup=fs.readFileSync(path.join(root,"scripts","platform-output-cleanup.js"),"utf8");
assert(!cloudflareCspScript.includes("apply-posthog-analytics.js"),"Analytics mag niet meer vóór de finale deliveryguard vanuit de Cloudflare-CSP-stap worden geïnjecteerd");
assert(deliveryCleanup.includes('require("./apply-posthog-analytics.js").pasArtifactAan(PUBLIC)'),"finale delivery-cleanup moet eigenaar zijn van de analytics-injectie");
assert(deliveryCleanup.includes('vernieuwServiceworkerCache(PUBLIC,"delivery-posthog-analytics")'),"cachehash moet na de finale analytics-HTML-mutatie opnieuw worden vernieuwd");
const optimaliseerPos=deliveryCleanup.indexOf("optimaliseerPublic().then");
const posthogPos=deliveryCleanup.indexOf("voegPostHogNaDeliveryToe();",optimaliseerPos);
assert(optimaliseerPos>=0&&posthogPos>optimaliseerPos,"analytics moet aantoonbaar pas na succesvolle delivery-optimalisatie worden toegepast");

/* Gedrag van de afmelding, uitgevoerd in een nagebootste productiebrowser. */
function draai(href,opslag,opties={}){
  const verzonden=[],vervangen=[],payloads=[];
  const url=new URL(href);
  const knop={textContent:"",hidden:false,onclick:null},status={textContent:""},ga4Knop={textContent:"",hidden:false},ga4Status={textContent:""};
  const selectors={"[data-analytics-device-toggle]":knop,"[data-analytics-device-status]":status,"[data-ga4-consent-toggle]":ga4Knop,"[data-ga4-consent-status]":ga4Status};
  const fout=()=>{throw new Error("opslag geblokkeerd");};
  const localStorage=opties.opslagFout?{getItem:fout,setItem:fout,removeItem:fout}:{getItem:k=>opslag.has(k)?opslag.get(k):null,setItem:(k,v)=>opslag.set(k,String(v)),removeItem:k=>opslag.delete(k)};
  const document={readyState:"complete",referrer:"",title:"t",cookie:"",documentElement:{lang:opties.lang||"nl"},head:{appendChild(){}},body:{appendChild(){}},
    getElementById:()=>null,querySelector:s=>selectors[s]||null,createElement:()=>({setAttribute(){},addEventListener(){},dataset:{},style:{}}),addEventListener(){}};
  const window={innerWidth:1200,matchMedia:()=>({matches:false}),addEventListener(){}};
  const context={window,document,localStorage,URL,JSON,Object,Set,Math,Number,String,Array,Date,Uint32Array,
    navigator:{userAgent:"Mozilla/5.0 (Macintosh) Safari/605.1.15",webdriver:false},
    location:{protocol:url.protocol,hostname:url.hostname,href:url.href,origin:url.origin,pathname:url.pathname,reload(){}},
    history:{state:null,replaceState:(st,t,u)=>vervangen.push(u)},
    fetch:(u,o)=>{const b=JSON.parse(o.body);verzonden.push(b.event);payloads.push(b);return {catch(){}};},
    setTimeout:()=>0,globalThis:{}};
  window.history=context.history;
  vm.runInNewContext(analytics,context);
  return {verzonden,vervangen,payloads,knop,status,ga4Knop,ga4Status};
}
const opslag=new Map();
let r=draai("https://www.watishetweer.nl/weer/almere/?analytics=uit&x=1#top",opslag);
assert.equal(opslag.get("weerbriefing.analytics.uit.v1"),"1","?analytics=uit hoort de afmelding te bewaren");
assert.deepEqual(r.verzonden,[],"na ?analytics=uit gaat er niets naar PostHog, ook geen paginaweergave");
assert.deepEqual(r.vervangen,["/weer/almere/?x=1#top"],"de analytics-parameter verdwijnt uit de adresbalk; de rest blijft");
assert.equal(r.knop.textContent,"PostHog en Google Analytics weer toestaan","privacyknop toont de afgemelde toestand");
assert.equal(r.status.textContent.trim(),"PostHog en Google Analytics staan uit. Cloudflare blijft bezoeken en laadprestaties meten, zonder cookies.","afmeldstatus noemt precies wat uit staat en dat Cloudflare cookieloos blijft meten");
assert(!/alle statistieken/i.test(r.status.textContent),"afmeldstatus mag niet 'alle statistieken' beloven");
assert(r.ga4Knop.hidden&&r.ga4Status.textContent.includes("Google Analytics staat op dit apparaat uit"),"GA4-knop verdwijnt zolang alles uit staat");
r=draai("https://www.watishetweer.nl/",opslag);
assert.deepEqual(r.verzonden,[],"afmelding blijft bij een volgend bezoek gelden");
assert.deepEqual(r.vervangen,[],"zonder parameter wordt de adresbalk niet aangepast");
r=draai("https://www.watishetweer.nl/?analytics=aan",opslag);
assert(!opslag.has("weerbriefing.analytics.uit.v1"),"?analytics=aan heft de afmelding op");
assert.deepEqual(r.verzonden,["$pageview"],"na opheffen telt de paginaweergave weer");
assert(r.knop.textContent.includes("uitzetten")&&r.status.textContent.includes("staan de statistieken aan"),"privacyknop toont de actieve toestand");
r=draai("https://www.watishetweer.nl/?analytics=iets",opslag);
assert.deepEqual(r.vervangen,[],"onbekende waarden laten adres en keuze ongemoeid");
assert.deepEqual(r.verzonden,["$pageview"]);

/* Anonieme bezoekers-ID en taal (eigenaar, 2 oktober). */
const ID_KEY="weerbriefing.analytics.id.v1";
const idOpslag=new Map();
r=draai("https://watishetweer.nl/weer/almere/",idOpslag);
const eerste=r.payloads[0];
assert(/^anon_/.test(eerste.distinct_id),"de bezoekers-ID is anoniem");
assert.equal(JSON.parse(idOpslag.get(ID_KEY)).id,eerste.distinct_id,"de bezoekers-ID wordt op het apparaat bewaard");
assert.equal(eerste.properties.taal,"nl","Nederlandse weergave telt als nl");
assert.equal(eerste.properties.$process_person_profile,false,"geen personenprofiel");
assert(!JSON.stringify(eerste).includes("almere"),"de plaats gaat nooit mee");
r=draai("https://watishetweer.nl/",idOpslag,{lang:"en-GB"});
assert.equal(r.payloads[0].distinct_id,eerste.distinct_id,"een volgend bezoek gebruikt dezelfde ID, zodat terugkeer telbaar is");
assert.equal(r.payloads[0].properties.taal,"en","Engelse weergave telt als en");
idOpslag.set(ID_KEY,JSON.stringify({id:eerste.distinct_id,sinds:Date.now()-91*24*60*60*1000}));
r=draai("https://watishetweer.nl/",idOpslag);
assert.notEqual(r.payloads[0].distinct_id,eerste.distinct_id,"na 90 dagen komt er een nieuwe ID");
idOpslag.set(ID_KEY,JSON.stringify({id:"iets anders",sinds:Date.now()}));
r=draai("https://watishetweer.nl/",idOpslag);
assert(/^anon_/.test(r.payloads[0].distinct_id)&&r.payloads[0].distinct_id!=="iets anders","een ongeldige bewaarde waarde wordt vervangen");
r=draai("https://watishetweer.nl/?analytics=uit",idOpslag);
assert(!idOpslag.has(ID_KEY),"afmelden wist de bezoekers-ID");
assert.deepEqual(r.verzonden,[],"na afmelden gaat er niets naar PostHog");
idOpslag.clear();
r=draai("https://watishetweer.nl/",idOpslag,{opslagFout:true});
assert(/^anon_/.test(r.payloads[0].distinct_id)&&idOpslag.size===0,"zonder bruikbare opslag een tijdelijke ID, zonder fout");

const privacy=fs.readFileSync(path.join(root,"privacy.html"),"utf8");
assert(privacy.includes("data-analytics-device-toggle")&&privacy.includes("data-analytics-device-status"),"privacypagina mist de knop om statistieken per apparaat uit te zetten");
assert(privacy.includes("?analytics=uit")&&privacy.includes("weerbriefing.analytics.uit.v1"),"privacyverklaring moet de afmelding en de bewaarde sleutel noemen");
assert(privacy.includes("<b>PostHog en Google Analytics uitzetten.</b>")&&privacy.includes("Cloudflare blijft bezoeken en laadprestaties meten, zonder cookies."),"privacyverklaring moet zeggen dat de afmelding PostHog en Google Analytics betreft en Cloudflare cookieloos blijft meten");
assert(!/alle statistieken uit/i.test(privacy),"privacyverklaring mag niet beloven dat de knop alle statistieken uitzet");
for(const tekst of ["PostHog Cloud EU","geen PostHog-SDK","querystring","URL-hash","IP-anonimisering","grove laadduurgroep","generieke taakuitkomsten","concrete weerwaarden","Google Analytics 4 (GA4) is optioneel","pas geladen nadat je daar expliciet toestemming voor geeft","Advertentieopslag","data-ga4-consent-toggle","Je kunt toestemming hier altijd weer intrekken"]){
  assert(privacy.includes(tekst),"privacyverklaring mist analytics-uitleg: "+tekst);
}

console.log("analytics-contract: PostHog privacylaag, GA4 basic consent, CSP, post-delivery injectie, cachevernieuwing en privacytekst OK");
