"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const ROOT=__dirname;
const PUBLIC=path.join(ROOT,"public");
let geslaagd=0;

function ok(voorwaarde,naam){
  assert.ok(voorwaarde,naam);
  geslaagd++;
  console.log("OK  "+naam);
}

/* Productie-uitvoer: interne test- en bouwbestanden mogen nooit publiek staan. */
const publiekeBestanden=fs.readdirSync(PUBLIC);
const internPubliek=publiekeBestanden.filter(naam=>
  naam.endsWith(".test.js") ||
  ["run.js","run-built-matrix.js","kern.js","data.js","build-weather.js","interpretatie-engine.js","senior-correctness-v2.js","product-config.js"].includes(naam)
);
ok(internPubliek.length===0,"geen interne test- of bouwbestanden in public");

const sw=fs.readFileSync(path.join(PUBLIC,"sw.js"),"utf8");
ok(/const CACHE = "watishetweer-[0-9a-f]{12}";/.test(sw),"serviceworker-cache volgt de gebouwde inhoudshash");
ok(!/(?:weerbriefing|watishetweer)-v\d+/.test(sw),"geen handmatig vast cacheversienummer in productie");
ok((sw.match(/caches\.open\(CACHE\)/g)||[]).length===1,"serviceworker opent de generatiecache uitsluitend tijdens install");
ok(!/CACHE_HANDLE/.test(sw),"serviceworker houdt geen generatiecachehandle vast na install");
ok(!/\.put\(e\.request/.test(sw),"oude serviceworker kan zijn verwijderde generatiecache niet via runtime-write terugbrengen");
ok(!/setTimeout\(resolve,\s*\d+\)/.test(sw),"serviceworker-upgrade steunt niet op een tijdgebaseerde activate-uitlooptijd");
ok(/const uitHuidigeCache = request => caches\.match\(request,\{cacheName:CACHE\}\);/.test(sw),"offline cachelookup is expliciet tot de huidige worker-generatie beperkt");
ok(!/caches\.match\([^,\n]+\)(?:\.|\s)/.test(sw),"serviceworker gebruikt geen globale onbegrensde CacheStorage-match voor shellfallbacks");
ok(/fetch\(e\.request\)\.catch\(\(\) => uitHuidigeCache\(e\.request\)/.test(sw),"navigatie blijft netwerk-eerst met huidige install-cache als offline fallback");

const gebouwd=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
ok(gebouwd.includes("S.actieveWaarschuwingen=[];"),"waarschuwingen van een vorige locatie worden direct gewist");
ok(gebouwd.includes("mijnBeurt!==waarschuwingTeller"),"een verouderd waarschuwingantwoord kan de nieuwe plaats niet overschrijven");
ok(gebouwd.includes("Officiële weerwaarschuwingen konden tijdelijk niet worden opgehaald."),"onbereikbare waarschuwingbron blijft niet stil");
ok(gebouwd.includes("Voor deze locatie kunnen we geen officiële weerwaarschuwingen tonen."),"ontbrekende werelddekking wordt eerlijk gemeld");
ok(gebouwd.includes("const rondGetal="),"temperatuurweergaven blokkeren null als kunstmatige nul");
ok(gebouwd.includes('const scheiding="<!--brief-rest-->"'),"centrale neerslaglaag bewaart de rest van de briefing structureel");
ok(gebouwd.includes("laterVandaagNeerslag(S.d,twee)"),"centrale briefing vat ook de uren na het twee-uursvenster samen");
ok(gebouwd.includes('classList.contains("kop")'),"weekinterpretatie slaat de tabelkop over");
ok(gebouwd.includes('const morgenDagMax=')&&gebouwd.includes('morgenDagMax')&&gebouwd.includes('plaatsDelen.hour>=18'),"temperatuurbriefing scheidt de kalenderdagen en noemt morgen niet voortijdig");
ok(gebouwd.includes('el.classList.add("aq-cols-1")'),"ontbrekende luchtkwaliteitsdata gebruikt een volle lege-statusrij");
ok(gebouwd.includes("#suntimes .zondag")&&gebouwd.includes("Zonsopkomst ")&&gebouwd.includes("Zonsondergang "),"zonmomenten tonen de dag als eigen hiërarchische kop boven op- en ondergang");

const vercel=JSON.parse(fs.readFileSync(path.join(ROOT,"vercel.json"),"utf8"));
const headers=(vercel.headers&&vercel.headers[0]&&vercel.headers[0].headers)||[];
const headerMap=Object.fromEntries(headers.map(h=>[String(h.key).toLowerCase(),h.value]));
ok(headerMap["x-content-type-options"]==="nosniff","nosniff-header staat aan");
ok(headerMap["x-frame-options"]==="DENY","framing is geblokkeerd");
ok(/geolocation=\(self\)/.test(headerMap["permissions-policy"]||""),"locatiebevoegdheid is tot de eigen site beperkt");

function nepResponse(){
  return {
    statusCode:200,
    headers:{},
    body:null,
    setHeader(k,v){this.headers[String(k).toLowerCase()]=v;},
    end(v){this.body=v;}
  };
}

async function apiRoute(pad,query){
  const handler=require(path.join(ROOT,pad));
  const req={method:"GET",query:query||{}};
  const res=nepResponse();
  await handler(req,res);
  return res;
}

(async()=>{
  const r=await apiRoute("api/plaatsnaam.js",{lat:"niet-een-getal",lon:"5"});
  ok(r.statusCode===400,"plaatsnaam-API weigert ongeldige coördinaten vóór extern verzoek");
  ok(/private, no-store/.test(r.headers["cache-control"]||""),"plaatsnaam-API responses zijn niet publiek cachebaar");
  console.log("Audit-regressies geslaagd: "+geslaagd+" checks.");
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
