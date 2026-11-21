"use strict";

/* Geen live Open-Meteo vanuit CI (P0, 20 november 2026).

   Open-Meteo blokkeert en beperkt IP-adressen agressief bij misbruik en vraagt
   uitdrukkelijk om in CI mocktests te gebruiken in plaats van live API-aanroepen
   (Patrick Zippenfenig, ticket #235915). GitHub-runners delen hun IP-adressen.

   Dit bestand wordt via NODE_OPTIONS="--require <pad>/scripts/ci/geen-live-openmeteo.cjs"
   in iedere Node-opdracht van een CI-job geladen en doet twee dingen:
   1. Blokkeren. Een verbinding met open-meteo.com of een subdomein lukt niet:
      - Node: dns.lookup/dns.promises.lookup, globale fetch en http(s).request/get
        weigeren die hosts (ENOTFOUND), dus ook via undici, retries en reserve-
        routes binnen het testproces;
      - Playwright: Chromium start met een resolverregel die *.open-meteo.com niet
        laat opzoeken, en iedere context krijgt als laagste route een vangnet dat
        een verzoek naar Open-Meteo afbreekt. Routes van de test zelf gaan voor,
        dus bestaande fixtures (page.route/context.route met fulfill) werken
        ongewijzigd; alleen wat anders echt het netwerk op zou gaan, stopt hier.
   2. Vastleggen. Iedere geblokkeerde poging komt als JSON-regel in het logbestand
      (GEEN_LIVE_OPENMETEO_LOG, standaard <tmp>/geen-live-openmeteo.jsonl). Een
      afsluitende stap (node scripts/ci/geen-live-openmeteo-controle.js) laat de job falen
      zodra er één poging in staat, ook als een test die fout zelf heeft
      weggevangen. Met GEEN_LIVE_OPENMETEO=streng faalt bovendien het proces zelf.

   Netwerkdiagnostiek van Open-Meteo hoort niet in CI; echte beschikbaarheid wordt
   buiten GitHub Actions bewaakt (docs/open-meteo-monitoring.md). */

const fs=require("fs");
const os=require("os");
const path=require("path");

const HOST=/(^|\.)open-meteo\.com\.?$/i;
const LOG=process.env.GEEN_LIVE_OPENMETEO_LOG||path.join(os.tmpdir(),"geen-live-openmeteo.jsonl");
const STRENG=process.env.GEEN_LIVE_OPENMETEO==="streng";
const RESOLVER="--host-resolver-rules=MAP open-meteo.com ~NOTFOUND, MAP *.open-meteo.com ~NOTFOUND";
const KENMERK=Symbol.for("wiw.geenLiveOpenMeteo");

function isOpenMeteo(host){return typeof host==="string"&&HOST.test(host.trim().replace(/^\[|\]$/g,""));}
function hostVan(invoer){
  try{
    if(invoer==null)return "";
    if(typeof invoer==="string")return new URL(invoer).hostname;
    if(invoer instanceof URL)return invoer.hostname;
    if(typeof invoer.url==="string")return new URL(invoer.url).hostname;
    if(typeof invoer.hostname==="string")return invoer.hostname;
    if(typeof invoer.host==="string")return invoer.host.split(":")[0];
  }catch(e){}
  return "";
}
let aantal=0;
function leg(kanaal,doel){
  aantal++;
  const regel={tijd:new Date().toISOString(),script:path.relative(process.cwd(),process.argv[1]||"")||process.argv[1]||"",pid:process.pid,kanaal,doel:String(doel).slice(0,300)};
  try{fs.appendFileSync(LOG,JSON.stringify(regel)+"\n");}catch(e){}
  try{process.stderr.write(`[geen-live-openmeteo] geblokkeerd (${kanaal}): ${regel.doel}\n`);}catch(e){}
}
function weigerFout(host){
  const e=new Error(`getaddrinfo ENOTFOUND ${host} (live Open-Meteo is in CI geblokkeerd; gebruik een fixture)`);
  e.code="ENOTFOUND";e.errno=-3008;e.syscall="getaddrinfo";e.hostname=host;
  return e;
}

function installeerNode(){
  const dns=require("dns");
  if(dns[KENMERK])return;
  dns[KENMERK]=true;
  const lookup=dns.lookup;
  dns.lookup=function(host,opties,cb){
    if(isOpenMeteo(host)){
      leg("dns",host);
      const terug=typeof opties==="function"?opties:cb;
      process.nextTick(()=>terug(weigerFout(host)));
      return {};
    }
    return lookup.apply(this,arguments);
  };
  if(dns.promises&&dns.promises.lookup){
    const pl=dns.promises.lookup;
    dns.promises.lookup=function(host){
      if(isOpenMeteo(host)){leg("dns",host);return Promise.reject(weigerFout(host));}
      return pl.apply(this,arguments);
    };
  }
  for(const naam of ["http","https"]){
    const mod=require(naam);
    for(const fn of ["request","get"]){
      const orig=mod[fn];
      mod[fn]=function(a,b){
        const host=hostVan(a)||(b&&typeof b==="object"?hostVan(b):"");
        if(isOpenMeteo(host)){leg(naam+"."+fn,typeof a==="string"||a instanceof URL?String(a):host);throw weigerFout(host);}
        return orig.apply(this,arguments);
      };
    }
  }
  if(typeof globalThis.fetch==="function"){
    const f=globalThis.fetch;
    globalThis.fetch=function(invoer){
      const host=hostVan(invoer);
      if(isOpenMeteo(host)){
        const url=typeof invoer==="string"?invoer:invoer instanceof URL?invoer.href:(invoer&&invoer.url)||host;
        leg("fetch",url);
        const e=new TypeError("fetch failed");e.cause=weigerFout(host);
        return Promise.reject(e);
      }
      return f.apply(this,arguments);
    };
  }
}

