"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const workflow=fs.readFileSync(path.join(root,".github","workflows","production-smoke.yml"),"utf8");
const smoke=fs.readFileSync(path.join(root,"scripts","production-smoke.js"),"utf8");

assert(/push:\s*\n\s*branches:\s*\[main\]/.test(workflow),"production-smoke moet na merges/pushes naar main draaien");
assert(/schedule:\s*\n\s*- cron: ["']\d+ \* \* \* \*["']/.test(workflow),"production-smoke moet ieder uur gepland staan");
assert(/workflow_dispatch:/.test(workflow),"production-smoke moet handmatig startbaar blijven");
assert(workflow.includes("EXPECTED_SHA: ${{ github.sha }}"),"workflow moet de exacte GitHub-SHA aan productie koppelen");
assert(workflow.includes("SMOKE_REQUEST_TIMEOUT_MS:"),"workflow moet een expliciete request-timeout instellen");

assert(smoke.includes("AbortSignal.timeout(timeoutMs)"),"production-smoke requests moeten een harde timeout hebben");
assert(smoke.includes("const maxPogingen=opt.retry===false?1:2"),"production-smoke mag per request maximaal één retry doen");
assert(smoke.includes('redirect:"manual"'),"production-smoke moet de www-redirect zelf controleren");
assert(smoke.includes("/weer/dit-bestaat-niet/"),"production-smoke moet echte 404-semantiek bewaken");
assert(smoke.includes("/api/plaatsnaam?lat=52.3508&lon=5.2647"),"production-smoke mist plaatsnaam-API-contract");
assert(smoke.includes("/api/waarschuwingen?lat=52.3508&lon=5.2647&land=NL"),"production-smoke mist waarschuwingen-API-contract");
assert(smoke.includes("item.plaatsSpecifiek===true"),"waarschuwingencontract moet plaatsgebonden filtering bewaken");

console.log("production-monitoring-config: OK");
