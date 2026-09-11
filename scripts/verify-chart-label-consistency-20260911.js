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
    assert(bron.includes(PLAATSINGSANKER),`${label}: bestaande boven/onder-voorkeur ontbreekt.`);
    assert(bron.includes(FALLBACKANKER),`${label}: bestaande collision/rand-fallback naar beide zijden ontbreekt.`);
    assert(bron.includes(POSTPASS_MARKER),`${label}: veilige boven-pass voor lokale minima ontbreekt.`);
    assert(bron.includes("if(soort[g.i]!==-1 || g.cy<y(g.v))return;"),`${label}: boven-pass is niet beperkt tot werkelijk onder geplaatste lokale minima.`);
    assert(bron.includes("const botst=gezet.some(andere=>andere!==g"),`${label}: minimumlabel-pass mist collisioncontrole tegen de definitieve labelset.`);
    assert(bron.includes("if(botst)continue;"),`${label}: botsende bovenposities worden niet veilig overgeslagen.`);
    assert(bron.includes("g.cy=kandidaat;"),`${label}: vrije bovenpositie wordt niet toegepast.`);
    assert(bron.includes("if(k.rang<=1) return;"),`${label}: bestaande fallback voor gewone kandidaten is onbedoeld verwijderd.`);

    assert(bron.includes("if(!M&&n<=24){"),`${label}: desktop-24u rasterprioriteit ontbreekt.`);
    assert(bron.includes("const ar=a.i%stap===0?0:1,br=b.i%stap===0?0:1;"),`${label}: desktop-raster wordt niet vóór extra extrema geplaatst.`);
    assert(bron.includes("if(ar!==br)return ar-br;"),`${label}: vaste rastervolgorde wordt niet toegepast.`);
    assert(bron.includes("return b.rang-a.rang||a.i-b.i;"),`${label}: bestaande prioriteitsvolgorde voor overige kandidaten ontbreekt.`);
    assert(bron.includes("const plaatsRang=!M&&n<=24&&i%stap===0?Math.max(4,k.rang):k.rang;"),`${label}: vaste desktop-rasterpunten zijn niet beschermd tegen latere evictie.`);
    assert(bron.includes("rang:plaatsRang"),`${label}: beschermde plaatsingsrang wordt niet in de definitieve labelset gebruikt.`);

    assert(bron.includes("for(let i=stap;i<T.length;i+=stap){"),`${label}: gerichte desktop-rasterreconciliatie ontbreekt.`);
    assert(bron.includes("!kandKaart.has(i)||gezet.some(g=>g.i===i)"),`${label}: rasterreconciliatie is niet beperkt tot werkelijk ontbrekende kandidaatpunten.`);
    assert(bron.includes("let herstel=probeerRaster(null);"),`${label}: rasterherstel probeert niet eerst collisionvrij zonder labels te verwijderen.`);
    assert(bron.includes("if(!herstel)herstel=probeerRaster(3);"),`${label}: rasterherstel kan lokale extra-labels niet gecontroleerd laten wijken.`);
    assert(bron.includes("for(const blokkeerder of herstel.poging.verwijderd||[])"),`${label}: door collisionplacer vrijgegeven lagere-ranglabels worden niet gericht verwijderd.`);
    assert(bron.includes("rang:Math.max(4,kandKaart.get(i)||1)"),`${label}: hersteld rasterpunt krijgt geen blijvende rasterbescherming.`);
    assert(!bron.includes("if(T.length<=25){"),`${label}: oude mobiel-meerakende rasterherstelroute staat nog actief.`);
  }
  assert(gecontroleerd>0,"Geen gebouwde weergrafiek gevonden om labelplaatsing te verifiëren.");
  console.log(`Temperatuur-labelcontract OK op ${gecontroleerd} weergrafiek-artifacts: lokale minima verhuizen alleen collisionvrij naar boven; desktop 24 uur plaatst, beschermt en zo nodig herstelt het vaste drie-uursraster zonder mobiele dichtheidswijziging.`);
}

if(require.main===module)main();
module.exports={main};
