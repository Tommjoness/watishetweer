"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {POSTBUILD_STAPPEN,voerPostbuildUit}=require("./postbuild-pipeline.js");

const verwacht=[
  "apply-mobile-screenshot-polish.js",
  "verify-mobile-screenshot-build.js",
  "apply-performance-final.js",
  "apply-q3-senior-polish.js",
  "verify-q3-build.js",
  "apply-q4-rain-periods.js",
  "verify-q4-rain-periods.js",
  "verify-performance-final.js",
  "apply-ui-shell.js",
  "verify-ui-shell.js",
  "verify-pollen-hour-correctness.js",
  "apply-shared-url-place-identity.js",
  "verify-cache-fallback-country.js",
  "apply-ui-polish-20260813.js",
  "verify-ui-polish-runtime-retirement.js",
  "apply-weather-fallback-hedge.js",
  "verify-weather-fallback-hedge.js",
  "verify-fetch-error-semantics.js",
  "verify-polar-chart-sentinel.js",
  "apply-unified-weather-truth.js",
  "verify-unified-weather-truth.js",
  "verify-small-chance-consistency.js",
  "verify-nederlandse-microcopy.js",
  "verify-seo-foundation.js",
  "generate-seo-location-pages.js",
  "verify-seo-location-pages.js",
  "apply-build-provenance.js",
  "verify-build-provenance.js",
  "verify-final-27.js"
];
assert.deepStrictEqual([...POSTBUILD_STAPPEN],verwacht,"postbuildvolgorde moet exact gelijk blijven aan de bewezen keten plus directe runtime-retirementguard");
assert.equal(new Set(POSTBUILD_STAPPEN).size,POSTBUILD_STAPPEN.length,"postbuild mag geen stap dubbel uitvoeren");
for(const stap of POSTBUILD_STAPPEN){assert(fs.existsSync(path.join(__dirname,stap)),"postbuild verwijst naar ontbrekend script: "+stap);}
assert(!fs.existsSync(path.join(__dirname,"apply-cache-fallback-country.js")),"oude misleidende cachefallback-owner moet verwijderd zijn");
assert(!fs.existsSync(path.join(__dirname,"apply-polar-chart-sentinel.js")),"oude late poolgrafiekmutator moet verwijderd zijn");
assert(!fs.existsSync(path.join(__dirname,"apply-seo-foundation.js")),"oude late SEO-mutator moet verwijderd zijn");
assert(!fs.existsSync(path.join(__dirname,"apply-pollen-hour-correctness.js")),"oude late pollen-mutator moet verwijderd zijn");
assert(!fs.existsSync(path.join(__dirname,"ui-polish-20260813-runtime.js")),"lege historische UI-polishruntime moet verwijderd zijn");
assert(fs.existsSync(path.join(__dirname,"seo-foundation.js")),"pure SEO-owner moet bestaan");
assert(fs.existsSync(path.join(__dirname,"pollen-hour-correctness.js")),"pure pollen-owner moet bestaan");

/* Bewolkingscopy hoort uitsluitend bij de canonieke senior-semantiekbron. Q3 mag
   de bewezen 100%/95%-grenzen controleren, maar geen compatibiliteitsfallback
   meer bezitten die dezelfde helper later opnieuw kan herschrijven. */
const q3Bron=fs.readFileSync(path.join(__dirname,"apply-q3-senior-polish.js"),"utf8");
const seniorSemantiekBron=fs.readFileSync(path.join(__dirname,"..","senior-semantiek-20260810.js"),"utf8");
assert(seniorSemantiekBron.includes('if(n===100)return "Geheel bewolkt";'),"canonieke senior-semantiek moet de 100%-bewolkingsgrens bezitten");
assert(seniorSemantiekBron.includes('if(n>=95)return "Vrijwel geheel bewolkt";'),"canonieke senior-semantiek moet de 95%-bewolkingsgrens bezitten");
for(const oudeOwner of ["CLOUD_OLD","CLOUD_NEW","cloudNieuwAantal","cloudOudAantal"]){
  assert(!q3Bron.includes(oudeOwner),"Q3 mag geen oude cloud-fallback-owner meer bevatten: "+oudeOwner);
}

