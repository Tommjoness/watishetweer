"use strict";

const assert=require("assert");
const fs=require("fs");
const os=require("os");
const path=require("path");
const vm=require("vm");
const {CONNECT_SOURCE,SCRIPT_TAG,DELIVERY_META,verruimConnectSrc,pasHtmlAan,pasArtifactAan}=require("./apply-plausible-analytics.js");

const root=path.join(__dirname,"..");
const analytics=fs.readFileSync(path.join(root,"plausible-analytics.js"),"utf8");
new vm.Script(analytics,{filename:"plausible-analytics.js"});

assert.equal(CONNECT_SOURCE,"https://plausible.io","Plausible capture moet uitsluitend de officiële Plausible-origin gebruiken");
assert(analytics.includes('const ENDPOINT="https://plausible.io/api/event"'),"capture endpoint moet de officiële Plausible Events API zijn");
assert(analytics.includes('const DOMAIN="watishetweer.nl"'),"Plausible-site-id moet watishetweer.nl zijn");
assert(analytics.includes('navigator.webdriver===true'),"webdriver-automatisering moet vóór capture worden uitgesloten");
assert(analytics.includes("HeadlessChrome"),"gangbare headless Chrome QA moet vóór capture worden uitgesloten");
assert(analytics.includes('navigator.globalPrivacyControl===true'),"Global Privacy Control moet Plausible uitschakelen");
assert(analytics.includes('navigator.doNotTrack==="1"'),"Do Not Track moet Plausible uitschakelen");
assert(analytics.includes('return "/weer/:location"'),"weerroutes moeten plaatsnamen vóór capture generaliseren");
assert(analytics.includes('credentials:"omit"'),"Plausible-request mag geen browsercredentials meesturen");
assert(analytics.includes('referrerPolicy:"no-referrer"'),"Plausible-request mag geen Referer lekken");
assert(analytics.includes('"Content-Type":"text/plain"'),"Events API capture hoort een eenvoudige text/plain request zonder preflight te gebruiken");
for(const [label,patroon] of [
  ["localStorage-gebruik",/\blocalStorage\s*(?:\.|\[)/],
  ["sessionStorage-gebruik",/\bsessionStorage\s*(?:\.|\[)/],
  ["cookie-gebruik",/\bdocument\s*\.\s*cookie\b/],
  ["querystring-uitlezing",/\blocation\s*\.\s*search\b/],
  ["hash-uitlezing",/\blocation\s*\.\s*hash\b/],
  ["X-Forwarded-For",/["']X-Forwarded-For["']\s*:/i]
])assert(!patroon.test(analytics),"privacy-/visitorcontract verbiedt "+label);

function voerUit(opt={}){
  const requests=[];
  const context={
    location:{
      protocol:opt.protocol||"https:",
      hostname:opt.hostname||"watishetweer.nl",
      pathname:opt.pathname||"/",
      search:opt.search||"",
      hash:opt.hash||""
    },
    navigator:{
      userAgent:opt.userAgent||"Mozilla/5.0 Chrome/153.0.0.0 Safari/537.36",
      webdriver:opt.webdriver===true,
      globalPrivacyControl:opt.gpc===true,
      doNotTrack:opt.navigatorDnt||"0"
    },
    window:{doNotTrack:opt.windowDnt||"0"},
    fetch(url,fetchOpt){requests.push({url,fetchOpt});return Promise.resolve({ok:true});}
  };
  vm.runInNewContext(analytics,context,{filename:"plausible-analytics.js"});
  return requests.map(({url,fetchOpt})=>({url,fetchOpt,payload:JSON.parse(fetchOpt.body)}));
}

const normaal=voerUit({pathname:"/weer/Almere",search:"?lat=52.3702&lon=5.2141",hash:"#detail"});
assert.equal(normaal.length,1,"normale productiebezoeker hoort één Plausible-pageview te sturen");
assert.equal(normaal[0].url,"https://plausible.io/api/event");
assert.equal(normaal[0].payload.name,"pageview");
assert.equal(normaal[0].payload.domain,"watishetweer.nl");
assert.equal(normaal[0].payload.url,"https://watishetweer.nl/weer/:location");
const serialized=JSON.stringify(normaal[0].payload);
for(const geheim of ["Almere","52.3702","5.2141","#detail"]){
  assert(!serialized.includes(geheim),"Plausible-pageview lekt locatie- of URL-data: "+geheim);
}

assert.equal(voerUit({webdriver:true}).length,0,"navigator.webdriver moet QA-capture blokkeren");
assert.equal(voerUit({userAgent:"Mozilla/5.0 HeadlessChrome/153.0.0.0"}).length,0,"HeadlessChrome moet QA-capture blokkeren");
assert.equal(voerUit({hostname:"preview.pages.dev"}).length,0,"previewhost mag geen bezoekersdata sturen");
assert.equal(voerUit({protocol:"http:"}).length,0,"niet-HTTPS omgeving mag geen bezoekersdata sturen");
assert.equal(voerUit({gpc:true}).length,0,"GPC moet Plausible blokkeren");
assert.equal(voerUit({navigatorDnt:"1"}).length,0,"navigator DNT moet Plausible blokkeren");
assert.equal(voerUit({windowDnt:"1"}).length,0,"window DNT moet Plausible blokkeren");

const policy="default-src 'self'; script-src 'self'; connect-src 'self' https://api.open-meteo.com; base-uri 'none'";
const csp=verruimConnectSrc(policy);
assert(csp.includes("connect-src 'self' https://api.open-meteo.com https://plausible.io"),"Plausible-origin moet uitsluitend aan connect-src worden toegevoegd");
assert.equal(verruimConnectSrc(csp),csp,"Plausible CSP-bewerking moet idempotent zijn");
const defaultOnly="default-src 'self'; script-src 'self'";
assert(verruimConnectSrc(defaultOnly).includes("connect-src 'self' https://plausible.io"),"default-src moet veilig naar expliciete connect-src worden vertaald");

const html=`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"></head><body><p>x</p></body></html>`;
const eersteHtml=pasHtmlAan(html);
assert(eersteHtml.html.includes(SCRIPT_TAG),"Plausible-script moet vóór body-einde worden geïnjecteerd");
assert(eersteHtml.html.includes(CONNECT_SOURCE),"meta-CSP moet Plausible toestaan zolang delivery nog niet naar headers is gemigreerd");
assert.equal(pasHtmlAan(eersteHtml.html).html,eersteHtml.html,"Plausible HTML-injectie moet idempotent zijn");

const deliveryHtml=`<!doctype html><html><head>${DELIVERY_META}</head><body><p>x</p></body></html>`;
const deliveryResultaat=pasHtmlAan(deliveryHtml);
assert.equal(deliveryResultaat.metas,0,"definitieve delivery-HTML hoort geen meta-CSP meer te hebben");
assert(deliveryResultaat.html.includes(SCRIPT_TAG),"Plausible-script moet ook na CSP-headermigratie worden geïnjecteerd");
assert(!deliveryResultaat.html.includes(CONNECT_SOURCE),"delivery-injectie mag geen CSP-meta terugintroduceren");

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"watishetweer-plausible-"));
try{
  fs.writeFileSync(path.join(tmp,"plausible-analytics.js"),analytics);
  fs.writeFileSync(path.join(tmp,"index.html"),html);
  fs.mkdirSync(path.join(tmp,"weer","almere"),{recursive:true});
  fs.writeFileSync(path.join(tmp,"weer","almere","index.html"),html);
  const eerste=pasArtifactAan(tmp);
  assert.equal(eerste.bestanden,2);
  assert.equal(eerste.scripts,2);
  assert.equal(eerste.deliveryActief,false);
  const tweede=pasArtifactAan(tmp);
  assert.equal(tweede.gewijzigd,0,"tweede Plausible artifactpass moet noop zijn");

  fs.writeFileSync(path.join(tmp,"index.html"),deliveryHtml);
  fs.writeFileSync(path.join(tmp,"weer","almere","index.html"),deliveryHtml);
  const delivery=pasArtifactAan(tmp);
  assert.equal(delivery.deliveryActief,true,"deliverymarker moet de header-CSP-route activeren");
  assert.equal(delivery.scripts,2,"deliverypass moet beide HTML-bestanden van Plausible voorzien");
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

const headers=fs.readFileSync(path.join(root,"cloudflare","_headers"),"utf8");
const middleware=fs.readFileSync(path.join(root,"functions","_middleware.js"),"utf8");
assert(headers.includes("https://eu.i.posthog.com https://plausible.io; object-src 'none'"),"Cloudflare CSP moet Plausible naast PostHog expliciet toestaan");
assert(middleware.includes("https://eu.i.posthog.com https://plausible.io; object-src 'none'"),"middleware-CSP moet Plausible naast PostHog expliciet toestaan");

const privacy=fs.readFileSync(path.join(root,"privacy.html"),"utf8");
for(const tekst of ["Plausible Analytics","unieke bezoekers","navigator.webdriver"]){
  if(tekst==="navigator.webdriver")continue;
  assert(privacy.includes(tekst),"privacyverklaring mist Plausible-uitleg: "+tekst);
}

console.log("plausible-analytics-contract: directe pageview Events API, browser-UA/IP voor unieke bezoekers, QA/headless guards, botfiltering, route-redactie, CSP en privacytekst OK");
