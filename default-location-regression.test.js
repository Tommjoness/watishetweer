"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");

const gedeeld=html.indexOf('const la=parseFloat(p.get("lat")),lo=parseFloat(p.get("lon"));');
const hier=html.indexOf('if(p.get("hier")){ locatieNu("hier"); return; }');
const opgeslagen=html.indexOf('const v=ls.get(KEY_P,null);');
const amsterdam=html.indexOf('load(52.3676,4.9041,"Amsterdam",false,true,"NL");');

assert.ok(gedeeld>=0,"gedeelde-linkroute ontbreekt");
assert.ok(hier>gedeeld,"Mijn locatie hoort na een gedeelde link");
assert.ok(opgeslagen>hier,"opgeslagen plaats hoort na Mijn locatie");
assert.ok(amsterdam>opgeslagen,"Amsterdam mag alleen de laatste fallback voor een eerste bezoek zijn");
assert.ok(html.includes('q.value="Amsterdam";'),"zoekveld toont Amsterdam bij eerste bezoek");
assert.ok(!html.includes('st0.textContent="Zoek hierboven een plaats of kies ‘Mijn locatie’.";'),
  "oude lege eerste-bezoekstaat mag niet in de productie-output blijven");

console.log("Default-locatieregressie: Amsterdam is uitsluitend de eerste-bezoekfallback.");
