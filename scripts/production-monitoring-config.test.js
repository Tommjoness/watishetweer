"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const workflow=fs.readFileSync(path.join(root,".github","workflows","production-smoke.yml"),"utf8");
const smoke=fs.readFileSync(path.join(root,"scripts","production-smoke.js"),"utf8");
const wereldwijd=fs.readFileSync(path.join(root,"scripts","production-worldwide-browser.js"),"utf8");
const performance=fs.readFileSync(path.join(root,"scripts","production-live-performance-browser.js"),"utf8");
const cls=fs.readFileSync(path.join(root,"scripts","production-mobile-cls-browser.js"),"utf8");
const sitemapContract=require("./production-sitemap-contract.js");

assert(/push:\s*\n\s*branches:\s*\[main\]/.test(workflow),"production-smoke moet na merges/pushes naar main draaien");
assert(/schedule:\s*\n\s*- cron: ["']\d+ \* \* \* \*["']/.test(workflow),"production-smoke moet ieder uur gepland staan");
assert(/workflow_dispatch:/.test(workflow),"production-smoke moet handmatig startbaar blijven");
assert(workflow.includes("EXPECTED_SHA: ${{ github.sha }}"),"workflow moet de exacte GitHub-SHA aan productie koppelen");
assert(workflow.includes("SMOKE_REQUEST_TIMEOUT_MS:"),"workflow moet een expliciete request-timeout instellen");
assert(workflow.includes("mcr.microsoft.com/playwright:v1.62.1-noble"),"production-smoke moet een vaste browserimage gebruiken");
assert(workflow.includes("node scripts/production-worldwide-browser.js"),"workflow mist de wereldwijde browsermonitor");
assert(workflow.includes("node scripts/production-staff-audit-browser.js"),"workflow mist de interactieve staff-auditmonitor");
assert(workflow.includes("node scripts/production-live-performance-browser.js"),"workflow mist de live Chromium/WebKit-performancemonitor");
assert(workflow.includes("node scripts/production-mobile-cls-browser.js"),"workflow mist de mobiele CLS-productiemonitor");
assert(workflow.includes("node scripts/production-sitemap-contract.js"),"workflow mist het exacte live sitemapcontract");

/* Iedere browsermonitor start pas nadat exact dezelfde SHA aantoonbaar live is.
   De CLS-monitor is bewust een eigen job: vijf koude loads mogen niet worden
   beïnvloed door de zware wereld-/staff-/performancetests op dezelfde runner. */
assert(/^  production-contract:/m.test(workflow),"production-smoke mist aparte deployment/API-contractjob");
assert(/^  wereldwijd-browser:/m.test(workflow),"production-smoke mist aparte wereldwijde browserjob");
assert(/^  staff-audit-browser:/m.test(workflow),"production-smoke mist aparte staff-audit browserjob");
assert(/^  live-performance-browser:/m.test(workflow),"production-smoke mist aparte live-performancejob");
assert(/^  mobile-cls-browser:/m.test(workflow),"production-smoke mist aparte mobiele CLS-job");
assert.equal((workflow.match(/^    needs: production-contract$/gm)||[]).length,4,"alle vier browserjobs moeten pas na het exacte productiecontract starten");

assert(smoke.includes("AbortSignal.timeout(timeoutMs)"),"production-smoke requests moeten een harde timeout hebben");
assert(smoke.includes("const maxPogingen=opt.retry===false?1:2"),"production-smoke mag per request maximaal één retry doen");
assert(smoke.includes('redirect:"manual"'),"production-smoke moet de www-redirect zelf controleren");
assert(smoke.includes("/weer/dit-bestaat-niet/"),"production-smoke moet echte 404-semantiek bewaken");
assert(smoke.includes("/api/plaatsnaam?lat=52.3508&lon=5.2647"),"production-smoke mist plaatsnaam-API-contract");
assert(smoke.includes("/api/neerslag?lat=52.3508&lon=5.2647&land=NL"),"production-smoke mist neerslag-API-contract");
assert(smoke.includes("/api/waarschuwingen?lat=52.3508&lon=5.2647&land=NL"),"production-smoke mist waarschuwingen-API-contract");
assert(smoke.includes("item.plaatsSpecifiek===true"),"waarschuwingencontract moet plaatsgebonden filtering bewaken");

assert.equal(sitemapContract.VERWACHTE_URLS.length,37,"huidig sitemapcontract moet exact 37 canonieke URLs bevatten");
assert.equal(new Set(sitemapContract.VERWACHTE_URLS).size,sitemapContract.VERWACHTE_URLS.length,"verwacht sitemapcontract mag geen duplicaten bevatten");
assert(sitemapContract.VERWACHTE_URLS.includes("https://watishetweer.nl/over/"),"verwacht sitemapcontract moet /over/ bevatten");
const testXml=`<?xml version="1.0"?><urlset>${sitemapContract.VERWACHTE_URLS.map(url=>`<url><loc>${url}</loc></url>`).join("")}</urlset>`;
assert.deepEqual(sitemapContract.controleerSitemap(testXml),sitemapContract.VERWACHTE_URLS,"sitemapcontract moet de huidige canonieke set accepteren");
const omgekeerd=[...sitemapContract.VERWACHTE_URLS].reverse();
const omgekeerdXml=`<?xml version="1.0"?><urlset>${omgekeerd.map(url=>`<url><loc>${url}</loc></url>`).join("")}</urlset>`;
assert.deepEqual(sitemapContract.controleerSitemap(omgekeerdXml),omgekeerd,"sitemapcontract mag niet onnodig van URL-volgorde afhangen");
assert.throws(()=>sitemapContract.controleerSitemap(testXml.replace("<url><loc>https://watishetweer.nl/over/</loc></url>","")),/exact 37/,"sitemapcontract moet een ontbrekende /over/ afwijzen");

for(const plek of ["Amsterdam","New York","Tokio","Sydney","Singapore","Longyearbyen"])assert(wereldwijd.includes(`naam:\"${plek}\"`),`wereldwijde monitor mist ${plek}`);
assert(wereldwijd.includes('{naam:"mobiel",width:390,height:844}'),"wereldwijde monitor mist mobiel 390px");
assert(wereldwijd.includes('{naam:"desktop",width:1440,height:1000}'),"wereldwijde monitor mist desktop");
assert(wereldwijd.includes('uit.overflow<=1'),"wereldwijde monitor bewaakt horizontale overflow niet");
assert(wereldwijd.includes('assert.equal(uit.sha,verwacht'),"wereldwijde browsermonitor moet de exacte build-SHA bewaken");
assert(wereldwijd.includes("verifieerBronwaarheid(bron,uit"),"wereldwijde browsermonitor vergelijkt zichtbare waarden niet met de live bronrespons");
assert(wereldwijd.includes("isVolledigeForecast(r.url())"),"wereldwijde browsermonitor moet de volledige forecastrespons en niet de current-only preview vergelijken");
assert(performance.includes('const {chromium,webkit,devices}=require("playwright")'),"live performancemonitor moet Chromium en WebKit gebruiken");
assert(performance.includes("volledigeForecasts.length,1"),"live performancemonitor bewaakt dubbele volledige forecastaanvragen niet");
assert(performance.includes("previewForecasts.length<=1"),"live performancemonitor begrenst de current-only preview niet");
assert(performance.includes("mislukteVolledige.length,0"),"live performancemonitor onderscheidt een afgebroken preview niet van een mislukte volledige forecast");
assert(performance.includes("scripts.length<=1"),"live performancemonitor begrenst de Cloudflare analytics-scriptinjectie niet");
assert(performance.includes("vreemd.length,0"),"live performancemonitor weigert onverwachte analytics-origins niet");
assert(performance.includes("isEigenRum"),"live performancemonitor moet de proxied same-origin /cdn-cgi/rum route herkennen");
assert(!performance.includes("beacons.length,0"),"live performancemonitor mag Web Analytics niet meer categorisch verbieden");

assert(cls.includes("const RONDEN=5"),"productie-CLS-monitor moet vijf koude runs doen");
assert(cls.includes("const CLS_BUDGET=0.1"),"productie-CLS-monitor moet onder 0,1 afdwingen");
assert(cls.includes("const OBSERVATIE_MS=12000"),"productie-CLS-monitor moet een vast twaalfsecondenvenster meten");
assert(cls.includes("const MIN_DATA_RONDEN=2"),"productie-CLS-monitor moet minimaal twee echte datarondes eisen");
assert(cls.includes('type:"layout-shift"'),"productie-CLS-monitor moet echte LayoutShift-entries meten");
assert(cls.includes("await page.waitForTimeout(OBSERVATIE_MS)"),"productie-CLS-monitor mag zijn layoutmeting niet op providerafronding blokkeren");
assert(!cls.includes("waitForFunction"),"productie-CLS-monitor mag niet wachten op data/fout als voorwaarde om CLS te meten");
assert(cls.includes("meting.finalScrollY,meting.initialScrollY"),"productie-CLS-monitor moet spontane initiële scroll bewaken");
assert(cls.includes("meting.sha,verwacht"),"productie-CLS-monitor moet de exacte live SHA bewaken");
assert(cls.includes('state.classList.contains("err")'),"productie-CLS-monitor moet een nette terminale foutlayout apart classificeren");
assert(cls.includes('/Ophalen mislukt|Geen verbinding/i'),"productie-CLS-monitor mag alleen expliciete menselijke forecastfoutstates als fout classificeren");
assert(cls.includes('uitkomst:heeftData?"data":terminaleFout?"fout":"laden"'),"productie-CLS-monitor moet ook een nog ladende providerstate als gemeten layoutstate rapporteren");
assert(cls.includes("assert(dataRondes>=MIN_DATA_RONDEN"),"productie-CLS-monitor mag niet groen worden zonder representatieve echte weerdata");
assert(cls.includes("Beschikbaarheid wordt apart bewaakt"),"CLS-monitor moet beschikbaarheid expliciet als aparte verantwoordelijkheid rapporteren");

require("./production-source-truth.test.js");

console.log("production-monitoring-config: deploymentcontract, vier gescheiden browsergates, gecontroleerde Cloudflare Web Analytics, vaste mobiele CLS-vensters en strikt sitemapcontract OK");