/* Playwright: vangnet in iedere context, resolverregel in Chromium. */
const ROUTE=/^[a-z]+:\/\/([^/?#]+\.)?open-meteo\.com(:\d+)?([/?#]|$)/i;
async function beveiligContext(context){
  if(!context||context[KENMERK])return context;
  context[KENMERK]=true;
  try{
    await context.route(ROUTE,route=>{leg("browser",route.request().url());return route.abort("blockedbyclient");});
    /* Wat toch het netwerk op ging (route.continue() van een test, of een andere
       browser): een netwerkfout (DNS door de resolverregel, of tunnel/proxy/
       verbinding/TLS achter een proxy) of een antwoord van een echte server.
       Afbreken door een test (ERR_FAILED, ERR_TIMED_OUT) en fixtures (geen
       serveradres) tellen niet. */
    const host=req=>{try{return new URL(req.url()).hostname;}catch(e){return "";}};
    context.on("requestfailed",req=>{
      const fout=(req.failure()&&req.failure().errorText)||"";
      if(isOpenMeteo(host(req))&&/NAME_NOT_RESOLVED|TUNNEL|PROXY|CONNECTION_(REFUSED|RESET|CLOSED|FAILED|TIMED_OUT)|ADDRESS_UNREACHABLE|INTERNET_DISCONNECTED|SSL|CERT/.test(fout))leg("browser-netwerk",req.url()+" ("+fout+")");
    });
    context.on("requestfinished",async req=>{
      if(!isOpenMeteo(host(req)))return;
      try{const r=await req.response();if(r&&await r.serverAddr())leg("browser-live-antwoord",req.url());}catch(e){}
    });
  }catch(e){}
  return context;
}
function beveiligBrowser(browser){
  if(!browser||browser[KENMERK])return browser;
  browser[KENMERK]=true;
  const nc=browser.newContext.bind(browser),np=browser.newPage.bind(browser);
  browser.newContext=async function(...a){return beveiligContext(await nc(...a));};
  browser.newPage=async function(...a){const p=await np(...a);await beveiligContext(p.context());return p;};
  return browser;
}
function metResolver(opties,type){
  if(type!=="chromium")return opties;
  const o=Object.assign({},opties);
  o.args=[...(o.args||[]),RESOLVER];
  return o;
}
function installeerPlaywright(pw){
  if(!pw||!pw.chromium)return;
  const proto=Object.getPrototypeOf(pw.chromium);
  if(!proto||proto[KENMERK])return;
  proto[KENMERK]=true;
  const launch=proto.launch,persistent=proto.launchPersistentContext;
  proto.launch=async function(opties){return beveiligBrowser(await launch.call(this,metResolver(opties,this.name())));};
  if(persistent)proto.launchPersistentContext=async function(map,opties){return beveiligContext(await persistent.call(this,map,metResolver(opties,this.name())));};
}

function installeer(){
  installeerNode();
  const Module=require("module");
  if(Module[KENMERK])return;
  Module[KENMERK]=true;
  const load=Module._load;
  Module._load=function(verzoek){
    const uit=load.apply(this,arguments);
    if(verzoek==="playwright"||verzoek==="playwright-core"||verzoek==="@playwright/test")installeerPlaywright(uit);
    return uit;
  };
  process.on("exit",code=>{if(STRENG&&aantal>0&&code===0)process.exitCode=1;});
}

function controleer(bestand=LOG){
  const regels=fs.existsSync(bestand)?fs.readFileSync(bestand,"utf8").split("\n").filter(Boolean):[];
  if(!regels.length){console.log(`Geen live Open-Meteo-poging vastgelegd (${bestand}).`);return 0;}
  console.error(`${regels.length} live Open-Meteo-poging(en) geblokkeerd in deze job:`);
  const per=new Map();
  for(const r of regels){try{const j=JSON.parse(r);const k=j.script+" ("+j.kanaal+")";per.set(k,(per.get(k)||0)+1);}catch(e){}}
  for(const [k,n] of per)console.error(`  ${n}× ${k}`);
  for(const r of regels.slice(0,20))console.error("  "+r);
  return 1;
}

installeer();

module.exports={isOpenMeteo,controleer,RESOLVER,LOG};
