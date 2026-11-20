"use strict";

/* Toetst de CI-bewaker tegen live Open-Meteo (scripts/ci/geen-live-openmeteo.cjs)
   in een apart Node-proces met NODE_OPTIONS, precies zoals in CI:
   - Node: fetch, dns.lookup, dns.promises.lookup en https.get naar
     (sub)domeinen van open-meteo.com worden geweigerd en vastgelegd; andere
     hosts (hier een lokale server) werken gewoon;
   - Playwright (Chromium): een route van de test zelf die Open-Meteo met een
     fixture beantwoordt, blijft werken en telt niet als poging; een verzoek
     zonder fixture en een route.continue() naar Open-Meteo bereiken het netwerk
     niet en worden vastgelegd;
   - de afsluitende controle faalt bij een poging en slaagt zonder. */

const assert=require("assert");
const fs=require("fs");
const os=require("os");
const path=require("path");
const {spawnSync}=require("child_process");

const BEWAKER=path.join(__dirname,"geen-live-openmeteo.cjs");
const CONTROLE=path.join(__dirname,"geen-live-openmeteo-controle.js");
const PW=require.resolve("playwright");
const VIND=path.join(__dirname,"..","vind-browser.js");
const map=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-geen-om-"));

function draai(code,log,extraEnv={}){
  const bestand=path.join(map,"proef-"+Math.random().toString(36).slice(2)+".js");
  fs.writeFileSync(bestand,code);
  const r=spawnSync(process.execPath,[bestand],{cwd:path.join(__dirname,"..",".."),encoding:"utf8",timeout:120000,
    env:{...process.env,NODE_OPTIONS:`--require ${BEWAKER}`,GEEN_LIVE_OPENMETEO_LOG:log,...extraEnv}});
  return r;
}
const regels=log=>fs.existsSync(log)?fs.readFileSync(log,"utf8").split("\n").filter(Boolean).map(r=>JSON.parse(r)):[];

/* 1. Node-kanalen. */
{
  const log=path.join(map,"node.jsonl");
  const r=draai(`
const http=require("http"),https=require("https"),dns=require("dns");
(async()=>{
  const uit={};
  try{await fetch("https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2");uit.fetch="bereikt";}catch(e){uit.fetch=e.cause&&e.cause.code;}
  try{await fetch(new URL("https://geocoding-api.open-meteo.com/v1/search?name=x"));uit.fetchUrl="bereikt";}catch(e){uit.fetchUrl=e.cause&&e.cause.code;}
  uit.dns=await new Promise(r=>dns.lookup("air-quality-api.open-meteo.com",(e)=>r(e&&e.code)));
  try{await dns.promises.lookup("historical-forecast-api.open-meteo.com");uit.dnsp="bereikt";}catch(e){uit.dnsp=e.code;}
  try{https.get("https://customer-api.open-meteo.com/v1/forecast");uit.https="bereikt";}catch(e){uit.https=e.code;}
  try{https.get({hostname:"open-meteo.com",path:"/"});uit.httpsOpties="bereikt";}catch(e){uit.httpsOpties=e.code;}
  /* Andere hosts blijven werken. */
  const s=http.createServer((q,a)=>a.end("ok"));await new Promise(r=>s.listen(0,"127.0.0.1",r));
  uit.lokaal=await (await fetch("http://127.0.0.1:"+s.address().port+"/")).text();
  uit.lokaalDns=await new Promise(r=>dns.lookup("localhost",(e,a)=>r(e?e.code:"ok")));
  s.close();
  /* Lijkt op Open-Meteo maar is het niet. */
  uit.lijkt=await new Promise(r=>dns.lookup("api.open-meteo.com.evil.invalid",(e)=>r(e?e.code:"ok")));
  console.log(JSON.stringify(uit));
})();`,log);
  assert.equal(r.status,0,r.stderr);
  const uit=JSON.parse(r.stdout.trim().split("\n").pop());
  assert.deepEqual(uit,{fetch:"ENOTFOUND",fetchUrl:"ENOTFOUND",dns:"ENOTFOUND",dnsp:"ENOTFOUND",https:"ENOTFOUND",httpsOpties:"ENOTFOUND",lokaal:"ok",lokaalDns:"ok",lijkt:uit.lijkt},"Node-kanalen: "+JSON.stringify(uit));
  assert.notEqual(uit.lijkt,undefined);
  const l=regels(log);
  assert.equal(l.length,6,"zes geblokkeerde pogingen vastgelegd: "+JSON.stringify(l));
  assert(l.every(x=>/open-meteo\.com/.test(x.doel)&&x.script),"logregels noemen doel en script");
  assert(!l.some(x=>/evil\.invalid|127\.0\.0\.1|localhost/.test(x.doel)),"andere hosts niet als poging vastgelegd");
  assert.equal(spawnSync(process.execPath,[CONTROLE,log],{encoding:"utf8",env:{...process.env,NODE_OPTIONS:""}}).status,1,"controle faalt bij pogingen");
}

