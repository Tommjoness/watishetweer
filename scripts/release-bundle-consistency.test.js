"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {LOCATIES}=require("./seo-locations.config.js");

const ROOT=path.join(__dirname,"..");
const PUBLIC=path.join(ROOT,"public");
const SNAPSHOT=path.join(ROOT,".weather-runtime-source.tmp");
const APP_RE=/\/app-([0-9a-f]{12})\.min\.js/g;
const BOOTSTRAP_RE=/\/bootstrap-([0-9a-f]{12})\.min\.js/g;
const HASHED_RE=/^(?:app|bootstrap|page|early)-[0-9a-f]{12}\.min\.js$/;
const BUILD_RE=/<meta name="weather-build-sha" content="([^"]+)">/;
const CANONICAL_RE=/<link rel="canonical" href="([^"]+)">/;
const CONTROL_IDS=["q","here","ververs","thema"];
const FRESHNESS_OWNER=`window.addEventListener("pageshow",()=>{\n  if(!S.d)return;\n  klokBijwerken();\n  stempel();\n});`;

function lees(rel){
  const p=path.join(PUBLIC,rel);
  if(!fs.existsSync(p))throw new Error("Release-artifact ontbreekt: "+rel);
  return fs.readFileSync(p,"utf8");
}
function uniekScript(html,re,label,soort){
  const scripts=[...String(html).matchAll(new RegExp(re.source,re.flags))].map(m=>m[0]);
  assert.equal(scripts.length,1,`${label}: verwacht exact één ${soort}, gevonden ${scripts.length}`);
  return scripts[0];
}
function hoofdscript(html,label){return uniekScript(html,APP_RE,label,"hoofdclientscript");}
function bootstrapScript(html,label){return uniekScript(html,BOOTSTRAP_RE,label,"bootstrap-script");}
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
function htmlBestanden(dir){
  const uit=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())uit.push(...htmlBestanden(p));
    else if(ent.isFile()&&ent.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}
