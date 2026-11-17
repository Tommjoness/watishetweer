"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");

const gedeeld=html.indexOf('const la=parseFloat(p.get("lat")),lo=parseFloat(p.get("lon"));');
const hier=html.indexOf('if(p.has("hier")){');
const opgeslagen=html.indexOf('const v=ls.get(KEY_P,null);');
const amsterdam=html.indexOf('load(52.3676,4.9041,"Amsterdam",false,true,"NL");');

assert.ok(gedeeld>=0,"gedeelde-linkroute ontbreekt");
assert.ok(hier>gedeeld,"de snelkoppeling markeert alleen de locatieknop");
assert.ok(opgeslagen>hier,"opgeslagen plaats hoort na Mijn locatie");
assert.ok(amsterdam>opgeslagen,"Amsterdam mag alleen de laatste fallback voor een eerste bezoek zijn");
assert.ok(html.includes('q.value="Amsterdam";'),"zoekveld toont Amsterdam bij eerste bezoek");
assert.ok(!html.includes('st0.textContent="Zoek hierboven een plaats of kies ‘Mijn locatie’.";'),
  "oude lege eerste-bezoekstaat mag niet in de productie-output blijven");

const {laadKern}=require("./kern.js");
let gps=0, naamAanvragen=0;
const {doc}=laadKern(1280,{
  zoek:"?hier=1",
  permissieStatus:"granted",
  geo:gelukt=>{gps++;gelukt({coords:{latitude:52.5,longitude:5.5,accuracy:15}});},
  fetch:async url=>{
    if(String(url).includes("bigdatacloud.net"))naamAanvragen++;
    return {ok:false,status:503,json:async()=>({})};
  }
});
assert.strictEqual(gps,0,"navigatie mag ook bij bestaande browsermachtiging geen GPS starten");
assert.strictEqual(naamAanvragen,0,"navigatie deelt geen positie met BigDataCloud");
const knop=doc.getElementById("here");
knop.dispatchEvent({type:"click",target:knop});
assert.strictEqual(gps,1,"een klik start wel de GPS-procedure");
assert.strictEqual(naamAanvragen,1,"reverse geocoding volgt pas na bediening");
console.log("Default-locatieregressie: Amsterdam blijft laatste fallback en geolocatie vereist bediening.");
