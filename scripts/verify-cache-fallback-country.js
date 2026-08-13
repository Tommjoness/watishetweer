"use strict";

const fs=require("fs");
const path=require("path");
const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");

const oud="S.land=normLand(oud.land)||S.land;";
const nieuw="S.land=normLand(oud.land);";
if(html.includes(oud))throw new Error("Oude cachefallback kan nog stale landcode van mislukte locatie behouden.");
const aantal=html.split(nieuw).length-1;
if(aantal!==1)throw new Error("Gecorrigeerde cachefallback-landregel ontbreekt of is dubbel: "+aantal);
console.log("Cachefallback-landartifact geverifieerd: cache-identiteit faalt zonder landcode gesloten en kan geen stale doelland meenemen.");
