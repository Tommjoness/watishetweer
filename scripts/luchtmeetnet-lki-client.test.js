"use strict";

const assert=require("assert");
const fs=require("fs");
const vm=require("vm");
const path=require("path");
const bron=fs.readFileSync(path.join(__dirname,"luchtmeetnet-lki-client.js"),"utf8");

let urls=[];
const kinderen=[];
const kaart={
  bestaandeWaarde:"42 · Europese AQI",
  appendChild(el){kinderen.push(el);el.remove=()=>{const i=kinderen.indexOf(el);if(i>=0)kinderen.splice(i,1);};}
};
const document={
  querySelector(sel){
    if(sel==="#aq .stat:first-child")return kaart;
    if(sel==="#aq .luchtmeetnet-lki")return kinderen.find(x=>x.className&&x.className.includes("luchtmeetnet-lki"))||null;
    return null;
  },
  createElement(){return {className:"",textContent:"",title:"",setAttribute(name,value){this[name]=value;}};}
};
const S={land:null,lat:null,lon:null,__luchtmeetnetLki:null};
const context={
  console,document,S,AbortController,encodeURIComponent,Number,String,Math,Promise,
  j:async url=>{urls.push(url);return {beschikbaar:true,provider:"luchtmeetnet",type:"actuele_lki",lki:3,bron:"RIVM / Luchtmeetnet"};},
  lucht(){return "basis";},
  async load(lat,lon,label,stil,opslaan,land){S.lat=lat;S.lon=lon;S.land=land;return {ok:true};}
};
context.globalThis=context;
vm.runInNewContext(bron,context,{filename:"luchtmeetnet-lki-client.js"});

assert(context.WeatherNowLuchtmeetnetLki,"client-API ontbreekt");
assert.equal(context.WeatherNowLuchtmeetnetLki.ondersteund("NL"),true);
assert.equal(context.WeatherNowLuchtmeetnetLki.ondersteund("BE"),false);

(async()=>{
  await context.load(52.35,5.26,"Almere",false,true,"NL");
  await Promise.resolve();await Promise.resolve();
  assert.equal(urls.length,1,"Nederlandse locatie moet één aanvullende LKI-request starten");
  assert(urls[0].includes("/api/luchtkwaliteit?"));
  assert(urls[0].includes("land=NL"));
  assert.equal(S.__luchtmeetnetLki.lki,3,"LKI-payload blijft beschikbaar zonder extra zichtbare schaalregel");
  assert.equal(kinderen.length,0,"de overbodige Nederlandse LKI-subcopy wordt niet meer toegevoegd");
  assert.equal(kaart.bestaandeWaarde,"42 · Europese AQI","bestaande AQI mag niet worden vervangen");

  context.lucht();
  assert.equal(kinderen.length,0,"hertekenen van de basis-AQI mag de verwijderde LKI-regel niet terugbrengen");

  urls=[];
  await context.load(50.85,4.35,"Brussel",false,true,"BE");
  await Promise.resolve();await Promise.resolve();
  assert.equal(urls.length,0,"buiten Nederland mag geen Luchtmeetnet-request starten");
  assert.equal(kinderen.length,0,"oude Nederlandse LKI moet bij locatie wisselen verdwijnen");

  console.log("Luchtmeetnet LKI-client: NL-scope en requestcyclus behouden; overbodige zichtbare LKI-subcopy verwijderd.");
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
