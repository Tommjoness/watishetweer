"use strict";

const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

/* Eén eigenaar voor de app-shellhash die na iedere postbuild-mutatie opnieuw
   nodig is. De lijst en hashvolgorde zijn bewust identiek aan build-weather.js:
   bestandsnaam, NUL, bytes, NUL. Zo kan een presentatielaag de cacheversie niet
   per ongeluk volgens een afwijkend recept berekenen. */
const CACHE_BRONNEN=Object.freeze([
  "index.html","manifest.json","icon-192.png","icon-512.png","icon-maskable-512.png",
  "bodoni-moda-latin-400-normal.woff2","bodoni-moda-latin-500-normal.woff2",
  "instrument-sans-latin-400-normal.woff2","instrument-sans-latin-500-normal.woff2",
  "instrument-sans-latin-600-normal.woff2","dm-mono-latin-400-normal.woff2","dm-mono-latin-500-normal.woff2"
]);
const CACHE_ID_PATTERN=/(?:weerbriefing|watishetweer)-(?:v\d+|[0-9a-f]{12})/g;

function contextNaam(label){return label?String(label):"postbuild";}

function berekenServiceworkerCacheVersie(out,label){
  if(!out||typeof out!=="string")throw new TypeError("Publieke buildmap ontbreekt voor cacheberekening.");
  const context=contextNaam(label);
  const hash=crypto.createHash("sha256");
  for(const naam of CACHE_BRONNEN){
    const p=path.join(out,naam);
    if(!fs.existsSync(p))throw new Error("App-shellbestand ontbreekt voor "+context+" cachehash: "+naam);
    hash.update(naam+"\0");hash.update(fs.readFileSync(p));hash.update("\0");
  }
  return "watishetweer-"+hash.digest("hex").slice(0,12);
}

function leesServiceworkerCacheVersie(out,label){
  if(!out||typeof out!=="string")throw new TypeError("Publieke buildmap ontbreekt voor cachecontrole.");
  const context=contextNaam(label),swPad=path.join(out,"sw.js");
  if(!fs.existsSync(swPad))throw new Error("Serviceworker ontbreekt voor "+context+" cachecontrole.");
  const sw=fs.readFileSync(swPad,"utf8"),match=/const CACHE = "([^"]+)";/.exec(sw);
  if(!match)throw new Error("Serviceworker-cache-id ontbreekt voor "+context+".");
  return match[1];
}

function verifieerServiceworkerCache(out,label){
  const context=contextNaam(label);
  const verwacht=berekenServiceworkerCacheVersie(out,context);
  const werkelijk=leesServiceworkerCacheVersie(out,context);
  if(werkelijk!==verwacht)throw new Error("Serviceworker-cache hoort bij een andere "+context+" artifact: "+werkelijk+" versus "+verwacht+".");
  return verwacht;
}

function vernieuwServiceworkerCache(out,label){
  if(!out||typeof out!=="string")throw new TypeError("Publieke buildmap ontbreekt voor cachevernieuwing.");
  const context=contextNaam(label);
  const versie=berekenServiceworkerCacheVersie(out,context);
  const swPad=path.join(out,"sw.js");
  if(!fs.existsSync(swPad))throw new Error("Serviceworker ontbreekt voor "+context+" cachehash.");
  let sw=fs.readFileSync(swPad,"utf8");
  const aantal=(sw.match(CACHE_ID_PATTERN)||[]).length;
  if(aantal<1)throw new Error("Geen serviceworker-cachehash gevonden voor "+context+".");
  sw=sw.replace(CACHE_ID_PATTERN,versie);
  fs.writeFileSync(swPad,sw,"utf8");
  const gecontroleerd=verifieerServiceworkerCache(out,context);
  if(gecontroleerd!==versie)throw new Error("Nieuwe serviceworker-cachehash niet toegepast voor "+context+".");
  return versie;
}

module.exports={
  CACHE_BRONNEN,
  berekenServiceworkerCacheVersie,
  leesServiceworkerCacheVersie,
  verifieerServiceworkerCache,
  vernieuwServiceworkerCache
};
