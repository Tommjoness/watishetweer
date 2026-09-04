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

/* run.js bevat een brede legacy-regressiematrix die meerdere UI-klokken binnen
   één synchrone test vergelijkt. Fixeer uitsluitend de impliciete huidige tijd
   voor deze wrapper, zodat een echte minuutgrens tussen twee asserts geen flake
   veroorzaakt. Expliciet geconstrueerde datums, Date.parse en Date.UTC behouden
   exact de native semantiek. */
const EchteDate=Date;
const testNu=EchteDate.now();
global.Date=class TestDate extends EchteDate{
  constructor(...args){super(...(args.length?args:[testNu]));}
  static now(){return testNu;}
  static parse(v){return EchteDate.parse(v);}
  static UTC(...args){return EchteDate.UTC(...args);}
};

require("./run.js");