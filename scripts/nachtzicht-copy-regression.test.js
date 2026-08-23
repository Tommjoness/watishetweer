"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
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

/* De canonieke Nachtzicht-berekening moet maanverlichting én de werkelijke
   hoogte boven de horizon blijven gebruiken. De screenshotpolish verandert
   alleen de presentatie en mag dit inhoudelijke beleid niet loskoppelen. */
const bron=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
assert(bron.includes("const maanWeging=maanH.map(h2=>h2<=0?0:Math.min(1,Math.sin(h2*Math.PI/180)/Math.sin(45*Math.PI/180)));"),
  "maanhoogte blijft onderdeel van de effectieve lichtweging");
assert(bron.includes("sc-=2.2*mn.ill*maanDeel*(1-cw/140);"),
  "de totale Nachtzicht-score blijft maanlicht meewegen");
assert(bron.includes("const goed = C[i]<35 && (maanWeging[i]*mn.ill < 0.2);"),
  "beste kijkvenster vereist naast weinig bewolking ook weinig effectief maanlicht");

const maanWeging=hoogte=>hoogte<=0?0:Math.min(1,Math.sin(hoogte*Math.PI/180)/Math.sin(45*Math.PI/180));
const kijkuurGoed=(bewolking,verlicht,hoogte)=>bewolking<35&&maanWeging(hoogte)*verlicht<0.2;
const maanStraf=(verlicht,hoogtes,bewolking)=>{
  const deel=hoogtes.map(maanWeging).reduce((a,b)=>a+b,0)/hoogtes.length;
  return 2.2*verlicht*deel*(1-bewolking/140);
};
assert.equal(kijkuurGoed(5,1,45),false,"volle maan hoog aan de hemel blokkeert een verder helder kijkuur");
assert.equal(kijkuurGoed(5,0.82,30),false,"82% verlichte maan op 30 graden blijft inhoudelijk relevant");
assert.equal(kijkuurGoed(5,0.82,-1),true,"na maanondergang vervalt de maanlichtbelemmering");
assert.equal(kijkuurGoed(70,0,-10),false,"zware bewolking blijft ongunstig zonder maanlicht");
assert(maanStraf(1,[45,45,45],5)>maanStraf(0,[45,45,45],5),"volle maan verlaagt de score meer dan nieuwe maan");
assert.equal(maanStraf(1,[-5,-10,-20],5),0,"maan onder de horizon geeft geen kunstmatige scorestraf");
/* Een zeer laag staande maan weegt volgens het bestaande beleid geleidelijk
   minder zwaar. Een gunstig venster kan daardoor iets vóór de geometrische
   maanondergang beginnen; dat is expliciet modelgedrag, geen tijdzonefout. */
assert.equal(kijkuurGoed(5,0.82,5),true,"zeer lage 82%-maan kan onder de effectieve lichtdrempel vallen");

console.log("Nachtzicht-copyregressie groen: actief venster, horizonzinnen, verre onzekerheid en maanweging kloppen.");