function controleerControlStandaardUit(html,id,label){
  const re=new RegExp(`<(?:input|button)\\b[^>]*\\bid=["']${id}["'][^>]*>`,`gi`);
  const tags=String(html).match(re)||[];
  assert.equal(tags.length,1,`${label}: control ${id} ontbreekt of is dubbel`);
  assert(/\sdisabled(?:\s|=|>)/i.test(tags[0]),`${label}: control ${id} is niet standaard disabled`);
  assert(/\saria-disabled=["']true["']/i.test(tags[0]),`${label}: control ${id} mist aria-disabled=true`);
}
function tel(tekst,zoek){return String(tekst).split(zoek).length-1;}

const scenarios=[
  {label:"/",rel:"index.html",canonical:"https://watishetweer.nl/"},
  ...LOCATIES.map(loc=>({label:`/weer/${loc.slug}/`,rel:path.join("weer",loc.slug,"index.html"),canonical:`https://watishetweer.nl/weer/${loc.slug}/`}))
];
assert.equal(scenarios.length,35,"releasegate verwacht root plus exact 34 plaatsroutes");

let verwachtBundle=null,verwachtBootstrap=null,verwachtBuild=null;
const verwezenAssets=new Set();
for(const s of scenarios){
  const html=lees(s.rel);
  const bundle=hoofdscript(html,s.label),bootstrap=bootstrapScript(html,s.label),build=buildmarker(html,s.label);
  const canonical=(CANONICAL_RE.exec(html)||[])[1];
  assert.equal(canonical,s.canonical,`${s.label}: canonical wijkt af`);
  assert(html.includes('id="weather-js-required"'),`${s.label}: noscript-herstel ontbreekt`);
  assert(html.includes('id="bootstrap-failure"'),`${s.label}: failed-JS-herstel ontbreekt`);
  assert(html.includes('id="weather-now-route"'),`${s.label}: route-data ontbreekt, ook root moet expliciet leeg route-object hebben`);
  assert(!html.includes('<base href="/">'),`${s.label}: productie-CSP verbiedt base-elementen; assets moeten root-absoluut zijn`);
  for(const asset of ["/manifest.json","/icon-192.png","/privacy"])assert(html.includes(`href="${asset}"`),`${s.label}: root-absoluut asset ontbreekt: ${asset}`);
  assert(!/url\(['"]?(?:bodoni-moda|instrument-sans|dm-mono)-latin-/.test(html),`${s.label}: relatief fontpad lekt naar geneste route`);
  assert(new RegExp(`<script\\b[^>]*src=["']${bootstrap.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}["'][^>]*\\bdefer\\b[^>]*\\bdata-weather-bootstrap\\b[^>]*><\\/script>`,`i`).test(html),`${s.label}: bootstrap moet afzonderlijk, deferred en als weather-bootstrap gemarkeerd zijn`);
  for(const id of CONTROL_IDS)controleerControlStandaardUit(html,id,s.label);
  geenExecutableInline(html,s.label);
  verwezenAssets.add(bundle.slice(1));verwezenAssets.add(bootstrap.slice(1));
  if(verwachtBundle===null)verwachtBundle=bundle;
  else assert.equal(bundle,verwachtBundle,`${s.label}: hoofdclientscript divergeert binnen dezelfde release`);
  if(verwachtBootstrap===null)verwachtBootstrap=bootstrap;
  else assert.equal(bootstrap,verwachtBootstrap,`${s.label}: bootstrap divergeert binnen dezelfde release`);
  if(verwachtBuild===null)verwachtBuild=build;
  else assert.equal(build,verwachtBuild,`${s.label}: buildmarker divergeert binnen dezelfde release`);
}

const bundlePad=path.join(PUBLIC,verwachtBundle.slice(1));
const bootstrapPad=path.join(PUBLIC,verwachtBootstrap.slice(1));
assert(fs.existsSync(bundlePad),`Actieve hoofdclient ontbreekt op disk: ${verwachtBundle}`);
assert(fs.existsSync(bootstrapPad),`Actieve bootstrap ontbreekt op disk: ${verwachtBootstrap}`);

const appOpDisk=fs.readdirSync(PUBLIC).filter(n=>/^app-[0-9a-f]{12}\.min\.js$/.test(n));
assert.deepEqual(appOpDisk,[path.basename(verwachtBundle)],"public moet exact één echte weather app-bundle bevatten");
const bootOpDisk=fs.readdirSync(PUBLIC).filter(n=>/^bootstrap-[0-9a-f]{12}\.min\.js$/.test(n));
assert.deepEqual(bootOpDisk,[path.basename(verwachtBootstrap)],"public moet exact één actuele bootstrap-bundle bevatten");
assert(!fs.existsSync(path.join(PUBLIC,".weather-runtime-source.tmp")),"runtime-snapshot mag nooit in public terechtkomen");
assert(fs.existsSync(SNAPSHOT),"delivery runtime-snapshot ontbreekt voor semantische ownercontrole");
const snapshot=fs.readFileSync(SNAPSHOT,"utf8");
assert.equal(tel(snapshot,FRESHNESS_OWNER),1,"gedeelde deliverybron moet exact één BFCache-freshness-pageshowowner bevatten");

for(const bestand of htmlBestanden(PUBLIC)){
  const html=fs.readFileSync(bestand,"utf8");
  for(const m of html.matchAll(/\/(?:app|bootstrap|page|early)-[0-9a-f]{12}\.min\.js/g))verwezenAssets.add(m[0].slice(1));
  const isWeerApp=html.includes('id="weather-now-route"')&&html.includes('id="app"');
  if(!isWeerApp)continue;
  const label="/"+path.relative(PUBLIC,bestand).replace(/\\/g,"/");
  assert.equal(hoofdscript(html,label),verwachtBundle,`${label}: weerapp-shell gebruikt een afwijkende hoofdclient`);
  assert.equal(bootstrapScript(html,label),verwachtBootstrap,`${label}: weerapp-shell gebruikt een afwijkende bootstrap`);
}
const hashedOpDisk=fs.readdirSync(PUBLIC).filter(n=>HASHED_RE.test(n));
for(const naam of hashedOpDisk)assert(verwezenAssets.has(naam),`stale hashed runtime zonder HTML-consument: ${naam}`);

const sw=lees("sw.js");
const appNaam=path.basename(verwachtBundle),bootstrapNaam=path.basename(verwachtBootstrap);
assert.equal(tel(sw,appNaam),1,"serviceworker-precache moet de actuele app-bundle exact één keer noemen");
assert.equal(tel(sw,bootstrapNaam),1,"serviceworker-precache moet de actuele bootstrap exact één keer noemen");
assert(![...sw.matchAll(/app-[0-9a-f]{12}\.min\.js/g)].some(m=>m[0]!==appNaam),"serviceworker mag geen oude app-generatie noemen");
assert(![...sw.matchAll(/bootstrap-[0-9a-f]{12}\.min\.js/g)].some(m=>m[0]!==bootstrapNaam),"serviceworker mag geen oude bootstrap-generatie noemen");

const bundel=fs.readFileSync(bundlePad,"utf8");
for(const marker of ["weathernow:app-ready","AbortController","laadTeller","zoekGeneratie"])
  assert(bundel.includes(marker),`Actieve hoofdclient mist release-/race-invariant: ${marker}`);
const bootstrapBron=fs.readFileSync(bootstrapPad,"utf8");
assert(bootstrapBron.includes("12000"),"bootstrap-watchdog moet de afgesproken 12s timeout bevatten");
assert(!bootstrapBron.includes("30000"),"oude 30s watchdogtimeout mag niet meer actief zijn");

console.log(`Release-bundleconsistentie geslaagd: ${scenarios.length} weather-routes delen build ${verwachtBuild}, ${verwachtBundle} en ${verwachtBootstrap}; SW, BFCache-freshnessowner en hashed assets zijn generatieconsistent.`);