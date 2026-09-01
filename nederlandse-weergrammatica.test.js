"use strict";
const assert=require("assert");
const g=require("./nederlandse-weergrammatica.js");

const actueel=new Map([
  ["neerslag","Er valt nu neerslag."],
  ["regen","Het regent nu."],
  ["lichte regen","Er valt nu lichte regen."],
  ["motregen","Het motregent nu."],
  ["zware motregen","Er valt nu zware motregen."],
  ["buien","Er vallen nu buien."],
  ["lichte buien","Er vallen nu lichte buien."],
  ["regenbuien","Er vallen nu regenbuien."],
  ["sneeuw","Het sneeuwt nu."],
  ["natte sneeuw","Er valt nu natte sneeuw."],
  ["sneeuwbuien","Er vallen nu sneeuwbuien."],
  ["sneeuwkorrels","Er vallen nu sneeuwkorrels."],
  ["ijzel","Er valt nu ijzel."],
  ["hagel","Het hagelt nu."],
  ["hagelbuien","Er vallen nu hagelbuien."],
  ["onweer","Het onweert nu."],
  ["onweersbuien","Er zijn nu onweersbuien."],
  ["gladde neerslag","Er valt nu gladde neerslag."]
]);
for(const [soort,verwacht] of actueel)assert.equal(g.actueleNeerslagZin(soort),verwacht,soort);

for(const soort of ["buien","lichte buien","regenbuien","sneeuwbuien","hagelbuien","onweersbuien","sneeuwkorrels"]){
  assert.equal(g.soortIsMogelijk(soort),soort.charAt(0).toUpperCase()+soort.slice(1)+" zijn mogelijk",soort);
  assert.equal(g.soortWordtVerwacht(soort),soort+" worden verwacht",soort);
  assert.equal(g.soortWordtVerwacht(soort,"het komende uur"),soort+" worden het komende uur verwacht",soort);
}
for(const soort of ["neerslag","regen","motregen","sneeuw","natte sneeuw","ijzel","hagel","onweer"]){
  assert.equal(g.soortIsMogelijk(soort),soort.charAt(0).toUpperCase()+soort.slice(1)+" is mogelijk",soort);
  assert.equal(g.soortWordtVerwacht(soort),soort+" wordt verwacht",soort);
}

assert.equal(g.minuten(1),"1 minuut");
assert.equal(g.minuten(2),"2 minuten");
assert.equal(g.uren(1),"1 uur");
assert.equal(g.uren(2),"2 uur");
assert.equal(g.graden(1),"1 graad");
assert.equal(g.graden(-1),"-1 graad");
assert.equal(g.graden(2),"2 graden");
assert.equal(g.duur(1,1),"1 uur en 1 minuut");
assert.equal(g.duur(2,2),"2 uur en 2 minuten");
assert.equal(g.duur(0,1),"1 minuut");
assert.equal(g.duurKort(1,5),"1 u 05 min");
assert.equal(g.duurKort(0,1),"1 min");

assert.equal(g.opsomming(["bewolking"]),"bewolking");
assert.equal(g.opsomming(["neerslag","bewolking"]),"neerslag en bewolking");
assert.equal(g.opsomming(["beperkt zicht","neerslag","bewolking"]),"beperkt zicht, neerslag en bewolking");
assert.equal(g.geenZichtvensterZin(["beperkt zicht","neerslag","bewolking"]),"Geen goed zichtvenster door beperkt zicht, neerslag en bewolking");

console.log("Nederlandse weergrammatica: "+actueel.size+" actuele vormen plus centrale minuut/uur/graad-formatters geslaagd.");
