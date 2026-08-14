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
  "apply-pollen-hour-correctness.js",
  "verify-pollen-hour-correctness.js",
  "apply-cache-fallback-country.js",
  "verify-cache-fallback-country.js",
  "apply-ui-polish-20260813.js",
  "apply-weather-fallback-hedge.js",
  "verify-weather-fallback-hedge.js",
  "apply-fetch-error-semantics.js",
  "verify-fetch-error-semantics.js",
  "apply-polar-chart-sentinel.js",
  "verify-polar-chart-sentinel.js",
  "apply-seo-foundation.js",
  "verify-seo-foundation.js",
  "verify-final-27.js"
];
assert.deepStrictEqual([...POSTBUILD_STAPPEN],verwacht,"postbuildvolgorde moet exact gelijk blijven aan de bewezen keten");
assert.equal(new Set(POSTBUILD_STAPPEN).size,POSTBUILD_STAPPEN.length,"postbuild mag geen stap dubbel uitvoeren");
for(const stap of POSTBUILD_STAPPEN){assert(fs.existsSync(path.join(__dirname,stap)),"postbuild verwijst naar ontbrekend script: "+stap);}
const positie=naam=>POSTBUILD_STAPPEN.indexOf(naam);
assert(positie("apply-mobile-screenshot-polish.js")<positie("verify-mobile-screenshot-build.js"));
assert(positie("apply-q3-senior-polish.js")<positie("verify-q3-build.js"));
assert(positie("apply-q4-rain-periods.js")<positie("verify-q4-rain-periods.js"));
assert(positie("apply-q4-rain-periods.js")<positie("verify-performance-final.js"),"performance-verifier moet finale Q4-artifact zien");
assert(positie("verify-performance-final.js")<positie("apply-ui-shell.js"),"UI-shell blijft na performanceverificatie");
assert(positie("apply-ui-shell.js")<positie("verify-ui-shell.js"));
assert(positie("verify-ui-shell.js")<positie("apply-pollen-hour-correctness.js"),"pollen-correctie ziet de definitieve UI-shell");
assert(positie("apply-pollen-hour-correctness.js")<positie("verify-pollen-hour-correctness.js"));
assert(positie("verify-pollen-hour-correctness.js")<positie("apply-cache-fallback-country.js"),"cachefallback-landcorrectie ziet de volledige lucht/pollenartifact");
assert(positie("apply-cache-fallback-country.js")<positie("verify-cache-fallback-country.js"));
assert(positie("verify-cache-fallback-country.js")<positie("apply-ui-polish-20260813.js"),"UI-polish moet de volledige bewezen artifact als basis zien");
assert(positie("apply-ui-polish-20260813.js")<positie("apply-weather-fallback-hedge.js"),"weather-fallback ziet de volledige UI-polishartifact");
assert(positie("apply-weather-fallback-hedge.js")<positie("verify-weather-fallback-hedge.js"),"weather-fallback moet direct na toepassing worden geverifieerd");
assert(positie("verify-weather-fallback-hedge.js")<positie("apply-fetch-error-semantics.js"),"menselijke foutsemantiek moet op de nieuwe fallbackstrategie worden toegepast");
assert(positie("apply-fetch-error-semantics.js")<positie("verify-fetch-error-semantics.js"),"foutsemantiek moet direct na toepassing worden geverifieerd");
assert(positie("verify-fetch-error-semantics.js")<positie("apply-polar-chart-sentinel.js"),"poolgrafiekcorrectie moet de definitieve request- en foutsemantiek als basis zien");
assert(positie("apply-polar-chart-sentinel.js")<positie("verify-polar-chart-sentinel.js"),"poolgrafiekcorrectie moet direct na toepassing worden geverifieerd");
assert(positie("verify-polar-chart-sentinel.js")<positie("apply-seo-foundation.js"),"SEO-metadata moet op het inhoudelijk definitieve artifact worden toegepast");
assert(positie("apply-seo-foundation.js")<positie("verify-seo-foundation.js"),"SEO-fundering moet direct na toepassing worden geverifieerd");
assert(positie("verify-seo-foundation.js")<positie("verify-final-27.js"),"finale artifactguard moet de SEO-fundering meenemen");
assert.equal(POSTBUILD_STAPPEN.at(-1),"verify-final-27.js","finale artifactguard moet laatste stap zijn");
const gezien=[];
voerPostbuildUit({execPath:"node-test",scriptsDir:"/scripts-test",spawnSync:(node,args,opt)=>{gezien.push({node,args,opt});return {status:0};}});
assert.deepStrictEqual(gezien.map(x=>path.basename(x.args[0])),verwacht);
assert(gezien.every(x=>x.node==="node-test"&&x.opt.stdio==="inherit"));
const foutGezien=[];
assert.throws(()=>voerPostbuildUit({execPath:"node-test",scriptsDir:"/scripts-test",spawnSync:(node,args)=>{const naam=path.basename(args[0]);foutGezien.push(naam);return {status:naam==="apply-q3-senior-polish.js"?7:0};}}),e=>e&&e.status===7&&e.stap==="apply-q3-senior-polish.js","pipeline moet de eerste niet-groene stap doorgeven");
assert.deepStrictEqual(foutGezien,verwacht.slice(0,4),"na een fout mogen latere artifactmutaties niet draaien");
console.log("Postbuild-pipeline: exacte volgorde, bestanden, guards en fail-fast gedrag geslaagd.");
