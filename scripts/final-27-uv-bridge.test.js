"use strict";
const assert=require("assert");
const u=require("./final-27-uv-bridge.js");

assert.equal(u.zichtbareUv(5.9),6);
assert.equal(u.uvOordeelVoorBron(5.9),"hoog","5,9 wordt zichtbaar 6 en moet daarom ook als hoog worden beoordeeld");
assert.equal(u.uvOordeelVoorBron(5.4),"matig");
assert.equal(u.uvOordeelVoorBron(7.6),"zeer hoog");
assert.equal(u.uvOordeelVoorBron(null),"");

console.log("Finale UV-bridge: afronding en oordeel zijn consistent.");
