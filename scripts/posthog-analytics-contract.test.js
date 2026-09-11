"use strict";

const assert=require("assert");
const fs=require("fs");
const os=require("os");
const path=require("path");
const vm=require("vm");
const {CONNECT_SOURCE,SCRIPT_TAG,verruimConnectSrc,pasHtmlAan,pasArtifactAan}=require("./apply-posthog-analytics.js");

const root=path.join(__dirname,"..");
const analytics=fs.readFileSync(path.join(root,"posthog-analytics.js"),"utf8");
new vm.Script(analytics,{filename:"posthog-analytics.js"});

assert.equal(CONNECT_SOURCE,"https://eu.i.posthog.com","PostHog capture moet uitsluitend de EU-ingestion origin gebruiken");
assert(analytics.includes('const ENDPOINT="https://eu.i.posthog.com/i/v0/e/"'),"capture endpoint moet de officiële EU single-event endpoint zijn");
assert(analytics.includes('"$process_person_profile":false'),"events moeten anoniem blijven zonder person profile");
assert(analytics.includes('credentials:"omit"'),"PostHog-request mag geen browsercredentials meesturen");
assert(analytics.includes('referrerPolicy:"no-referrer"'),"PostHog-request mag geen Referer lekken");
assert(analytics.includes('return "/weer/:location"'),"weerroutes moeten plaatsnamen vóór capture generaliseren");
assert(analytics.includes('navigator.globalPrivacyControl===true'),"Global Privacy Control moet PostHog uitschakelen");
assert(analytics.includes('navigator.doNotTrack==="1"'),"Do Not Track moet PostHog uitschakelen");
for(const verboden of ["localStorage","sessionStorage","document.cookie","posthog.init","eu-assets.i.posthog.com","location.search","location.hash"]){
  assert(!analytics.includes(verboden),"privacycontract mag dit niet gebruiken: "+verboden);
}

const policy="default-src 'self'; script-src 'self'; connect-src 'self' https://api.open-meteo.com; base-uri 'none'";
const csp=verruimConnectSrc(policy);
assert(csp.includes("connect-src 'self' https://api.open-meteo.com https://eu.i.posthog.com"),"PostHog EU-origin moet uitsluitend aan connect-src worden toegevoegd");
assert.equal(verruimConnectSrc(csp),csp,"PostHog CSP-bewerking moet idempotent zijn");
const defaultOnly="default-src 'self'; script-src 'self'";
assert(verruimConnectSrc(defaultOnly).includes("connect-src 'self' https://eu.i.posthog.com"),"default-src moet veilig naar expliciete connect-src worden vertaald");

const html=`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"></head><body><p>x</p></body></html>`;
const eersteHtml=pasHtmlAan(html);
assert(eersteHtml.html.includes(SCRIPT_TAG),"analytics-script moet vóór body-einde worden geïnjecteerd");
assert(eersteHtml.html.includes(CONNECT_SOURCE),"meta-CSP moet EU-ingestion toestaan");
const tweedeHtml=pasHtmlAan(eersteHtml.html);
assert.equal(tweedeHtml.html,eersteHtml.html,"HTML-injectie moet idempotent zijn");

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"watishetweer-posthog-"));
try{
  fs.writeFileSync(path.join(tmp,"posthog-analytics.js"),analytics);
  fs.writeFileSync(path.join(tmp,"index.html"),html);
  fs.mkdirSync(path.join(tmp,"weer","almere"),{recursive:true});
  fs.writeFileSync(path.join(tmp,"weer","almere","index.html"),html);
  const eerste=pasArtifactAan(tmp);
  assert.equal(eerste.bestanden,2);
  assert.equal(eerste.scripts,2);
  const tweede=pasArtifactAan(tmp);
  assert.equal(tweede.gewijzigd,0,"tweede PostHog artifactpass moet noop zijn");
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

const headers=fs.readFileSync(path.join(root,"cloudflare","_headers"),"utf8");
const middleware=fs.readFileSync(path.join(root,"functions","_middleware.js"),"utf8");
assert(headers.includes("connect-src 'self' https://api.open-meteo.com https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com https://api.bigdatacloud.net https://eu.i.posthog.com"),"Cloudflare CSP moet PostHog EU capture expliciet toestaan");
assert(middleware.includes("https://eu.i.posthog.com; object-src 'none'"),"middleware-CSP moet exact dezelfde PostHog EU-origin toestaan");
assert(!headers.includes("eu-assets.i.posthog.com"),"CSP mag geen externe PostHog SDK-assets toestaan");

const privacy=fs.readFileSync(path.join(root,"privacy.html"),"utf8");
for(const tekst of ["PostHog Cloud EU","geen PostHog-SDK","querystring","URL-hash","IP-anonimisering"]){
  assert(privacy.includes(tekst),"privacyverklaring mist PostHog-uitleg: "+tekst);
}

console.log("posthog-analytics-contract: EU capture, anonieme allowlist, geen persistence/replay/SDK, route-redactie, CSP en privacytekst OK");
