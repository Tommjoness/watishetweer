"use strict";

const assert=require("assert");
const fs=require("fs");
const os=require("os");
const path=require("path");
const {CSP_SOURCE,verruimCsp,pasHtmlAan,pasArtifactAan}=require("./apply-cloudflare-web-analytics-csp.js");

const policy="default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'";
const nieuw=verruimCsp(policy);
assert(nieuw.includes(`script-src 'self' 'unsafe-inline' ${CSP_SOURCE}`),"analytics-scriptbron moet exact aan script-src worden toegevoegd");
assert.equal((verruimCsp(nieuw).match(/static\.cloudflareinsights\.com\/beacon\.min\.js/g)||[]).length,1,"CSP-bewerking moet idempotent zijn");
assert.throws(()=>verruimCsp("default-src 'self'; connect-src 'self'"),/mist script-src/);

const html=`<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}"><title>x</title>`;
const bewerkt=pasHtmlAan(html);
assert.equal(bewerkt.gevonden,1);
assert(bewerkt.html.includes(CSP_SOURCE));

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"watishetweer-csp-"));
try{
  fs.mkdirSync(path.join(tmp,"weer","almere"),{recursive:true});
  fs.writeFileSync(path.join(tmp,"index.html"),html);
  fs.writeFileSync(path.join(tmp,"privacy.html"),html);
  fs.writeFileSync(path.join(tmp,"weer","almere","index.html"),html);
  const eerste=pasArtifactAan(tmp);
  assert.equal(eerste.bestanden,3);
  assert.equal(eerste.gewijzigd,3);
  const tweede=pasArtifactAan(tmp);
  assert.equal(tweede.gewijzigd,0,"tweede artifactbewerking moet noop zijn");
  for(const bestand of [path.join(tmp,"index.html"),path.join(tmp,"privacy.html"),path.join(tmp,"weer","almere","index.html")]){
    assert(fs.readFileSync(bestand,"utf8").includes(CSP_SOURCE));
  }
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

console.log("cloudflare-web-analytics-csp: exacte CSP-bron, alle HTML-routes en idempotentie OK");
