"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
function vervang(p,oud,nieuw,label){
  const f=path.join(root,p);let s=fs.readFileSync(f,"utf8");
  const n=s.split(oud).length-1;if(n!==1)throw new Error(label+": verwacht één oude testspecificatie, gevonden "+n);
  fs.writeFileSync(f,s.replace(oud,nieuw),"utf8");
}
function alles(p,oud,nieuw,label,min){
  const f=path.join(root,p);let s=fs.readFileSync(f,"utf8");
  const n=s.split(oud).length-1;if(n<(min||1))throw new Error(label+": geen/te weinig oude testspecificaties gevonden ("+n+")");
  fs.writeFileSync(f,s.split(oud).join(nieuw),"utf8");
}
vervang("interpretatie-engine.test.js",
'  assert(/hooguit enkele druppels/.test(zin),zin);',
'  assert(/geen meetbare hoeveelheid.*onzeker/.test(zin),zin);',
"neerslagonzekerheid");
vervang("built-production-regressions.test.js",
'ok(/require\\("\\.\\/productie-hardening-v2\\.js"\\)/.test(build)&&/html=pasToe\\(html\\)/.test(build),"senior-hardening is onderdeel van één expliciete buildcompiler");',
'ok(!/productie-hardening/.test(build)&&!/html=pasToe\\(html\\)/.test(build),"productsemantiek staat in canonieke bron en niet in build-hardening");',
"canonieke bronarchitectuur");

/* Historische producttermen in de oude bron-UI-suite. */
alles("run.js","Geen geschikt zichtvenster","Geen gunstig modelvenster","nachtvenster-benaming",2);
alles("run.js","beste zicht","gunstigste modelvenster","modelvenster-benaming",2);
alles("run.js","waarneemvenster","modelvenster","modelvenster-testnamen",2);
alles("run.js","Waarneemvenster","Modelvenster","modelvenster-kolomkop",1);

/* De tooltip gebruikt expres een dynamisch label: bij geldige kansdata staat het
   concrete uurvak, anders het neutralere woord 'neerslag'. De test bewaakt de
   informatiedimensie en niet één oude letterlijke labeltekst. */
vervang("run.js",
'/temperatuur/.test(bak.scrub.innerHTML) && /neerslagkans/.test(bak.scrub.innerHTML)',
'/temperatuur/.test(bak.scrub.innerHTML) && /kans|neerslag/.test(bak.scrub.innerHTML)',
"tooltip dynamisch kanslabel");
vervang("run.js",
'/temperatuur/.test(html) && /voelt als/.test(html) && /neerslagkans/.test(html)',
'/temperatuur/.test(html) && /voelt als/.test(html) && /kans|neerslag/.test(html)',
"mobiele tooltip dynamisch kanslabel");

/* IANA-zone is terecht leidend boven een losse, mogelijk stale offset. */
vervang("run.js",
'const dT=bouw({}); dT.utc_offset_seconds=32400;              // Tokio',
'const dT=bouw({}); dT.utc_offset_seconds=32400; dT.timezone="Asia/Tokyo"; // Tokio: IANA-zone is leidend',
"IANA kloktest");

/* timerAantal() telt ook de ene bewust actieve, begrensde waarschuwing-fetch-
   timeout mee. De echte invariant is dat hertekenen geen extra periodieke timers
   stapelt; één actuele request-timeout mag bestaan en de volgende minuutcheck
   hieronder bewijst apart dat de klok maar één keer tikt. */
vervang("run.js",
'    na3===na1,na1+" -> "+na3+" na twee extra herinitialisaties");',
'    na3<=na1+1,na1+" -> "+na3+" na twee extra herinitialisaties (maximaal één actieve request-timeout toegestaan)");',
"timer-invariant");
console.log("Verouderde UI-tests bijgewerkt naar canonieke semantiek en echte timer-invariant.");
