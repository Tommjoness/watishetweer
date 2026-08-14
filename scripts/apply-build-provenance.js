"use strict";

const fs=require("fs");
const path=require("path");
const {LOCATIES}=require("./seo-locations.config.js");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const META_RE=/<meta name="weather-build-sha" content="[^"]+">/g;

function bepaalSha(env=process.env){
  const raw=env.VERCEL_GIT_COMMIT_SHA||env.GITHUB_SHA||"local";
  const sha=String(raw).trim();
  if(sha!=="local"&&!/^[0-9a-f]{7,40}$/i.test(sha))throw new Error("Ongeldige build-SHA voor provenance: "+sha);
  return sha;
}
function stampHtml(html,sha){
  let bron=String(html||"");
  const bestaand=[...bron.matchAll(META_RE)];
  if(bestaand.length>1)throw new Error("Build-provenance meta staat dubbel in HTML.");
  const meta=`<meta name="weather-build-sha" content="${sha}">`;
  if(bestaand.length===1)return bron.replace(bestaand[0][0],meta);
  if(!bron.includes("<meta charset=\"utf-8\">"))throw new Error("Build-provenance verwacht utf-8 meta als stabiele invoeganker.");
  return bron.replace("<meta charset=\"utf-8\">","<meta charset=\"utf-8\">\n"+meta);
}
function htmlPaden(){
  return [
    path.join(OUT,"index.html"),
    path.join(OUT,"weer","index.html"),
    ...LOCATIES.map(loc=>path.join(OUT,"weer",loc.slug,"index.html"))
  ];
}
function main(){
  const sha=bepaalSha();
  for(const p of htmlPaden()){
    if(!fs.existsSync(p))throw new Error("Build-provenance mist HTML-artifact: "+p);
    fs.writeFileSync(p,stampHtml(fs.readFileSync(p,"utf8"),sha),"utf8");
  }
  const cache=vernieuwServiceworkerCache(OUT,"build-provenance");
  console.log(`Build-provenance toegepast op ${htmlPaden().length} HTML-artifacts: ${sha}; cache ${cache}.`);
}
if(require.main===module)main();
module.exports={bepaalSha,stampHtml,htmlPaden};
