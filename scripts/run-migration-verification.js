"use strict";
const {execFileSync}=require("child_process");
const path=require("path");
const ROOT=path.resolve(__dirname,"..");
const tests=[
  "interpretatie-engine.test.js",
  "build-weather.js",
  "audit-regressions.test.js",
  "senior-7-regressions.test.js",
  "run-built-regressions.test.js",
  "run-built-matrix.js",
  "run-api-source-compat.test.js"
];
for(const bestand of tests){
  console.log("\n=== "+bestand+" ===");
  execFileSync(process.execPath,[path.join(ROOT,bestand)],{cwd:ROOT,stdio:"inherit"});
}
console.log("\n=== browser-playwright.test.js syntax ===");
execFileSync(process.execPath,["--check",path.join(ROOT,"browser-playwright.test.js")],{cwd:ROOT,stdio:"inherit"});
console.log("\nMigratiepreview: alle niet-browsercontroles en browsersyntax geslaagd. Echte Chromium/WebKit blijft de laatste CI-poort.");
