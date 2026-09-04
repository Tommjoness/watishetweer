"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const bron=fs.readFileSync(path.join(__dirname,"apply-weather-fallback-hedge.js"),"utf8");
const hedge=/const WEER_HEDGE_MS=(\d+);/.exec(bron);
const fallback=/const WEER_FALLBACK_TIMEOUT_MS=(\d+);/.exec(bron);

assert(hedge,"weerhedge-budget moet expliciet in de productie-owner staan");
assert(fallback,"fallback-timeout moet expliciet in de productie-owner staan");

const hedgeMs=Number(hedge[1]);
const fallbackMs=Number(fallback[1]);
assert.equal(hedgeMs,5000,"trage volledige forecast start de lichte fallback na vijf seconden");
assert.equal(fallbackMs,5000,"lichte fallback krijgt vijf seconden eigen budget");
assert(hedgeMs+fallbackMs<=10000,"dubbele providerhang moet rond tien seconden beslissen");
assert(12000-(hedgeMs+fallbackMs)>=2000,"acceptancetest moet minstens twee seconden browser-/UI-marge houden");
assert(bron.includes("const volledigeBelofte=j(f,{timeoutMs:10000,signal:weerController.signal});"),"volledige kwaliteitsforecast behoudt de bestaande tienseconden-cap");
assert(bron.includes("fallbackBelofte=j(fmin,{timeoutMs:WEER_FALLBACK_TIMEOUT_MS,signal:weerController.signal})"),"alleen de lichte fallback gebruikt de kortere cap");

console.log(`Weather fallback budget groen: ${hedgeMs} ms hedge + ${fallbackMs} ms fallback = maximaal ${hedgeMs+fallbackMs} ms met ${12000-hedgeMs-fallbackMs} ms acceptancemarge.`);
