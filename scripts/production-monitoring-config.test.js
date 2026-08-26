"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const workflow=fs.readFileSync(path.join(root,".github","workflows","production-smoke.yml"),"utf8");
const smoke=fs.readFileSync(path.join(root,"scripts","production-smoke.js"),"utf8");
const wereldwijd=fs.readFileSync(path.join(root,"scripts","production-worldwide-browser.js"),"utf8");

assert(/push:\s*\n\s*branches:\s*\[main\]/.test(workflow),"production-smoke moet na merges/pushes naar main draaien");
assert(/schedule:\s*\n\s*- cron: ["']\d+ \* \* \* \*["']/.test(workflow),"production-smoke moet ieder uur gepland staan");
assert(/workflow_dispatch:/.test(workflow),"production-smoke moet handmatig startbaar blijven");
assert(workflow.includes("EXPECTED_SHA: ${{ github.sha }}"),"workflow moet de exacte GitHub-SHA aan productie koppelen");
assert(workflow.includes("SMOKE_REQUEST_TIMEOUT_MS:"),"workflow moet een expliciete request-timeout instellen");
assert(workflow.includes("mcr.microsoft.com/playwright:v1.62.1-noble"),"production-smoke moet een vaste browserimage gebruiken");
assert(workflow.includes("node scripts/production-worldwide-browser.js"),"workflow mist de wereldwijde browsermonitor");
assert(workflow.includes("node scripts/production-staff-audit-browser.js"),"workflow mist de interactieve staff-auditmonitor");

/* De wereldmonitor blijft de echte live providerintegratie-gate; de staff-audit
   gebruikt sinds de interactiefixture deterministische data voor frontendgedrag.
   Houd die verantwoordelijkheden ook op workflowniveau apart: eerst bewijst één
   job de exacte deployment en API-contracten, daarna draaien live provider-QA en
   deterministische interactie-QA parallel op eigen runners. Zo is een fout direct
   aan het juiste domein toe te schrijven en beïnvloeden browserworkloads elkaar
   niet onnodig. */
assert(/^  production-contract:/m.test(workflow),"production-smoke mist aparte deployment/API-contractjob");
assert(/^  wereldwijd-browser:/m.test(workflow),"production-smoke mist aparte wereldwijde browserjob");
assert(/^  staff-audit-browser:/m.test(workflow),"production-smoke mist aparte staff-audit browserjob");
assert.equal((workflow.match(/^    needs: production-contract$/gm)||[]).length,2,"beide browserjobs moeten pas na het exacte productiecontract starten");

assert(smoke.includes("AbortSignal.timeout(timeoutMs)"),"production-smoke requests moeten een harde timeout hebben");
assert(smoke.includes("const maxPogingen=opt.retry===false?1:2"),"production-smoke mag per request maximaal één retry doen");
assert(smoke.includes('redirect:"manual"'),"production-smoke moet de www-redirect zelf controleren");
assert(smoke.includes("/weer/dit-bestaat-niet/"),"production-smoke moet echte 404-semantiek bewaken");
assert(smoke.includes("/api/plaatsnaam?lat=52.3508&lon=5.2647"),"production-smoke mist plaatsnaam-API-contract");
assert(smoke.includes("/api/neerslag?lat=52.3508&lon=5.2647&land=NL"),"production-smoke mist neerslag-API-contract");
assert(smoke.includes("/api/waarschuwingen?lat=52.3508&lon=5.2647&land=NL"),"production-smoke mist waarschuwingen-API-contract");
assert(smoke.includes("item.plaatsSpecifiek===true"),"waarschuwingencontract moet plaatsgebonden filtering bewaken");

for(const plek of ["Amsterdam","New York","Tokio","Sydney","Longyearbyen"])assert(wereldwijd.includes(`naam:\"${plek}\"`),`wereldwijde monitor mist ${plek}`);
assert(wereldwijd.includes('{naam:"mobiel",width:390,height:844}'),"wereldwijde monitor mist mobiel 390px");
assert(wereldwijd.includes('{naam:"desktop",width:1440,height:1000}'),"wereldwijde monitor mist desktop");
assert(wereldwijd.includes('uit.overflow<=1'),"wereldwijde monitor bewaakt horizontale overflow niet");
assert(wereldwijd.includes('assert.equal(uit.sha,verwacht'),"wereldwijde browsermonitor moet de exacte build-SHA bewaken");

console.log("production-monitoring-config: gescheiden live en deterministische browserjobs OK");
