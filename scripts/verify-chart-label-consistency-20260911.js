"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  OUT,OUD,NIEUW,RASTER_OUD,RASTER_NIEUW,PLAATSINGSANKER,FALLBACKANKER,htmlBestanden
}=require("./apply-chart-label-consistency-20260911.js");

function main(){
  let gecontroleerd=0;
  for(const p of htmlBestanden(OUT)){
    const bron=fs.readFileSync(p,"utf8");
    if(!bron.includes(PLAATSINGSANKER))continue;
    gecontroleerd++;
    const label=path.relative(OUT,p);
    assert(!bron.includes(OUD),`${label}: lokale temperatuurdalen kiezen nog standaard de onderkant.`);
    assert(bron.includes(NIEUW),`${label}: consistente bovenvoorkeur ontbreekt.`);
    assert(!bron.includes(RASTER_OUD),`${label}: het vaste etmaalraster kan nog als laagste prioriteit verdwijnen.`);
    assert(bron.includes(RASTER_NIEUW),`${label}: beschermd etmaalraster ontbreekt.`);
    assert(bron.includes(FALLBACKANKER),`${label}: collision/rand-fallback naar onder is onbedoeld verdwenen.`);
    assert(bron.includes("const opties=[[kandBoven,true],[kandOnder,false]];"),`${label}: beide labelzijden moeten beschikbaar blijven voor collision/rand-fallback.`);
  }
  assert(gecontroleerd>0,"Geen gebouwde weergrafiek gevonden om labelplaatsing te verifiëren.");
  console.log(`Temperatuur-labelcontract OK op ${gecontroleerd} weergrafiek-artifacts: boven is voorkeur, vast etmaalraster is beschermd en onder blijft fallback.`);
}

if(require.main===module)main();
module.exports={main};
