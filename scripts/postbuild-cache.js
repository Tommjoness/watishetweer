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

function vernieuwServiceworkerCache(out,label){
  if(!out||typeof out!=="string")throw new TypeError("Publieke buildmap ontbreekt voor cachevernieuwing.");
  const context=label?String(label):"postbuild";
  const hash=crypto.createHash("sha256");
  for(const naam of CACHE_BRONNEN){
    const p=path.join(out,naam);
    if(!fs.existsSync(p))throw new Error("App-shellbestand ontbreekt voor "+context+" cachehash: "+naam);
    hash.update(naam+"\0");hash.update(fs.readFileSync(p));hash.update("\0");
  }
  const versie="watishetweer-"+hash.digest("hex").slice(0,12);
  const swPad=path.join(out,"sw.js");
  if(!fs.existsSync(swPad))throw new Error("Serviceworker ontbreekt voor "+context+" cachehash.");
  let sw=fs.readFileSync(swPad,"utf8");
  const aantal=(sw.match(/watishetweer-[0-9a-f]{12}/g)||[]).length;
  if(aantal<1)throw new Error("Geen serviceworker-cachehash gevonden voor "+context+".");
  sw=sw.replace(/watishetweer-[0-9a-f]{12}/g,versie);
  if(!sw.includes(versie))throw new Error("Nieuwe serviceworker-cachehash niet toegepast voor "+context+".");
  fs.writeFileSync(swPad,sw,"utf8");
  return versie;
}

module.exports={CACHE_BRONNEN,vernieuwServiceworkerCache};
