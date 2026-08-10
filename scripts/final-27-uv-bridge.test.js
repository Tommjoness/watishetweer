"use strict";
const assert=require("assert");
const u=require("./final-27-uv-bridge.js");

assert.equal(u.zichtbareUv(5.9),6);
assert.equal(u.uvOordeelVoorBron(5.9),"hoog","5,9 wordt zichtbaar 6 en moet daarom ook als hoog worden beoordeeld");
assert.equal(u.uvOordeelVoorBron(5.4),"matig");
assert.equal(u.uvOordeelVoorBron(7.6),"zeer hoog");
assert.equal(u.uvOordeelVoorBron(null),"");
assert.equal(u.uvTekst("2026-07-22T15:00",5.9,"2026-07-22T21:53"),"Piekte rond 15:00 · hoog.");
assert.equal(u.uvTekst("2026-07-22T15:00",5.9,"2026-07-22T09:00"),"Piek rond 15:00 · hoog.");
assert.equal(u.uvTekst("2026-07-22T15:00",0.2,"2026-07-22T09:00"),"Nauwelijks UV vandaag.");

console.log("Finale UV-bridge: afronding, oordeel en tijdsvorm zijn consistent.");
