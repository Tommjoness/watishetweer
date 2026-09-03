"use strict";

const fs=require("fs");
const {bepaalSha,htmlPaden}=require("./apply-build-provenance.js");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");

const verwacht=bepaalSha();
for(const p of htmlPaden()){
  if(!fs.existsSync(p))throw new Error("Build-provenance verifier mist artifact: "+p);
  const html=fs.readFileSync(p,"utf8");
  const matches=[...html.matchAll(/<meta name="weather-build-sha" content="([^"]+)">/g)];
  if(matches.length!==1)throw new Error(`${p}: build-SHA meta moet exact één keer voorkomen; gevonden ${matches.length}.`);
  if(matches[0][1]!==verwacht)throw new Error(`${p}: build-SHA ${matches[0][1]} wijkt af van verwacht ${verwacht}.`);
}
const cache=verifieerServiceworkerCache(require("path").join(__dirname,"..","public"),"build-provenance-verifier");
console.log(`Build-provenance geverifieerd op ${htmlPaden().length} HTML-artifacts: ${verwacht}; cache ${cache}.`);
