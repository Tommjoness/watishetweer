"use strict";

const fs=require("fs");
const path=require("path");
const origineel=fs.readFileSync;
const redirects=new Map([
  [path.resolve(__dirname,"api","waarschuwingen.js"),path.resolve(__dirname,"lib","waarschuwingen.cjs")],
  [path.resolve(__dirname,"api","plaatsnaam.js"),path.resolve(__dirname,"lib","plaatsnaam.cjs")]
]);

fs.readFileSync=function(bestand,...args){
  const resolved=typeof bestand==="string"?path.resolve(bestand):bestand;
  return origineel.call(this,redirects.get(resolved)||bestand,...args);
};

require("./run.js");
