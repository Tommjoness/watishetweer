"use strict";
const fs=require("fs"),path=require("path");
const ROOT=path.resolve(__dirname,".."),OUT=path.join(ROOT,"migration-artifacts");
fs.rmSync(OUT,{recursive:true,force:true});
const bestanden=[
  "index.html","interpretatie-engine.js","build-weather.js","api/plaatsnaam.mjs","api/waarschuwingen.mjs",
  "lib/waarschuwingen.cjs","browser-production.test.js","senior-7-regressions.test.js","browser-playwright.test.js",
  "package.json",".github/workflows/quality.yml"
];
for(const p of bestanden){
  const bron=path.join(ROOT,p);if(!fs.existsSync(bron))throw new Error("Ontbreekt na migratie: "+p);
  const doel=path.join(OUT,p+".txt");fs.mkdirSync(path.dirname(doel),{recursive:true});fs.copyFileSync(bron,doel);
}
fs.writeFileSync(path.join(OUT,"manifest.json"),JSON.stringify({bestanden,hardeningV2Bestaat:fs.existsSync(path.join(ROOT,"productie-hardening-v2.js")),hardeningV1Bestaat:fs.existsSync(path.join(ROOT,"productie-hardening.js"))},null,2));
console.log("Migratie-artifacts klaargezet voor previewcontrole.");
