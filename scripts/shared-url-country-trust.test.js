"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");

/* Een gedeelde URL is externe invoer. De coördinaten worden sinds #63 opnieuw
   uit de ruwe query gevalideerd, maar een meegegeven landcode mag evenmin de
   waarschuwingrouter kunnen overrulen. /api/waarschuwingen kan het land uit de
   gevalideerde coördinaten bepalen en daarna de canonieke code teruggeven. */
const bron=fs.readFileSync(path.join(__dirname,"global-location-hardening.js"),"utf8");

(async()=>{
  const calls=[];
  const state={style:{display:"none"},className:"",textContent:""};
  const context={
    URL,URLSearchParams,
    location:{search:"?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=US"},
    document:{getElementById:id=>id==="state"?state:null},
    j:async()=>({results:[]}),
    load:async(...args)=>{calls.push(args);return "geladen";},
    console
  };
  context.globalThis=context;
  vm.runInNewContext(bron,context,{filename:"shared-url-country-trust.runtime.test.js"});

  const uit=await context.load(52.3676,4.9041,"Amsterdam",false,false,"US");
  assert.equal(uit,"geladen");
  assert.equal(calls.length,1,"geldige gedeelde coördinaten moeten de bestaande load bereiken");
  assert.strictEqual(calls[0][0],52.3676);
  assert.strictEqual(calls[0][1],4.9041);
  assert.strictEqual(calls[0][4],false,"gedeelde locatie mag niet persoonlijk worden opgeslagen");
  assert.strictEqual(calls[0][5],null,"land uit een gedeelde URL is onbewezen en mag waarschuwingrouting niet bepalen");

  console.log("Gedeelde URL-landcode: gevalideerde coördinaten zijn leidend en onbewezen landquery wordt niet vertrouwd.");
})().catch(err=>{console.error(err&&err.stack||err);process.exitCode=1;});