/* 2. Strenge modus: het proces zelf faalt, ook als de test de fout wegvangt. */
{
  const log=path.join(map,"streng.jsonl");
  const r=draai(`fetch("https://api.open-meteo.com/v1/forecast").catch(()=>{});`,log,{GEEN_LIVE_OPENMETEO:"streng"});
  assert.equal(r.status,1,"strenge modus: exitcode 1 bij een weggevangen poging");
  const leeg=path.join(map,"leeg.jsonl");
  const r2=draai(`console.log("niets");`,leeg,{GEEN_LIVE_OPENMETEO:"streng"});
  assert.equal(r2.status,0,"strenge modus: exitcode 0 zonder poging");
  assert.equal(spawnSync(process.execPath,[CONTROLE,leeg],{encoding:"utf8",env:{...process.env,NODE_OPTIONS:""}}).status,0,"controle slaagt zonder pogingen");
}

/* 3. Playwright. */
{
  const log=path.join(map,"browser.jsonl");
  const r=draai(`
const http=require("http");const {chromium}=require(${JSON.stringify(PW)});
(async()=>{
  const s=http.createServer((q,a)=>{a.setHeader("content-type","text/html");a.end("<!doctype html><title>t</title>");});
  await new Promise(r=>s.listen(0,"127.0.0.1",r));const root="http://127.0.0.1:"+s.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require(${JSON.stringify(VIND)}).vindBrowser()||undefined});
  const uit={};
  /* a. fixture van de test zelf */
  const c1=await browser.newContext();const p1=await c1.newPage();
  await p1.route("https://api.open-meteo.com/**",r=>r.fulfill({json:{timezone:"GMT"}}));
  await p1.goto(root+"/");
  uit.fixture=await p1.evaluate(async()=>{try{return (await (await fetch("https://api.open-meteo.com/v1/forecast?x=1")).json()).timezone;}catch(e){return "fout";}});
  /* b. zonder fixture */
  uit.zonder=await p1.evaluate(async()=>{try{await fetch("https://geocoding-api.open-meteo.com/v1/search?name=a");return "bereikt";}catch(e){return "fout";}});
  await c1.close();
  /* c. route.continue() naar Open-Meteo (newPage zonder eigen context) */
  const p2=await browser.newPage();
  await p2.route("**/*",r=>r.continue());
  await p2.goto(root+"/");
  uit.verder=await p2.evaluate(async()=>{try{await fetch("https://air-quality-api.open-meteo.com/v1/air-quality?x=1");return "bereikt";}catch(e){return "fout";}});
  await p2.close();
  await browser.close();s.close();
  console.log(JSON.stringify(uit));
})().catch(e=>{console.error(e);process.exit(1);});`,log);
  assert.equal(r.status,0,r.stderr);
  const uit=JSON.parse(r.stdout.trim().split("\n").pop());
  assert.deepEqual(uit,{fixture:"GMT",zonder:"fout",verder:"fout"},"Playwright: "+JSON.stringify(uit));
  const l=regels(log);
  assert(l.some(x=>/geocoding-api\.open-meteo\.com/.test(x.doel)),"verzoek zonder fixture vastgelegd: "+JSON.stringify(l));
  assert(l.some(x=>/air-quality-api\.open-meteo\.com/.test(x.doel)),"route.continue naar Open-Meteo vastgelegd: "+JSON.stringify(l));
  assert(!l.some(x=>/api\.open-meteo\.com\/v1\/forecast\?x=1/.test(x.doel)),"fixture van de test telt niet als poging");
}