const positie=naam=>POSTBUILD_STAPPEN.indexOf(naam);
assert(positie("apply-mobile-screenshot-polish.js")<positie("verify-mobile-screenshot-build.js"));
assert(positie("apply-q3-senior-polish.js")<positie("verify-q3-build.js"));
assert(positie("apply-q4-rain-periods.js")<positie("verify-q4-rain-periods.js"));
assert(positie("apply-q4-rain-periods.js")<positie("verify-performance-final.js"),"performance-verifier moet finale Q4-artifact zien");
assert(positie("verify-performance-final.js")<positie("apply-ui-shell.js"),"UI-shell blijft na performanceverificatie");
assert(positie("apply-ui-shell.js")<positie("verify-ui-shell.js"));
assert(positie("verify-ui-shell.js")<positie("verify-pollen-hour-correctness.js"),"pollen-owner uit de base-build wordt na de definitieve UI-shell opnieuw geverifieerd");
assert(positie("verify-pollen-hour-correctness.js")<positie("apply-shared-url-place-identity.js"),"shared-URL-plaatsidentiteit ziet de volledig geverifieerde lucht/pollenartifact");
assert(positie("apply-shared-url-place-identity.js")<positie("verify-cache-fallback-country.js"));
assert(positie("verify-cache-fallback-country.js")<positie("apply-ui-polish-20260813.js"),"UI-polish moet de volledige bewezen artifact als basis zien");
assert(positie("apply-ui-polish-20260813.js")<positie("verify-ui-polish-runtime-retirement.js"),"runtime-retirement moet direct na de statische UI-polish worden geverifieerd");
assert(positie("verify-ui-polish-runtime-retirement.js")<positie("apply-weather-fallback-hedge.js"),"weather-fallback ziet alleen een geverifieerde runtime-vrije UI-polishartifact");
assert(positie("apply-weather-fallback-hedge.js")<positie("verify-weather-fallback-hedge.js"),"weather-fallback moet direct na toepassing worden geverifieerd");
assert(positie("verify-weather-fallback-hedge.js")<positie("verify-fetch-error-semantics.js"),"menselijke foutsemantiek uit de base-build moet na de fallbackstrategie geverifieerd blijven");
assert(positie("verify-fetch-error-semantics.js")<positie("verify-polar-chart-sentinel.js"),"poolgrafieksemantiek uit de base-build moet na request- en foutsemantiek geverifieerd blijven");
assert(positie("verify-polar-chart-sentinel.js")<positie("apply-unified-weather-truth.js"),"weather-truth consolideert pas na bewezen poolgrafieksemantiek");
assert(positie("apply-unified-weather-truth.js")<positie("verify-unified-weather-truth.js"),"weather-truth moet direct na toepassing worden geverifieerd");
assert(positie("verify-unified-weather-truth.js")<positie("verify-small-chance-consistency.js"),"kleine-kans-owner wordt pas na de geverifieerde weather-truth-laag gecontroleerd");
assert(positie("verify-small-chance-consistency.js")<positie("verify-nederlandse-microcopy.js"),"Nederlandse copy-verifier ziet de definitieve neerslagsemantiek uit de canonieke owner");
assert(positie("verify-nederlandse-microcopy.js")<positie("verify-seo-foundation.js"),"SEO-verifier behoudt zijn bewezen positie na de definitieve Nederlandse copy");
assert(positie("verify-seo-foundation.js")<positie("generate-seo-location-pages.js"),"plaatsroutes mogen pas na bewezen root-SEO worden gegenereerd");
assert(positie("generate-seo-location-pages.js")<positie("verify-seo-location-pages.js"),"plaatsroutes moeten direct na generatie worden geverifieerd");
assert(positie("verify-seo-location-pages.js")<positie("apply-build-provenance.js"),"build-SHA wordt op het complete route-artifact gestempeld");
assert(positie("apply-build-provenance.js")<positie("verify-build-provenance.js"),"build-provenance moet direct na toepassing worden geverifieerd");
assert(positie("verify-build-provenance.js")<positie("verify-final-27.js"),"finale artifactguard moet routes en provenance meenemen");
assert.equal(POSTBUILD_STAPPEN.at(-1),"verify-final-27.js","finale artifactguard moet laatste stap zijn");
const gezien=[];
voerPostbuildUit({execPath:"node-test",scriptsDir:"/scripts-test",spawnSync:(node,args,opt)=>{gezien.push({node,args,opt});return {status:0};}});
assert.deepStrictEqual(gezien.map(x=>path.basename(x.args[0])),verwacht);
assert(gezien.every(x=>x.node==="node-test"&&x.opt.stdio==="inherit"));
const foutGezien=[];
assert.throws(()=>voerPostbuildUit({execPath:"node-test",scriptsDir:"/scripts-test",spawnSync:(node,args)=>{const naam=path.basename(args[0]);foutGezien.push(naam);return {status:naam==="apply-q3-senior-polish.js"?7:0};}}),e=>e&&e.status===7&&e.stap==="apply-q3-senior-polish.js","pipeline moet de eerste niet-groene stap doorgeven");
assert.deepStrictEqual(foutGezien,verwacht.slice(0,4),"na een fout mogen latere artifactmutaties niet draaien");
console.log("Postbuild-pipeline: exacte volgorde, runtime-retirementguard, canonieke cloud-owner, shared-URL-owner, foutsemantiek, poolgrafiek, pollen/SEO, weather truth, kleine-kans-owner, routes, provenance en fail-fast gedrag geslaagd.");
