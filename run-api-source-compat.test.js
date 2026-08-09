"use strict";

const fs=require("fs");
const path=require("path");
const origineelLees=fs.readFileSync;
const origineelBestaat=fs.existsSync;
const redirects=new Map([
  [path.resolve(__dirname,"api","waarschuwingen.js"),path.resolve(__dirname,"lib","waarschuwingen.cjs")],
  [path.resolve(__dirname,"api","plaatsnaam.js"),path.resolve(__dirname,"lib","plaatsnaam.cjs")]
]);

function compatPad(bestand){
  if(typeof bestand!=="string") return bestand;
  const resolved=path.resolve(bestand);
  return redirects.get(resolved)||bestand;
}

fs.readFileSync=function(bestand,...args){
  return origineelLees.call(this,compatPad(bestand),...args);
};
fs.existsSync=function(bestand){
  return origineelBestaat.call(this,compatPad(bestand));
};

require("./run.js");
