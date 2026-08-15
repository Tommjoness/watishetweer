"use strict";

const assert=require("assert");
const fs=require("fs");
const vm=require("vm");
const path=require("path");

const bron=fs.readFileSync(path.join(__dirname,"extra-neerslagproviders.js"),"utf8");
let urls=[];
const S={land:null,lat:null,lon:null,d:null};
const context={
  console,
  S,
  document:{},
  setTimeout:()=>0,
  clearTimeout:()=>{},
  AbortController,
  encodeURIComponent,
  Number,
  String,
  Promise,
  j:async url=>{urls.push(url);return {beschikbaar:false};},
  load:async function(lat,lon,label,stil,opslaan,land){
    S.lat=lat;S.lon=lon;S.land=land;S.d={current:{weather_code:3,is_day:1}};
    return {ok:true};
  }
};
context.globalThis=context;
vm.runInNewContext(bron,context,{filename:"extra-neerslagproviders.js"});

assert(context.WeatherNowExtraNeerslagproviders,"client-API ontbreekt");
assert.equal(context.WeatherNowExtraNeerslagproviders.ondersteund("BE"),true);
assert.equal(context.WeatherNowExtraNeerslagproviders.ondersteund("be"),true);
assert.equal(context.WeatherNowExtraNeerslagproviders.ondersteund("NL"),false);
assert.equal(context.WeatherNowExtraNeerslagproviders.ondersteund("DE"),false);
assert.deepEqual(Array.from(context.WeatherNowExtraNeerslagproviders.landen),["BE"]);

(async()=>{
  urls=[];
  await context.load(50.8503,4.3517,"Brussel",false,true,"BE");
  await Promise.resolve();await Promise.resolve();
  assert.equal(urls.length,1,"Belgische locatie moet precies één providerrequest starten");
  assert(urls[0].includes("lat=50.8503"),urls[0]);
  assert(urls[0].includes("lon=4.3517"),urls[0]);
  assert(urls[0].includes("land=BE"),urls[0]);

  urls=[];
  await context.load(50.1109,8.6821,"Frankfurt",false,true,"DE");
  await Promise.resolve();await Promise.resolve();
  assert.equal(urls.length,0,"Niet-ondersteund land mag geen extra providerrequest starten");

  console.log("Extra neerslagproviders: Belgische clientselectie en expliciete landcode geslaagd.");
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
