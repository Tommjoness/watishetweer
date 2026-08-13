"use strict";
const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");
const bron=fs.readFileSync(path.join(__dirname,"global-location-hardening.js"),"utf8")+"\n"+fs.readFileSync(path.join(__dirname,"shared-url-place-identity.js"),"utf8");

(async()=>{
  const calls=[],reverseCalls=[];
  const state={style:{display:"none"},className:"",textContent:""};
  const q={value:"Amsterdam"};
  const context={
    URL,URLSearchParams,
    location:{search:"?lat=40.7128&lon=-74.0060&plaats=Amsterdam&land=NL"},
    document:{getElementById:id=>id==="state"?state:id==="q"?q:null},
    j:async url=>{
      const u=String(url||"");
      if(u.includes("/api/plaatsnaam?")){reverseCalls.push(u);return {naam:"New York",land:"US"};}
      return {results:[]};
    },
    load:async(...args)=>{calls.push(args);return "geladen";},
    console
  };
  context.globalThis=context;
  vm.runInNewContext(bron,context,{filename:"shared-url-place-trust.runtime.test.js"});

  const uit=await context.load(40.7128,-74.006,"Amsterdam",false,false,"NL");
  assert.equal(uit,"geladen");
  assert.equal(calls.length,1);
  assert.strictEqual(calls[0][0],40.7128);
  assert.strictEqual(calls[0][1],-74.006);
  assert.strictEqual(calls[0][2],"New York");
  assert.strictEqual(calls[0][4],false);
  assert.strictEqual(calls[0][5],null);
  assert.equal(reverseCalls.length,1);
  assert(reverseCalls[0].includes("lat=40.7128")&&reverseCalls[0].includes("lon=-74.0060"));
  assert.strictEqual(q.value,"New York");
  console.log("Gedeelde URL-plaatsnaam: gevalideerde coördinaten bepalen de zichtbare identiteit.");
})().catch(err=>{console.error(err&&err.stack||err);process.exitCode=1;});
