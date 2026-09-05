"use strict";

const assert=require("assert");

const ROOT=(process.env.PRODUCTION_ROOT||"https://watishetweer.nl").replace(/\/+$/,"");
const EXPECTED_SHA=String(process.env.EXPECTED_SHA||"").trim();
const ATTEMPTS=Math.max(1,Number(process.env.RECOVERY_SMOKE_ATTEMPTS)||60);
const POLL_MS=Math.max(1000,Number(process.env.RECOVERY_SMOKE_POLL_MS)||5000);
const ROUTES=["/","/weer/amsterdam/","/weer/rotterdam/","/weer/utrecht/","/weer/groningen/"];
const APP_RE=/\/app-[0-9a-f]{12}\.min\.js/g;
const BOOTSTRAP_RE=/\/bootstrap-[0-9a-f]{12}\.min\.js/g;

function slaap(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function tekst(url){
  const r=await fetch(url,{headers:{"cache-control":"no-cache","pragma":"no-cache"}});
  if(!r.ok)throw new Error(`${url}: HTTP ${r.status}`);
  return await r.text();
}
function marker(html){return (/<meta name="weather-build-sha" content="([^"]+)">/.exec(html)||[])[1]||null;}
function uniekAsset(html,re,label,soort){
  const refs=[...html.matchAll(new RegExp(re.source,re.flags))].map(m=>m[0]);
  assert.equal(refs.length,1,`${label}: verwacht exact één ${soort}, gevonden ${refs.length}`);
  return refs[0];
}
function app(html,label){return uniekAsset(html,APP_RE,label,"app-bundle");}
function bootstrap(html,label){return uniekAsset(html,BOOTSTRAP_RE,label,"bootstrap-bundle");}
function canonical(html){return (/<link rel="canonical" href="([^"]+)">/.exec(html)||[])[1]||null;}

async function wachtOpSha(){
  let laatste=null;
  for(let poging=1;poging<=ATTEMPTS;poging++){
    try{
      const html=await tekst(ROOT+"/");
      laatste=marker(html);
      if(!EXPECTED_SHA||laatste===EXPECTED_SHA){
        const bundle=app(html,"/"),boot=bootstrap(html,"/");
        await Promise.all([tekst(ROOT+bundle),tekst(ROOT+boot)]);
        return html;
      }
    }catch(e){laatste=String(e&&e.message||e);}
    if(poging<ATTEMPTS)await slaap(POLL_MS);
  }
  throw new Error(`Productie bereikte verwachte SHA niet: verwacht ${EXPECTED_SHA||"(niet opgegeven)"}, laatst ${laatste}`);
}

(async()=>{
  await wachtOpSha();
  const rijen=[];let gedeeldeBundle=null,gedeeldeBootstrap=null,gedeeldeBuild=null;
  for(const route of ROUTES){
    const html=await tekst(ROOT+route);
    const build=marker(html),bundle=app(html,route),boot=bootstrap(html,route),canon=canonical(html);
    if(EXPECTED_SHA)assert.equal(build,EXPECTED_SHA,`${route}: buildmarker wijkt af van deployment-SHA`);
    if(gedeeldeBuild===null)gedeeldeBuild=build;else assert.equal(build,gedeeldeBuild,`${route}: buildmarker divergeert`);
    if(gedeeldeBundle===null)gedeeldeBundle=bundle;else assert.equal(bundle,gedeeldeBundle,`${route}: hoofdclient divergeert`);
    if(gedeeldeBootstrap===null)gedeeldeBootstrap=boot;else assert.equal(boot,gedeeldeBootstrap,`${route}: bootstrap divergeert`);
    assert(html.includes(`src="${boot}" defer data-weather-bootstrap`),`${route}: bootstrap is niet deferred/weather-bootstrap gemarkeerd`);
    assert(html.includes('id="weather-js-required"'),`${route}: noscript-herstel ontbreekt`);
    assert(html.includes('id="bootstrap-failure"'),`${route}: failed-JS-herstel ontbreekt`);
    assert(html.includes('id="weather-now-route"'),`${route}: route-data ontbreekt`);
    const verwachtCanonical=route==="/"?ROOT+"/":ROOT+route;
    assert.equal(canon,verwachtCanonical,`${route}: canonical wijkt af`);
    rijen.push({route,build,bundle,bootstrap:boot,canonical:canon});
  }

  const [bundleTekst,bootstrapTekst]=await Promise.all([tekst(ROOT+gedeeldeBundle),tekst(ROOT+gedeeldeBootstrap)]);
  for(const invariant of ["weathernow:app-ready","pageshow","AbortController","laadTeller","zoekGeneratie"]){
    assert(bundleTekst.includes(invariant),`actieve productieclient mist invariant ${invariant}`);
  }
  assert(bootstrapTekst.includes("12000"),"actieve productiebootstrap mist de 12s watchdogtimeout");
  assert(bootstrapTekst.includes("weathernow:app-ready"),"actieve productiebootstrap mist app-ready recovery");

  const sw=await tekst(ROOT+"/sw.js");
  const swApps=[...sw.matchAll(/app-[0-9a-f]{12}\.min\.js/g)].map(m=>m[0]);
  const swBoots=[...sw.matchAll(/bootstrap-[0-9a-f]{12}\.min\.js/g)].map(m=>m[0]);
  assert.equal(swApps.length,1,"productie-serviceworker moet exact één app-bundlereferentie bevatten");
  assert.equal(swBoots.length,1,"productie-serviceworker moet exact één bootstrap-bundlereferentie bevatten");
  assert.equal("/"+swApps[0],gedeeldeBundle,"productie-serviceworker moet de actieve gedeelde app-bundle precachen");
  assert.equal("/"+swBoots[0],gedeeldeBootstrap,"productie-serviceworker moet de actieve bootstrap-bundle precachen");
  assert(!sw.includes("app-a20fed4f8866.min.js")&&!sw.includes("app-5a8f2a31bd9d.min.js"),"oude baselinebundles mogen niet in de actuele serviceworker staan");

  console.log(JSON.stringify({ok:true,build:gedeeldeBuild,bundle:gedeeldeBundle,bootstrap:gedeeldeBootstrap,routes:rijen},null,2));
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
