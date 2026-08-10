"use strict";
const assert=require("assert");
const q=require("./q1-precip-performance.js");

assert.equal(q.mmTekst(0),"0,0 mm");
assert.equal(q.mmTekst(0.04),"<0,1 mm");
assert.equal(q.mmTekst(1.44),"1,4 mm");
assert.equal(q.mmTekst(null),"");

assert.deepEqual(q.tooltipNeerslag(0,0),{kans:"0%",hoeveelheid:"",waarde:"0%"});
assert.deepEqual(q.tooltipNeerslag(8,0),{kans:"8%",hoeveelheid:"",waarde:"8%"});
assert.deepEqual(q.tooltipNeerslag(65,1.24),{kans:"65%",hoeveelheid:"1,2 mm",waarde:"65% · 1,2 mm"});
assert.deepEqual(q.tooltipNeerslag(null,1.2),{kans:"–",hoeveelheid:"1,2 mm",waarde:"– · 1,2 mm"});

const hoofd=a=>a.kans===0?"Droog":a.kans+"%";
assert.deepEqual(q.dagNeerslagPresentatie({genoeg:true,kans:60,hoeveelheid:4.8},hoofd,q.mmTekst),{hoofd:"60%",hoeveelheid:"4,8 mm"});
assert.deepEqual(q.dagNeerslagPresentatie({genoeg:true,kans:0,hoeveelheid:0},hoofd,q.mmTekst),{hoofd:"Droog",hoeveelheid:""});
assert.deepEqual(q.dagNeerslagPresentatie({genoeg:true,kans:25,hoeveelheid:0},hoofd,q.mmTekst),{hoofd:"25%",hoeveelheid:""},"0 mm mag een echte 25%-bronkans niet naar 0% veranderen");
assert.deepEqual(q.dagNeerslagPresentatie({genoeg:false,kans:null,hoeveelheid:null},()=>"–",q.mmTekst),{hoofd:"–",hoeveelheid:""});

assert.equal(q.cacheSleutel(52.367612,4.9041),"52.368,4.904");
assert.equal(q.cacheIsVers({op:1000},1000+q.CACHE_VERS_MS),true);
assert.equal(q.cacheIsVers({op:1000},1001+q.CACHE_VERS_MS),false);
const gesnoeid=q.cacheSnoei({a:{op:1},b:{op:2},c:{op:3},d:{op:4}});
assert.deepEqual(Object.keys(gesnoeid),["d","c","b"]);

console.log("Checkpoint 25%: neerslagsemantiek en performancecache geslaagd.");
