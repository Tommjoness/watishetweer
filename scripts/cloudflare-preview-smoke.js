"use strict";

const assert=require("assert");

const ROOT=String(process.env.PREVIEW_ROOT||"").replace(/\/$/,"");
const EXPECTED_SHA=String(process.env.EXPECTED_SHA||"").trim();
if(!/^https:\/\/[a-z0-9-]+\.watishetweer\.pages\.dev$/i.test(ROOT))throw new Error("PREVIEW_ROOT ontbreekt of is geen watishetweer.pages.dev-preview.");
if(!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA))throw new Error("EXPECTED_SHA ontbreekt of is geen volledige commit-SHA.");

const timeoutMs=20000;
async function request(path,options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(ROOT+path,{redirect:"manual",...options,signal:controller.signal});}
  finally{clearTimeout(timer);}
}
async function json(path,options={}){
  const r=await request(path,options);
  const text=await r.text();
  let body=null;
  try{body=text?JSON.parse(text):null;}catch{throw new Error(`${path}: geen geldige JSON (HTTP ${r.status})`);}
  return {r,body,text};
}
function buildSha(html){return /<meta name="weather-build-sha" content="([0-9a-f]+)">/i.exec(String(html||""))?.[1]||"";}
function security(r,label){
  assert.equal(r.headers.get("x-content-type-options"),"nosniff",`${label}: nosniff ontbreekt`);
  assert.equal(r.headers.get("x-frame-options"),"DENY",`${label}: framing niet geblokkeerd`);
  assert.equal(r.headers.get("referrer-policy"),"strict-origin-when-cross-origin",`${label}: referrer-policy wijkt af`);
  assert(/default-src 'self'/.test(r.headers.get("content-security-policy")||""),`${label}: CSP ontbreekt`);
}

(async()=>{
  const home=await request("/");
  assert.equal(home.status,200,"homepage is niet 200");
  security(home,"homepage");
  const homeHtml=await home.text();
  assert.equal(buildSha(homeHtml),EXPECTED_SHA,"homepage bevat niet de exacte branch-head SHA");

  const route=await request("/weer/almere/");
  assert.equal(route.status,200,"SEO-route Almere is niet 200");
  security(route,"SEO-route");
  assert.equal(buildSha(await route.text()),EXPECTED_SHA,"SEO-route bevat niet de exacte branch-head SHA");

  const ontbreekt=await request("/__cloudflare_preview_onbestaand__");
  assert.equal(ontbreekt.status,404,"onbekende route is geen 404");

  const plaats=await json("/api/plaatsnaam?lat=52.3508&lon=5.2647");
  assert.equal(plaats.r.status,200,"plaatsnaam-API is niet 200");
  security(plaats.r,"plaatsnaam-API");
  assert(plaats.body&&typeof plaats.body==="object","plaatsnaam-API heeft geen objectpayload");
  assert("naam" in plaats.body&&"land" in plaats.body,"plaatsnaam-API mist contractvelden");

  const neerslag=await json("/api/neerslag?lat=52.3508&lon=5.2647&land=NL");
  assert.equal(neerslag.r.status,200,"neerslag-API is niet 200");
  security(neerslag.r,"neerslag-API");
  assert(neerslag.body&&typeof neerslag.body.beschikbaar==="boolean","neerslag-API mist beschikbaar-boolean");

  const waarschuwingen=await json("/api/waarschuwingen?lat=52.3508&lon=5.2647&land=NL");
  assert.equal(waarschuwingen.r.status,200,"waarschuwingen-API is niet 200");
  security(waarschuwingen.r,"waarschuwingen-API");
  assert(waarschuwingen.body&&typeof waarschuwingen.body.dekking==="boolean","waarschuwingen-API mist dekking-boolean");
  assert(Array.isArray(waarschuwingen.body.lijst),"waarschuwingen-API mist lijst-array");

  const post=await json("/api/plaatsnaam?lat=52.3508&lon=5.2647",{method:"POST"});
  assert.equal(post.r.status,405,"POST op plaatsnaam-API is niet 405");
  assert.equal(post.r.headers.get("allow"),"GET, HEAD","405 mist correcte Allow-header");
  assert(/no-store/i.test(post.r.headers.get("cache-control")||""),"405 mag niet publiek gecachet worden");

  const ongeldig=await json("/api/neerslag?lat=abc&lon=5.2647&land=NL");
  assert.equal(ongeldig.r.status,400,"ongeldige neerslagcoördinaten zijn niet 400");
  assert(/no-store/i.test(ongeldig.r.headers.get("cache-control")||""),"400 mag niet publiek gecachet worden");

  const head=await request("/api/plaatsnaam?lat=52.3508&lon=5.2647",{method:"HEAD"});
  assert.equal(head.status,200,"HEAD op plaatsnaam-API is niet 200");
  assert.equal((await head.text()).length,0,"HEAD bevat onverwacht een responsebody");

  console.log(`CLOUDFLARE PREVIEW SMOKE GESLAAGD: ${ROOT}; SHA ${EXPECTED_SHA}; statisch, security en drie API-contracten groen.`);
})().catch(error=>{console.error(error&&error.stack||error);process.exit(1);});