/* 4. Workflows: iedere job die bouwt, test of een browser start, laadt de bewaker direct na de checkout en
   eindigt met de controle; geen workflow roept Open-Meteo (of een script dat Open-Meteo live aanroept) aan.
   Bewuste uitzondering, ter beslissing van de eigenaar: KNMI modelverificatie (kwartaal en handmatig) vergelijkt
   historische modeldata van Open-Meteo met KNMI-metingen; dat kan per definitie niet met een fixture. */
{
  const WF=path.join(__dirname,"..","..",".github","workflows");
  const UITZONDERING=new Set(["knmi-modelverificatie.yml"]);
  const LIVE_SCRIPTS=/openmeteo-daggrens-contract\.js|knmi-modelverificatie\.js(?!\S*test)/;
  const ZONDER_OPENMETEO=new Set(["cloudflare-web-analytics.yml","cloudflare-human-analytics-report.yml","meteoalarm-gebieden.yml","meteoalarm-verkenning.yml","sec06-a2-access-bewijs.yml"]);
  let jobsGeteld=0;
  for(const naam of fs.readdirSync(WF).filter(n=>/\.ya?ml$/.test(n))){
    const tekst=fs.readFileSync(path.join(WF,naam),"utf8");
    const zonderCommentaar=tekst.split("\n").filter(l=>!/^\s*#/.test(l)).join("\n");
    if(UITZONDERING.has(naam))continue;
    assert(!/open-meteo\.com/.test(zonderCommentaar),naam+": noemt een Open-Meteo-host");
    assert(!LIVE_SCRIPTS.test(zonderCommentaar),naam+": draait een script dat Open-Meteo live aanroept");
    if(ZONDER_OPENMETEO.has(naam))continue;
    const delen=zonderCommentaar.split(/\n(?=  [A-Za-z0-9_-]+:\s*\n)/).slice(1);
    for(const job of delen){
      const jobNaam=job.trim().split(":")[0];
      const bouwt=/npm (test|run build|ci)\b|node \S*(browser|test|smoke|readiness|recovery|run-fase)\S*\.js/.test(job);
      if(!bouwt)continue;
      if(naam==="cloudflare-preview-deploy.yml"&&jobNaam==="preview")continue; /* deploy van een gevalideerde bundel, geen build of browser; scripts benaderen alleen de eigen preview */
      jobsGeteld++;
      if(naam==="cloudflare-production.yml"&&jobNaam==="deploy-production"){
        /* Job met productiesecrets: de bewaker staat alleen op de buildstap, de controle direct daarna. */
        const bouw=job.slice(job.indexOf("- name: Bouw Cloudflare productie-artifact"));
        assert(/NODE_OPTIONS: --require \$\{\{ github\.workspace \}\}\/scripts\/ci\/geen-live-openmeteo\.cjs/.test(bouw.slice(0,bouw.indexOf("run: npm run build:cloudflare"))),naam+": buildstap zonder bewaker");
        assert(job.includes("- name: Controle geen live Open-Meteo tijdens de build"),naam+": controle na de build ontbreekt");
        continue;
      }
      const checkout=job.indexOf("actions/checkout@"),bewaker=job.indexOf("- name: Bewaker tegen live Open-Meteo"),controle=job.lastIndexOf("- name: Controle geen live Open-Meteo");
      assert(checkout>=0&&bewaker>checkout,naam+"/"+jobNaam+": bewaker ontbreekt of staat vóór de checkout");
      assert(job.includes('echo "NODE_OPTIONS=--require $GITHUB_WORKSPACE/scripts/ci/geen-live-openmeteo.cjs" >> "$GITHUB_ENV"'),naam+"/"+jobNaam+": NODE_OPTIONS niet gezet");
      const naBewaker=job.slice(bewaker+10),volgendeStap=naBewaker.indexOf("\n      - ");
      const stappenNaControle=job.slice(controle).split("\n      - ").length-1;
      assert(controle>bewaker&&stappenNaControle===0,naam+"/"+jobNaam+": controle is niet de laatste stap");
      assert(/if: always\(\)\n\s+run: NODE_OPTIONS= node scripts\/ci\/geen-live-openmeteo-controle\.js/.test(job.slice(controle)),naam+"/"+jobNaam+": controle draait niet altijd");
      assert(volgendeStap>0,naam+"/"+jobNaam+": bewaker zonder vervolgstappen");
    }
  }
  assert(jobsGeteld>=25,"te weinig CI-jobs gecontroleerd: "+jobsGeteld);
}

fs.rmSync(map,{recursive:true,force:true});
console.log("Bewaker geen live Open-Meteo: Node (fetch, DNS, https) en Playwright (zonder fixture, route.continue) geblokkeerd en vastgelegd; fixtures en andere hosts ongemoeid; controle faalt bij een poging; iedere bouw-, test- en browserjob in de workflows laadt de bewaker en geen workflow roept Open-Meteo live aan (uitzondering ter beslissing: KNMI modelverificatie).");
