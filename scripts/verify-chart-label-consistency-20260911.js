"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  OUT,PLAATSINGSANKER,FALLBACKANKER,POSTPASS_MARKER,LABEL_Y_NIEUW,htmlBestanden
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
    assert(bron.includes(POSTPASS_MARKER),`${label}: veilige boven-presentatie voor lokale minima ontbreekt.`);
    assert(bron.includes("const labelPlaatsingen=gezet.map(g=>({...g}));"),`${label}: cosmetische correctie werkt niet op een losse kopie van de placement-state.`);
    assert(bron.includes("if(soort[g.i]!==-1 || g.cy<y(g.v))return;"),`${label}: boven-pass is niet beperkt tot werkelijk onder geplaatste lokale minima.`);
    assert(bron.includes("const botst=labelPlaatsingen.some(andere=>andere!==g"),`${label}: minimumlabel-pass mist collisioncontrole binnen de losse presentatielaag.`);
    assert(bron.includes("if(botst)continue;"),`${label}: botsende bovenposities worden niet veilig overgeslagen.`);
    assert(bron.includes("const labelY=new Map(labelPlaatsingen.map(g=>[g.i,g.cy]));"),`${label}: losse visuele y-map ontbreekt.`);
    assert(bron.includes(LABEL_Y_NIEUW),`${label}: temperatuurtekst gebruikt de losse visuele y-map niet.`);
    assert(!bron.includes("gezet.forEach(g=>{\n    if(soort[g.i]!==-1 || g.cy<y(g.v))return;"),`${label}: cosmetische correctie muteert nog steeds de canonieke gezet-state.`);

    /* De fix mag geen kandidaatselectie, prioriteiten of rasterherstel bevatten.
       Alleen de gekopieerde tekstpositie mag wijzigen. */
    assert(!bron.includes("plaatsRang=!M&&n<=24"),`${label}: kandidaatprioriteit is onbedoeld door de minimumlabel-fix gewijzigd.`);
    assert(!bron.includes("const ar=a.i%stap===0?0:1"),`${label}: kandidaatvolgorde is onbedoeld door de minimumlabel-fix gewijzigd.`);
    assert(!bron.includes("for(let i=stap;i<T.length;i+=stap)"),`${label}: minimumlabel-fix bevat onbedoeld rasterherstel.`);
  }
  assert(gecontroleerd>0,"Geen gebouwde weergrafiek gevonden om labelplaatsing te verifiëren.");
  console.log(`Temperatuur-labelcontract OK op ${gecontroleerd} weergrafiek-artifacts: alleen de gekopieerde tekst-y-posities kunnen wijzigen; kandidaatselectie, canonieke gezet-state, prioriteiten en raster blijven intact.`);
}

if(require.main===module)main();
module.exports={main};
