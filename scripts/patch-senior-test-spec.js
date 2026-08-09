"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
function vervang(p,oud,nieuw,label){
  const f=path.join(root,p);let s=fs.readFileSync(f,"utf8");
  const n=s.split(oud).length-1;if(n!==1)throw new Error(label+": verwacht één oude testspecificatie, gevonden "+n);
  fs.writeFileSync(f,s.replace(oud,nieuw),"utf8");
}
vervang("interpretatie-engine.test.js",
'  assert(/hooguit enkele druppels/.test(zin),zin);',
'  assert(/geen meetbare hoeveelheid.*onzeker/.test(zin),zin);',
"neerslagonzekerheid");
vervang("built-production-regressions.test.js",
'ok(/require\\("\\.\\/productie-hardening-v2\\.js"\\)/.test(build)&&/html=pasToe\\(html\\)/.test(build),"senior-hardening is onderdeel van één expliciete buildcompiler");',
'ok(!/productie-hardening/.test(build)&&!/html=pasToe\\(html\\)/.test(build),"productsemantiek staat in canonieke bron en niet in build-hardening");',
"canonieke bronarchitectuur");
console.log("Verouderde testspecificaties bijgewerkt naar de nieuwe canonieke architectuur.");
