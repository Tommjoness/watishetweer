"use strict";

const assert=require("assert");
const fs=require("fs");
const os=require("os");
const path=require("path");
const vm=require("vm");
const {CONNECT_SOURCE,SCRIPT_TAG,DELIVERY_META,verruimConnectSrc,pasHtmlAan,pasArtifactAan}=require("./apply-posthog-analytics.js");

const root=path.join(__dirname,"..");
const analytics=fs.readFileSync(path.join(root,"posthog-analytics.js"),"utf8");
new vm.Script(analytics,{filename:"posthog-analytics.js"});

assert.equal(CONNECT_SOURCE,"https://eu.i.posthog.com","PostHog capture moet uitsluitend de EU-ingestion origin gebruiken");
assert(analytics.includes('const ENDPOINT="https://eu.i.posthog.com/i/v0/e/"'),"capture endpoint moet de officiële EU single-event endpoint zijn");
assert(analytics.includes('"$geoip_disable":true'),"PostHog mag events niet automatisch met GeoIP-locatie verrijken");
assert(analytics.includes('"$process_person_profile":false'),"events moeten anoniem blijven zonder person profile");
assert(analytics.includes('credentials:"omit"'),"PostHog-request mag geen browsercredentials meesturen");
assert(analytics.includes('referrerPolicy:"no-referrer"'),"PostHog-request mag geen Referer lekken");
assert(analytics.includes('return "/weer/:location"'),"weerroutes moeten plaatsnamen vóór capture generaliseren");
assert(analytics.includes('navigator.globalPrivacyControl===true'),"Global Privacy Control moet PostHog uitschakelen");
assert(analytics.includes('navigator.doNotTrack==="1"'),"Do Not Track moet PostHog uitschakelen");
for(const [label,patroon] of [
  ["localStorage-gebruik",/\blocalStorage\s*(?:\.|\[)/],
  ["sessionStorage-gebruik",/\bsessionStorage\s*(?:\.|\[)/],
  ["cookie-gebruik",/\bdocument\s*\.\s*cookie\b/],
  ["PostHog SDK-init",/\bposthog\s*\.\s*init\s*\(/i],
  ["PostHog SDK-assets",/eu-assets\.i\.posthog\.com/i],
  ["querystring-uitlezing",/\blocation\s*\.\s*search\b/],
  ["hash-uitlezing",/\blocation\s*\.\s*hash\b/]
])assert(!patroon.test(analytics),"privacycontract verbiedt "+label);

const policy="default-src 'self'; script-src 'self'; connect-src 'self' https://api.open-meteo.com; base-uri 'none'";
const csp=verruimConnectSrc(policy);
assert(csp.includes("connect-src 'self' https://api.open-meteo.com https://eu.i.posthog.com"),"PostHog EU-origin moet uitsluitend aan connect-src worden toegevoegd");
assert.equal(verruimConnectSrc(csp),csp,"PostHog CSP-bewerking moet idempotent zijn");
const defaultOnly="default-src 'self'; script-src 'self'";
assert(verruimConnectSrc(defaultOnly).includes("connect-src 'self' https://eu.i.posthog.com"),"default-src moet veilig naar expliciete connect-src worden vertaald");

const html=`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"></head><body><p>x</p></body></html>`;
const eersteHtml=pasHtmlAan(html);
assert(eersteHtml.html.includes(SCRIPT_TAG),"analytics-script moet vóór body-einde worden geïnjecteerd");
assert(eersteHtml.html.includes(CONNECT_SOURCE),"meta-CSP moet EU-ingestion toestaan zolang delivery nog niet naar headers is gemigreerd");
const tweedeHtml=pasHtmlAan(eersteHtml.html);
assert.equal(tweedeHtml.html,eersteHtml.html,"HTML-injectie moet idempotent zijn");

const deliveryHtml=`<!doctype html><html><head>${DELIVERY_META}</head><body><p>x</p></body></html>`;
const deliveryResultaat=pasHtmlAan(deliveryHtml);
assert.equal(deliveryResultaat.metas,0,"definitieve delivery-HTML hoort geen meta-CSP meer te hebben");
assert(deliveryResultaat.html.includes(SCRIPT_TAG),"analytics-script moet ook na CSP-headermigratie worden geïnjecteerd");
assert(!deliveryResultaat.html.includes(CONNECT_SOURCE),"delivery-injectie mag geen CSP-meta terugintroduceren");
assert.equal(pasHtmlAan(deliveryResultaat.html).html,deliveryResultaat.html,"delivery-injectie moet idempotent zijn");

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"watishetweer-posthog-"));
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
  assert.equal(tweede.gewijzigd,0,"tweede PostHog artifactpass moet noop zijn");

  fs.writeFileSync(path.join(tmp,"index.html"),deliveryHtml);
  fs.writeFileSync(path.join(tmp,"weer","almere","index.html"),deliveryHtml);
  const delivery=pasArtifactAan(tmp);
  assert.equal(delivery.deliveryActief,true,"deliverymarker moet de header-CSP-route activeren");
  assert.equal(delivery.metas,0,"deliverypass mag geen verwijderde meta-CSP vereisen of terugzetten");
  assert.equal(delivery.scripts,2,"deliverypass moet beide HTML-bestanden van de lokale analyticsfile voorzien");
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

const headers=fs.readFileSync(path.join(root,"cloudflare","_headers"),"utf8");
const middleware=fs.readFileSync(path.join(root,"functions","_middleware.js"),"utf8");
assert(headers.includes("connect-src 'self' https://api.open-meteo.com https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com https://api.bigdatacloud.net https://eu.i.posthog.com"),"Cloudflare CSP moet PostHog EU capture expliciet toestaan");
assert(middleware.includes("https://eu.i.posthog.com; object-src 'none'"),"middleware-CSP moet exact dezelfde PostHog EU-origin toestaan");
assert(!headers.includes("eu-assets.i.posthog.com"),"CSP mag geen externe PostHog SDK-assets toestaan");

const cloudflareCspScript=fs.readFileSync(path.join(root,"scripts","apply-cloudflare-web-analytics-csp.js"),"utf8");
const deliveryCleanup=fs.readFileSync(path.join(root,"scripts","platform-output-cleanup.js"),"utf8");
assert(!cloudflareCspScript.includes("apply-posthog-analytics.js"),"PostHog mag niet meer vóór de finale deliveryguard vanuit de Cloudflare-CSP-stap worden geïnjecteerd");
assert(deliveryCleanup.includes('require("./apply-posthog-analytics.js").pasArtifactAan(PUBLIC)'),"finale delivery-cleanup moet eigenaar zijn van de PostHog-injectie");
assert(deliveryCleanup.includes('vernieuwServiceworkerCache(PUBLIC,"delivery-posthog-analytics")'),"cachehash moet na de finale PostHog-HTML-mutatie opnieuw worden vernieuwd");
const optimaliseerPos=deliveryCleanup.indexOf("optimaliseerPublic().then");
const posthogPos=deliveryCleanup.indexOf("voegPostHogNaDeliveryToe();",optimaliseerPos);
assert(optimaliseerPos>=0&&posthogPos>optimaliseerPos,"PostHog moet aantoonbaar pas na succesvolle delivery-optimalisatie worden toegepast");

const privacy=fs.readFileSync(path.join(root,"privacy.html"),"utf8");
for(const tekst of ["PostHog Cloud EU","geen PostHog-SDK","querystring","URL-hash","IP-anonimisering"]){
  assert(privacy.includes(tekst),"privacyverklaring mist PostHog-uitleg: "+tekst);
}

console.log("posthog-analytics-contract: EU capture, anonieme allowlist, GeoIP-uit, geen persistence/replay/SDK, route-redactie, CSP, post-delivery injectie, cachevernieuwing en privacytekst OK");
