"use strict";
const assert=require("assert"),pkg=require("../package.json");
assert(pkg.scripts["test:prebuild"].includes("node scripts/final-audit-20260901.test.js"),"test:prebuild mist finale audithelpertest");
for(const stap of ["node scripts/apply-final-audit-20260901.js","node scripts/verify-final-audit-20260901.js"]){assert(pkg.scripts.test.includes(stap),"npm test mist "+stap);assert(pkg.scripts.postbuild.includes(stap),"npm postbuild mist "+stap);}
assert(pkg.scripts.test.includes("node browser-final-audit-20260901.test.js"),"npm test mist finale auditbrowsertest");
assert(pkg.scripts.test.indexOf("node scripts/apply-primary-metric-grid-20260901.js")<pkg.scripts.test.indexOf("node scripts/apply-final-audit-20260901.js"),"audit moet na primaire metriekgrid draaien");
assert(pkg.scripts.postbuild.indexOf("node scripts/apply-final-audit-20260901.js")<pkg.scripts.postbuild.indexOf("node scripts/platform-output-cleanup.js"),"audit moet voor delivery cleanup draaien");
console.log("Finale audit is correct aangesloten op prebuild-, test- en postbuildketen.");
