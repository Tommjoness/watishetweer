"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {LOCATIES}=require("./seo-locations.config.js");

const PUBLIC=path.join(__dirname,"..","public");
const APP_RE=/\/app-([0-9a-f]{12})\.min\.js/g;
const BUILD_RE=/<meta name="weather-build-sha" content="([^"]+)">/;
const CANONICAL_RE=/<link rel="canonical" href="([^"]+)">/;

function lees(rel){
  const p=path.join(PUBLIC,rel);
  if(!fs.existsSync(p))throw new Error("Release-artifact ontbreekt: "+rel);
  return fs.readFileSync(p,"utf8");
}
function hoofdscript(html,label){
  const scripts=[...String(html).matchAll(APP_RE)].map(m=>`/app-${m[1]}.min.js`);
  assert.equal(scripts.length,1,`${label}: verwacht exact één hoofdclientscript, gevonden ${scripts.length}`);
  return scripts[0];
}
function buildmarker(html,label){
  const m=BUILD_RE.exec(String(html));
  assert(m&&m[1],`${label}: buildmarker ontbreekt`);
  return m[1];
}
function geenExecutableInline(html,label){
  const inline=[...String(html).matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>{
    const attrs=String(m[1]||"");
    return !/\bsrc\s*=/i.test(attrs)&&!/\btype\s*=\s*["'](?:application\/ld\+json|application\/json)["']/i.test(attrs);
  });
  assert.equal(inline.length,0,`${label}: executable inline script bleef achter na delivery`);
}

const scenarios=[
  {label:"/",rel:"index.html",canonical:"https://watishetweer.nl/"},
  ...LOCATIES.map(loc=>({label:`/weer/${loc.slug}/`,rel:path.join("weer",loc.slug,"index.html"),canonical:`https://watishetweer.nl/weer/${loc.slug}/`}))
];

let verwachtBundle=null,verwachtBuild=null;
for(const s of scenarios){
  const html=lees(s.rel);
  const bundle=hoofdscript(html,s.label),build=buildmarker(html,s.label);
  const canonical=(CANONICAL_RE.exec(html)||[])[1];
  assert.equal(canonical,s.canonical,`${s.label}: canonical wijkt af`);
  assert(html.includes('id="weather-js-required"'),`${s.label}: noscript-herstel ontbreekt`);
  assert(html.includes('id="bootstrap-failure"'),`${s.label}: failed-JS-herstel ontbreekt`);
  assert(html.includes('id="weather-now-route"'),`${s.label}: route-data ontbreekt, ook root moet expliciet leeg route-object hebben`);
  geenExecutableInline(html,s.label);
  if(verwachtBundle===null)verwachtBundle=bundle;
  else assert.equal(bundle,verwachtBundle,`${s.label}: hoofdclientscript divergeert binnen dezelfde release`);
  if(verwachtBuild===null)verwachtBuild=build;
  else assert.equal(build,verwachtBuild,`${s.label}: buildmarker divergeert binnen dezelfde release`);
}

const bundlePad=path.join(PUBLIC,verwachtBundle.slice(1));
assert(fs.existsSync(bundlePad),`Actieve hoofdclient ontbreekt op disk: ${verwachtBundle}`);
const appBestanden=fs.readdirSync(PUBLIC).filter(n=>/^app-[0-9a-f]{12}\.min\.js$/.test(n));
assert.deepEqual(appBestanden,[path.basename(verwachtBundle)],"public mag na delivery exact één actuele hoofdclientbundle bevatten");

const sw=lees("sw.js");
const swApps=[...sw.matchAll(/app-[0-9a-f]{12}\.min\.js/g)].map(m=>m[0]);
assert.equal(swApps.length,1,"serviceworker-precache moet exact één app-bundlereferentie bevatten");
assert.equal(swApps[0],path.basename(verwachtBundle),"serviceworker moet de actuele gedeelde hoofdclient precachen");

const bundel=fs.readFileSync(bundlePad,"utf8");
for(const marker of [
  "weathernow:app-ready","pageshow","AbortController","laadTeller","zoekGeneratie"
])assert(bundel.includes(marker),`Actieve hoofdclient mist release-/race-invariant: ${marker}`);

console.log(`Release-bundleconsistentie geslaagd: ${scenarios.length} app-routes delen build ${verwachtBuild} en ${verwachtBundle}; serviceworker verwijst uitsluitend naar dezelfde client.`);
