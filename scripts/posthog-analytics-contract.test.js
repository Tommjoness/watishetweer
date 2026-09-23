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
const posthogDeel=analytics.slice(0,markerPos);
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

const privacy=fs.readFileSync(path.join(root,"privacy.html"),"utf8");
for(const tekst of ["PostHog Cloud EU","geen PostHog-SDK","querystring","URL-hash","IP-anonimisering","grove laadduurgroep","generieke taakuitkomsten","concrete weerwaarden","Google Analytics 4 (GA4) is optioneel","pas geladen nadat je daar expliciet toestemming voor geeft","Advertentieopslag","data-ga4-consent-toggle","Je kunt toestemming hier altijd weer intrekken"]){
  assert(privacy.includes(tekst),"privacyverklaring mist analytics-uitleg: "+tekst);
}

console.log("analytics-contract: PostHog privacylaag, GA4 basic consent, CSP, post-delivery injectie, cachevernieuwing en privacytekst OK");
