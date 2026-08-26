"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const bron=fs.readFileSync(path.join(root,"cloudflare","_headers"),"utf8");
const headers={};
for(const regel of bron.split(/\r?\n/)){
  const tekst=regel.trim();
  if(!tekst||tekst==="/*")continue;
  const i=tekst.indexOf(":");
  assert(i>0,"Ongeldige Cloudflare-headerregel: "+tekst);
  headers[tekst.slice(0,i).toLowerCase()]=tekst.slice(i+1).trim();
}

assert.equal(headers["x-content-type-options"],"nosniff","nosniff ontbreekt");
assert.equal(headers["x-frame-options"],"DENY","framing moet geblokkeerd blijven");
assert.equal(headers["referrer-policy"],"strict-origin-when-cross-origin","referrer policy wijkt af");
assert.equal(headers["strict-transport-security"],"max-age=31536000","HSTS moet HTTPS voor een jaar afdwingen zonder subdomeinen of preload");
assert(headers["permissions-policy"]&&headers["permissions-policy"].includes("camera=()")&&headers["permissions-policy"].includes("microphone=()"),"camera/microfoon horen standaard uit");

const csp=headers["content-security-policy"]||"";
for(const contract of [
  "default-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
])assert(csp.includes(contract),"CSP-contract ontbreekt: "+contract);

const directives={};
for(const deel of csp.split(";").map(v=>v.trim()).filter(Boolean)){
  const [naam,...waarden]=deel.split(/\s+/);
  directives[naam]=waarden.join(" ");
}
const verwachteConnect="'self' https://api.open-meteo.com https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com https://api.bigdatacloud.net";
assert.equal(directives["connect-src"],verwachteConnect,"connect-src mag voor automatische Cloudflare Insights geen extra externe endpoint nodig hebben");

/* De app assembleert nog inline runtime en CSS. 'unsafe-inline' kan pas
   verdwijnen nadat die architectuur is gemigreerd. Cloudflare Pages injecteert
   Web Analytics buiten de bronartifact; daarvoor staat uitsluitend de exacte
   Insights-origin op script-src. Geen wildcard en geen extra analytics-host op
   connect-src, omdat automatische RUM naar dezelfde site terugstuurt. */
assert.equal(directives["script-src"],"'self' 'unsafe-inline' https://static.cloudflareinsights.com","script-src wijkt af van de minimale productie-allowlist");
assert.equal(directives["style-src"],"'self' 'unsafe-inline'","Huidige inline styles passen niet meer binnen CSP");
assert(!directives["script-src"].includes("*"),"script-src mag geen wildcard bevatten");
assert(!directives["connect-src"].includes("cloudflareinsights.com"),"Automatische RUM hoort via dezelfde origin te versturen");

console.log("security-headers: Cloudflare response-CSP, HSTS en minimale Insights-allowlist OK");
