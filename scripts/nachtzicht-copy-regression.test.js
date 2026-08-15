"use strict";

const assert=require("assert");
const p=require("./mobile-screenshot-polish.js");

assert.equal(
  p.corrigeerNachtVensterBron("Beste periode 22:00–04:00",3,7,{zonsopkomst:"06:25"}),
  "Beste periode van de avond tot de nacht.",
  "horizon 3 begint als volwaardige Nederlandse zin"
);
assert.equal(
  p.corrigeerNachtVensterBron("Beste periode 22:00–04:00",3,2,{zonsopkomst:"06:25"}),
  "Relatief beste periode van de avond tot de nacht.",
  "lage score houdt ook op horizon 3 een volwaardige zin"
);
assert.equal(
  p.corrigeerNachtVensterBron("Beste periode 22:00–04:00",5,7,{zonsopkomst:"06:25"}),
  "Waarschijnlijk beste periode van de avond tot de nacht.",
  "verre horizon blijft expliciet onzeker"
);
assert.equal(
  p.corrigeerNachtVensterBron("Beste periode 00:57–07:00",0,8,{zonsopkomst:"06:25",nuTijd:"00:57"}),
  "Beste periode: nu tot 06:00.",
  "de actieve eerste nacht benoemt het venster relatief aan nu"
);
assert.equal(
  p.corrigeerNachtVensterBron("Beste periode: 00:57–07:00",0,8,{zonsopkomst:"06:25",nuTijd:"00:58"}),
  "Beste periode: nu tot 06:00.",
  "een reeds genormaliseerde dubbelepuntvariant blijft actief herkenbaar"
);

console.log("Nachtzicht-copyregressie groen: actief venster, horizonzinnen en verre onzekerheid kloppen.");