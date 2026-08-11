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
ok(/fetch\(e\.request\)\.catch\(\(\) => caches\.match\(e\.request\)/.test(sw),"navigatie blijft netwerk-eerst met install-cache als offline fallback");

const gebouwd=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
ok(gebouwd.includes("S.actieveWaarschuwingen=[];"),"waarschuwingen van een vorige locatie worden direct gewist");
ok(gebouwd.includes("mijnBeurt!==waarschuwingTeller"),"een verouderd waarschuwingantwoord kan de nieuwe plaats niet overschrijven");
ok(gebouwd.includes("Officiële weerwaarschuwingen konden niet worden gecontroleerd."),"onbereikbare waarschuwingbron blijft niet stil");
ok(gebouwd.includes("zijn voor deze locatie niet beschikbaar"),"ontbrekende werelddekking wordt eerlijk gemeld");
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
    status(code){this.statusCode=code;return this;},
    json(body){this.body=body;return this;}
  };
}

async function roepWaarschuwingen(query,fetchImpl){
  const oud=global.fetch;
  const modulePad=require.resolve("./lib/waarschuwingen.cjs");
  delete require.cache[modulePad];
  global.fetch=fetchImpl;
  try{
    const handler=require(modulePad);
    const res=nepResponse();
    await handler({query},res);
    return res;
  }finally{
    global.fetch=oud;
    delete require.cache[modulePad];
  }
}

(async()=>{
  const nws=await roepWaarschuwingen(
    {lat:"40.7128",lon:"-74.0060"},
    async()=>({ok:true,json:async()=>({features:[]})})
  );
  ok(nws.statusCode===200,"NWS lege waarschuwingenlijst is geen serverfout");

  const nietGedekt=await roepWaarschuwingen(
    {lat:"35.6762",lon:"139.6503"},
    async()=>{throw new Error("mag niet worden aangeroepen");}
  );
  ok(nietGedekt.statusCode===200&&nietGedekt.body&&nietGedekt.body.dekking===false,"wereldlocatie zonder providerdekking wordt expliciet als niet gedekt gemeld");

  console.log("Audit-regressies geslaagd: "+geslaagd);
})().catch(err=>{console.error(err);process.exit(1);});
