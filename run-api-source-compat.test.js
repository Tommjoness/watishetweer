"use strict";

const fs=require("fs");
const path=require("path");
const origineel=fs.readFileSync;
const oudPad=path.resolve(__dirname,"api","waarschuwingen.js");
const nieuwPad=path.resolve(__dirname,"lib","waarschuwingen.cjs");

fs.readFileSync=function(bestand,...args){
  const resolved=typeof bestand==="string"?path.resolve(bestand):bestand;
  return origineel.call(this,resolved===oudPad?nieuwPad:bestand,...args);
};

require("./run.js");
