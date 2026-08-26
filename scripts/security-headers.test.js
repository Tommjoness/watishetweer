"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const config=JSON.parse(fs.readFileSync(path.join(root,"vercel.json"),"utf8"));
const regel=(config.headers||[]).find(x=>x&&x.source==="/(.*)");
assert(regel&&Array.isArray(regel.headers),"Algemene productieheaders ontbreken");
const headers=Object.fromEntries(regel.headers.map(x=>[String(x.key||"").toLowerCase(),String(x.value||"")]));

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
  "frame-ancestors 'none'",
  "connect-src 'self' https://api.open-meteo.com https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com https://api.bigdatacloud.net"
])assert(csp.includes(contract),"CSP-contract ontbreekt: "+contract);

/* De huidige app assembleert nog inline runtime en CSS. 'unsafe-inline' kan pas
   verdwijnen nadat die architectuur is gemigreerd; deze test voorkomt dat iemand
   het nu stil verwijdert en productie breekt terwijl de overige CSP wel hard is. */
assert(csp.includes("script-src 'self' 'unsafe-inline'"),"Huidige inline runtime past niet meer binnen CSP");
assert(csp.includes("style-src 'self' 'unsafe-inline'"),"Huidige inline styles passen niet meer binnen CSP");

console.log("security-headers: response-CSP, HSTS en basisheaders OK");