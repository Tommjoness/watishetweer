"use strict";
const assert=require("assert");
const c=require("./final-copy-polish.js");
assert.equal(c.pollenKop("Pollen gras"),"Graspollen");
assert.equal(c.pollenKop("Pollen bijvoet"),"Bijvoetpollen");
assert.equal(c.pollenKop("Pollen berk"),"Berkenpollen");
assert.equal(c.pollenKop("Pollen"),"Pollen");
console.log("Finale Nederlandse microcopy: regressies geslaagd.");
