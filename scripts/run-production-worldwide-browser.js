"use strict";

const path=require("path");
const {spawnSync}=require("child_process");

const script=path.join(__dirname,"production-worldwide-browser.js");
const providerResponseTimeout=/page\.waitForResponse: Timeout \d+ms exceeded while waiting for event ["']response["']/;

function draai(){
  const resultaat=spawnSync(process.execPath,[script],{
    env:process.env,
    encoding:"utf8",
    maxBuffer:20*1024*1024
  });
  if(resultaat.stdout)process.stdout.write(resultaat.stdout);
  if(resultaat.stderr)process.stderr.write(resultaat.stderr);
  if(resultaat.error)throw resultaat.error;
  return {
    code:Number.isInteger(resultaat.status)?resultaat.status:1,
    uitvoer:String(resultaat.stdout||"")+"\n"+String(resultaat.stderr||"")
  };
}

const eerste=draai();
if(eerste.code===0)process.exit(0);

/* Alleen de bekende pre-response provider-timeout krijgt exact één nieuwe kans.
   Iedere inhoudelijke assertion, verkeerde SHA, UI-fout of andere browserfout
   blijft onmiddellijk rood. De tweede poging moet volledig slagen. */
if(!providerResponseTimeout.test(eerste.uitvoer))process.exit(eerste.code);

console.error("Wereldwijde monitor: tijdelijke provider-response-timeout; start exact één volledige retry met ongewijzigde assertions.");
const tweede=draai();
process.exit(tweede.code);
