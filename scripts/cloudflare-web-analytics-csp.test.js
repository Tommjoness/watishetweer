"use strict";

const assert=require("assert");
const fs=require("fs");
const os=require("os");
const path=require("path");
const {CSP_SOURCE,verruimCsp,pasHtmlAan,pasArtifactAan}=require("./apply-cloudflare-web-analytics-csp.js");

function aantalBronnen(policy){return String(policy).split(CSP_SOURCE).length-1;}

assert.equal(CSP_SOURCE,"https://static.cloudflareinsights.com","CSP moet de officiële Cloudflare Insights-origin toestaan zodat automatisch geïnjecteerde versiebeacons niet worden geblokkeerd");

const policy="default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'";
const nieuw=verruimCsp(policy);
assert(nieuw.includes(`script-src 'self' 'unsafe-inline' ${CSP_SOURCE}`),"analytics-origin moet exact aan script-src worden toegevoegd");
assert.equal(aantalBronnen(verruimCsp(nieuw)),1,"CSP-bewerking moet idempotent zijn");

const defaultOnly="default-src 'self'; connect-src 'self'";
const defaultBewerkt=verruimCsp(defaultOnly);
assert(defaultBewerkt.includes(`script-src 'self' ${CSP_SOURCE}`),"zonder script-src moet de bestaande default-src-fallback als expliciete script-src worden behouden");
assert.equal(aantalBronnen(verruimCsp(defaultBewerkt)),1,"default-src-fallbackpad moet idempotent zijn");

const elemPolicy="default-src 'none'; script-src 'self'; script-src-elem 'self' https://voorbeeld.invalid; connect-src 'self'";
const elemBewerkt=verruimCsp(elemPolicy);
assert(elemBewerkt.includes(`script-src-elem 'self' https://voorbeeld.invalid ${CSP_SOURCE}`),"script-src-elem moet als effectieve externe-scriptrichtlijn worden verruimd");
assert(!elemBewerkt.includes(`script-src 'self' ${CSP_SOURCE}`),"niet-effectieve script-src hoeft niet onnodig te worden verruimd wanneer script-src-elem bestaat");

const onbeperkt="img-src 'self'; connect-src 'self'";
assert.equal(verruimCsp(onbeperkt),onbeperkt,"CSP zonder script/default-beperking moet semantisch een noop blijven");
assert.throws(()=>verruimCsp("default-src; connect-src 'self'"),/ongeldige lege default-src/);

const html=`<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}"><title>x</title>`;
const bewerkt=pasHtmlAan(html);
assert.equal(bewerkt.gevonden,1);
assert(bewerkt.html.includes(CSP_SOURCE));

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"watishetweer-csp-"));
try{
  fs.mkdirSync(path.join(tmp,"weer","almere"),{recursive:true});
  fs.writeFileSync(path.join(tmp,"index.html"),html);
  fs.writeFileSync(path.join(tmp,"privacy.html"),`<!doctype html><meta http-equiv="Content-Security-Policy" content="${defaultOnly}"><title>privacy</title>`);
  fs.writeFileSync(path.join(tmp,"weer","almere","index.html"),`<!doctype html><meta http-equiv="Content-Security-Policy" content="${onbeperkt}"><title>almere</title>`);
  const eerste=pasArtifactAan(tmp);
  assert.equal(eerste.bestanden,3);
  assert.equal(eerste.gewijzigd,2,"alleen CSP's die de beacon werkelijk blokkeren hoeven te wijzigen");
  const tweede=pasArtifactAan(tmp);
  assert.equal(tweede.gewijzigd,0,"tweede artifactbewerking moet noop zijn");
  assert(fs.readFileSync(path.join(tmp,"index.html"),"utf8").includes(CSP_SOURCE));
  assert(fs.readFileSync(path.join(tmp,"privacy.html"),"utf8").includes(CSP_SOURCE));
  assert(!fs.readFileSync(path.join(tmp,"weer","almere","index.html"),"utf8").includes(CSP_SOURCE),"onbeperkte scriptfallback hoeft geen extra CSP-directive te krijgen");
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

console.log("cloudflare-web-analytics-csp: effectieve scriptdirective, versiebeacon-origin, default-src-fallback, onbeperkte noop en idempotentie OK");
