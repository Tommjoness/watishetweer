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

console.log("Nachtzicht-copyregressie groen: horizonzinnen beginnen correct en verre verwachting blijft onzeker.");
