"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");

const ROOT=path.join(__dirname,"..");
const manifestPad=path.join(ROOT,"manifest.json");
const swPad=path.join(ROOT,"sw.js");
const manifest=JSON.parse(fs.readFileSync(manifestPad,"utf8"));
const sw=fs.readFileSync(swPad,"utf8");
const index=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
const manifestUrl=new URL("https://watishetweer.nl/manifest.json");
const resolve=v=>new URL(v,manifestUrl);

/* De productie-PWA bestond al zonder expliciete id en gebruikte ./index.html als
   start_url. Browsers vallen zonder id terug op die start-URL voor de app-
   identiteit. Houd daarom /index.html expliciet als stabiele id terwijl de
   werkelijke launch-URL naar de canonieke root verhuist. */
assert.equal(manifest.id,"/index.html","PWA-id moet de bestaande impliciete /index.html-identiteit behouden");
assert.equal(manifest.start_url,"/","PWA moet direct op de canonieke root starten zonder index.html-redirect");
assert.equal(manifest.scope,"/","PWA-scope moet expliciet de volledige site-root omvatten");
assert.equal(manifest.display,"standalone","PWA-displaymodus mag niet wijzigen");
assert(index.includes('<link rel="apple-touch-icon" href="/icon-192.png">'),"iOS homescreen moet het PNG-weericoon gebruiken");
const weatherPng=fs.readFileSync(path.join(ROOT,"icon-192.png"));
assert.equal(weatherPng.readUInt32BE(16),192,"iOS weericoon moet 192px breed zijn");
assert.equal(weatherPng.readUInt32BE(20),192,"iOS weericoon moet 192px hoog zijn");

assert.equal(resolve(manifest.id).href,"https://watishetweer.nl/index.html","PWA-id resolveert niet naar de historische identiteit");
assert.equal(resolve(manifest.start_url).href,"https://watishetweer.nl/","PWA-start_url resolveert niet naar de canonieke root");
assert.equal(resolve(manifest.scope).href,"https://watishetweer.nl/","PWA-scope resolveert niet naar de site-root");
assert.equal(resolve(manifest.id).origin,manifestUrl.origin,"PWA-id moet same-origin blijven");
assert.equal(resolve(manifest.start_url).origin,manifestUrl.origin,"PWA-start_url moet same-origin blijven");

assert(Array.isArray(manifest.shortcuts)&&manifest.shortcuts.length===1,"PWA moet exact de bestaande Mijn locatie-shortcut behouden");
const shortcut=manifest.shortcuts[0];
assert.equal(shortcut.name,"Mijn locatie","PWA-shortcutnaam is onverwacht gewijzigd");
assert.equal(shortcut.url,"/?hier=1","Mijn locatie-shortcut moet direct de canonieke root gebruiken");
assert.equal(resolve(shortcut.url).href,"https://watishetweer.nl/?hier=1","PWA-shortcut resolveert niet naar de canonieke rootquery");
assert.equal(resolve(shortcut.url).origin,manifestUrl.origin,"PWA-shortcut moet same-origin blijven");

/* Root, index en manifest blijven alle drie in de install-shell. Daarmee blijft
   zowel de nieuwe root-launch als een bestaande /index.html-installatie offline
   bruikbaar tijdens serviceworker-updates. */
for(const item of ['"./"','"./index.html"','"./manifest.json"']){
  assert(sw.includes(item),`serviceworker-shell mist ${item}`);
}

console.log("PWA-manifestcontract groen: historische /index.html-identiteit behouden; root-launch, scope en Mijn locatie-shortcut canoniek.");
