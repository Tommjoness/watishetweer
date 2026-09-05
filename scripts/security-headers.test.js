"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const bron=fs.readFileSync(path.join(root,"cloudflare","_headers"),"utf8");
const headers={};
for(const regel of bron.split(/\r?\n/)){
  const tekst=regel.trim();
  if(!tekst||!/^\s/.test(regel))continue;
  const i=tekst.indexOf(":");
  assert(i>0,"Ongeldige Cloudflare-headerregel: "+tekst);
  headers[tekst.slice(0,i).toLowerCase()]=tekst.slice(i+1).trim();
}

assert.equal(headers["x-content-type-options"],"nosniff","nosniff ontbreekt");
assert.equal(headers["x-frame-options"],"DENY","framing moet geblokkeerd blijven");
assert.equal(headers["cross-origin-opener-policy"],"same-origin","COOP moet het top-level document isoleren");
assert.equal(headers["referrer-policy"],"strict-origin-when-cross-origin","referrer policy wijkt af");
assert.equal(headers["strict-transport-security"],"max-age=31536000","HSTS moet HTTPS voor een jaar afdwingen zonder onomkeerbare preload/subdomeinclaim");
assert(headers["permissions-policy"]&&headers["permissions-policy"].includes("camera=()")&&headers["permissions-policy"].includes("microphone=()"),"camera/microfoon horen standaard uit");

const csp=headers["content-security-policy"]||"";
for(const contract of [
  "default-src 'self'",
  "script-src 'self' https://static.cloudflareinsights.com",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "connect-src 'self' https://api.open-meteo.com https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com https://api.bigdatacloud.net"
])assert(csp.includes(contract),"CSP-contract ontbreekt: "+contract);
assert(!csp.includes("script-src 'self' 'unsafe-inline'"),"Executable inline scripts horen na delivery-externalisatie niet meer toegestaan te zijn");
assert(!csp.includes("https://static.cloudflareinsights.com/beacon.min.js"),"CSP mag de Analytics-beacon niet meer tot het onversieerde bestandspad beperken; Cloudflare injecteert een versiepad");
assert(!csp.includes("cloudflareinsights.com/cdn-cgi/rum"),"Proxied Web Analytics hoort via same-origin /cdn-cgi/rum te posten, niet via een extra connect-src origin");

/* no-transform zette bij Cloudflare ook gzip/Brotli uit. HTML mag nog steeds
   direct revalideren, maar moet transformeerbaar blijven zodat de edge de grote
   documentresponse kan comprimeren en automatische Web Analytics-injectie niet
   door een no-transform contract wordt tegengehouden. */
for(const route of ["/","/weer/*"]){
  const escaped=route.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const blok=new RegExp("(?:^|\\n)"+escaped+"\\r?\\n((?:[ \\t]+[^\\r\\n]+\\r?\\n?)*)").exec(bron);
  assert(blok,`Cloudflare HTML-headerblok ontbreekt voor ${route}`);
  assert(/^[ \t]+Cache-Control:\s*public, max-age=0, must-revalidate\s*$/mi.test(blok[1]),`${route} mist revalidatiecache zonder no-transform`);
  assert(!/no-transform/i.test(blok[1]),`${route} blokkeert onbedoeld edge-compressie/analytics-injectie met no-transform`);
}
const swBlok=/(?:^|\\n)\\/sw\\.js\\r?\\n((?:[ \\t]+[^\\r\\n]+\\r?\\n?)*)/.exec(bron);
assert(swBlok,"Cloudflare serviceworker-headerblok ontbreekt");
assert(/^[ \\t]+Cache-Control:\\s*public, no-store, max-age=0, must-revalidate\\s*$/mi.test(swBlok[1]),"serviceworker mist zonecache-bypass plus directe revalidatie");

const middleware=fs.readFileSync(path.join(root,"functions","_middleware.js"),"utf8");
assert(middleware.includes('"Cross-Origin-Opener-Policy":"same-origin"'),"API-middleware mist COOP");
assert(middleware.includes('"Content-Security-Policy":"default-src \'self\'; script-src \'self\' https://static.cloudflareinsights.com; script-src-attr \'none\';'),"API-middleware loopt achter op strikt scriptbeleid plus versiecompatibele analytics-origin");
assert(!middleware.includes("https://static.cloudflareinsights.com/beacon.min.js"),"API-middleware mag versiegebonden Cloudflare-beacons niet blokkeren met een exact bestandspad");
assert(middleware.includes('new URL(context.request.url).pathname==="/sw.js"'),"middleware moet de serviceworkerroute exact afbakenen");
assert(middleware.includes("context.env.ASSETS.fetch(context.request)"),"serviceworkerresponse moet uit de gebouwde asset komen");
assert(middleware.includes('headers.set("Cache-Control","public, no-store, max-age=0, must-revalidate")'),"serviceworkerresponse moet de zonecache omzeilen en op de publieke custom domain direct revalideren");

console.log("security-headers: strikte CSP met Cloudflare Insights-origin voor versiebeacons, COOP, HSTS en compressievriendelijke HTML-cacheheaders OK");
