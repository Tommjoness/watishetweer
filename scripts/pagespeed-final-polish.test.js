"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");

const ROOT=path.join(__dirname,"..");
const shell=fs.readFileSync(path.join(__dirname,"apply-ui-shell.js"),"utf8");
const delivery=fs.readFileSync(path.join(__dirname,"platform-output-cleanup.js"),"utf8");
const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,"package.json"),"utf8"));

assert(shell.includes('const faviconRuntime=\'<script>!function(){'),"faviconruntime heeft geen afzonderlijke late owner");
assert(shell.includes('vervangEen("</body>",faviconRuntime+"\\n</body>"'),"faviconruntime wordt niet naar het body-einde verplaatst");
const faviconHead=/<\!-- WEATHERNOW TABICOON -->(?:.|\n)*?<script>/m.test(shell.split('const faviconRuntime=')[0]);
assert.equal(faviconHead,false,"faviconowner mag vóór zijn late runtime geen inline script in de head injecteren");

for(const font of [
  "/instrument-sans-latin-400-normal.woff2",
  "/instrument-sans-latin-500-normal.woff2",
  "/bodoni-moda-latin-400-normal.woff2"
])assert(delivery.includes(font),"delivery-owner mist kritieke fontpreload: "+font);
assert(delivery.includes('const stijlPos=bron.search(/<style\\b/i);'),"fontpreloads zijn niet expliciet vóór het eerste stijlblok gepositioneerd");

assert(pkg.scripts.test.endsWith("node scripts/verify-pagespeed-final-polish.js"),"npm test eindigt niet met PageSpeed artifactverificatie");
assert(pkg.scripts.postbuild.endsWith("node scripts/verify-pagespeed-final-polish.js"),"postbuild eindigt niet met PageSpeed artifactverificatie");

console.log("PageSpeed broncontract groen: favicon is niet pre-paint, drie kritieke fonts worden vroeg gepreload en het finale artifact wordt in test én postbuild geverifieerd.");
