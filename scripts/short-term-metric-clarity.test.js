"use strict";

const assert=require("assert");
const {
  MARK,NEERSLAG_UUR_OUD,NEERSLAG_UUR_NIEUW,GRAPH_SLEUTEL_OUD,GRAPH_SLEUTEL_NIEUW,pasKortetermijnMetricClarityToe
}=require("./apply-short-term-metric-clarity.js");

const bron='<script>\n'+NEERSLAG_UUR_OUD+'\n'+GRAPH_SLEUTEL_OUD+'\n</script>';
const uit=pasKortetermijnMetricClarityToe(bron);
assert(uit.includes(MARK),"clarity-marker ontbreekt");
assert(uit.includes(NEERSLAG_UUR_NIEUW),"nieuwe neerslag-uurowner ontbreekt");
assert(!uit.includes(NEERSLAG_UUR_OUD),"oude generieke neerslag-uurowner bleef staan");
assert(uit.includes(GRAPH_SLEUTEL_NIEUW),"zichtbare kans/hoeveelheidsleutel is niet verduidelijkt");
assert(!uit.includes(GRAPH_SLEUTEL_OUD),"oude sleutel bleef staan");
assert(uit.includes('"Neerslagverwachting komend uur"'),"forecasttegel benoemt zijn betekenis niet expliciet");
assert(uit.includes('"Neerslagkans komend uur"'),"kans-only toestand heeft geen expliciete kop");
assert(uit.includes('"Verwachte neerslag komend uur"'),"hoeveelheid-only toestand heeft geen expliciete kop");
assert(uit.includes('"Neerslag nu"'),"actuele intensiteit behoudt een eigen scope");
assert(uit.includes('if(kans!==null&&mm!==null)'),"bare Neerslag-waarde wordt niet naar beschikbare cijfers teruggebracht");
assert(uit.includes('"kans · verwacht totaal"'),"kans en hoeveelheid krijgen geen zichtbare legenda");
assert.throws(()=>pasKortetermijnMetricClarityToe(uit),/al toegepast/,"clarity-laag moet idempotentie-fouten gesloten detecteren");

console.log("Kortetermijn-metric clarity groen: geen kale Neerslag-waarde bij beschikbare cijfers en alle uur-scopekoppen zijn expliciet.");
