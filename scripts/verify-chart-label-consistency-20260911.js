"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  OUT,PLAATSINGSANKER,FALLBACKANKER,POSTPASS_MARKER,htmlBestanden
}=require("./apply-chart-label-consistency-20260911.js");

function main(){
  let gecontroleerd=0;
  for(const p of htmlBestanden(OUT)){
    const bron=fs.readFileSync(p,"utf8");
    if(!bron.includes(PLAATSINGSANKER)&&!bron.includes(POSTPASS_MARKER))continue;
    gecontroleerd++;
    const label=path.relative(OUT,p);
    assert(bron.includes(PLAATSINGSANKER),`${label}: bestaande labelselectie/-voorkeur is onbedoeld herschreven.`);
    assert(bron.includes(FALLBACKANKER),`${label}: bestaande collision/rand-fallback naar beide zijden ontbreekt.`);
    assert(bron.includes(POSTPASS_MARKER),`${label}: veilige boven-pass voor lokale minima ontbreekt.`);
    assert(bron.includes("if(soort[g.i]!==-1 || g.cy<y(g.v))return;"),`${label}: boven-pass is niet beperkt tot werkelijk onder geplaatste lokale minima.`);
    assert(bron.includes("const botst=gezet.some(andere=>andere!==g"),`${label}: minimumlabel-pass mist collisioncontrole tegen de definitieve labelset.`);
    assert(bron.includes("if(botst)continue;"),`${label}: botsende bovenposities worden niet veilig overgeslagen.`);
    assert(bron.includes("g.cy=kandidaat;"),`${label}: vrije bovenpositie wordt niet toegepast.`);
    assert(bron.includes("if(k.rang<=1) return;"),`${label}: bestaande raster-/extreemselectie is onbedoeld gewijzigd.`);
  }
  assert(gecontroleerd>0,"Geen gebouwde weergrafiek gevonden om labelplaatsing te verifiëren.");
  console.log(`Temperatuur-labelcontract OK op ${gecontroleerd} weergrafiek-artifacts: selectie/raster blijft origineel; lokale minima verhuizen alleen collisionvrij naar boven.`);
}

if(require.main===module)main();
module.exports={main};
