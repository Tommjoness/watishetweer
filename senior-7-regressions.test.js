"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path"),{pathToFileURL}=require("url");
const R=__dirname,lees=p=>fs.readFileSync(path.join(R,p),"utf8");
let n=0;const ok=(c,m)=>{assert.ok(c,m);n++;console.log("OK  "+m);};
const index=lees("index.html"),engine=lees("interpretatie-engine.js"),build=lees("build-weather.js"),waars=lees("lib/waarschuwingen.cjs");
ok(!/productie-hardening/.test(build),"build verandert geen productsemantiek meer");
ok(!fs.existsSync(path.join(R,"productie-hardening-v2.js")),"oude semantische hardeninglaag is verwijderd");
ok(engine.includes("hoeveelheid onzeker")&&index.includes("117.000001"),"eerdere senior-fixes staan in canonieke bron");
ok(index.includes("luchtBelofte")&&!index.includes("Promise.allSettled([j(f),j(a)])"),"luchtkwaliteit blokkeert kernweer niet meer");
ok(index.includes("item.precipitation*item.fractie"),"gedeeltelijk verstreken kwartier wordt proportioneel verwerkt");
ok(index.includes("analyseerNeerslagData(S.d,120,weatherNowActueleLokaleTijd())"),"nowcast start op echte lokale minuut");
ok(index.includes("Komend uur")&&engine.includes("de komende circa 60 minuten"),"uurkans vermijdt schijnprecisie");
ok(waars.includes("niveauIsOfficieel: false")&&waars.includes("niveauIsOfficieel: true"),"NWS-kleur wordt onderscheiden van officiële MeteoAlarm-kleur");
ok(engine.includes('w.niveauIsOfficieel===false'),"briefing noemt NWS-kleur niet officieel");
(async()=>{
  const oud=global.fetch;
  global.fetch=async url=>({ok:true,json:async()=>({address:{city:"Teststad"}}),text:async()=>""});
  try{
    const mod=await import(pathToFileURL(path.join(R,"api/plaatsnaam.mjs")).href+"?t="+Date.now());
    const r=await mod.default.fetch(new Request("https://example.test/api/plaatsnaam?lat=52.37&lon=4.90"));
    ok(r.headers.get("vercel-cdn-cache-control")==="s-maxage=86400, stale-while-revalidate=604800","plaatsnaam zet expliciete Vercel-CDN TTL");
    ok(r.headers.get("cache-control")==="public, max-age=0, must-revalidate","browser cachet dynamische plaatsnaam niet langdurig");
  }finally{global.fetch=oud;}
  console.log("Senior-7 regressies: "+n+" controles geslaagd.");
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
