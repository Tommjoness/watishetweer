"use strict";
const assert=require("node:assert/strict");
const t=require("../lib/waarschuwing-vertaling.cjs");
const source="Aviso por viento fuerte. Rachas de 75-90 km/h.";
const value="Waarschuwing voor harde wind. Windstoten van 75-90 km/u.";
const base={bron:"MeteoAlarm spain",dekking:true,lijst:[{titel:"Code geel: wind",taal:"es-ES",tekst:source,plaatsSpecifiek:true}]};
const enabled={DEEPL_TRANSLATE_ENABLED:"1",DEEPL_API_KEY:"FAKE_KEY_NOT_FOR_NETWORK"};
(async()=>{
  assert.equal(t.WAARSCHUWINGVERTALING_VRIJGEGEVEN,false,
    "geen automatische waarschuwingvertaling zonder onafhankelijke review");
  assert.equal(t.brontaal({taal:"fr-FR"},base.bron),"FR");
  assert.equal(t.brontaal({taal:"<script>"},base.bron),null);
  assert.equal(t.brontaal({},"National Weather Service"),"EN");
  assert(t.veilig(source,value),"zelfde cijfers en eenheden");
  assert(!t.veilig("75-90 km/h","76-90 km/h"),"gewijzigde getallen geweigerd");
  assert(!t.veilig("75-90 km/h","75-90 mph"),"gewijzigde eenheid geweigerd");
  assert(!t.veilig("−5 °C","5 °C"),"verdwenen minteken is een veiligheidsfout");
  assert(!t.veilig("+5 °C","5 °C"),"verdwenen plusteken is een veiligheidsfout");
  assert(t.veilig("Van 75–90 km/h","Van 75-90 km/u"),"typografisch streepje is geen gewijzigd bereik");
  assert(!t.veilig("10 mm","<b>10 mm</b>"),"HTML is niet toegestaan");
  const provider=()=>{throw Error("DeepL mag niet worden aangeroepen");};
  for(const env of [
    enabled,null,{}, {DEEPL_TRANSLATE_ENABLED:"0",DEEPL_API_KEY:"TEST"},
    {DEEPL_TRANSLATE_ENABLED:"1"}
  ]){
    assert.strictEqual(await t.vertaalWaarschuwingen(base,env,{fetcher:provider}),base,
      "officiële waarschuwing ongewijzigd");
  }
  assert.strictEqual(await t.vertaalWaarschuwingen(base,enabled,{taal:"en",fetcher:provider}),base);
  assert.equal(base.lijst[0].vertaling,undefined,"geen mutatie of machinevertaling");
  const wrong={...base,lijst:[{...base.lijst[0],tekst:"Do not travel tonight. Stay indoors.",taal:"en-US"}]};
  assert.strictEqual(await t.vertaalWaarschuwingen(wrong,enabled,{fetcher:provider}),wrong);
  const many={...base,lijst:Array.from({length:8},(_,i)=>({...base.lijst[0],tekst:"Aviso "+i+" por viento 75-90 km/h."}))};
  assert.strictEqual(await t.vertaalWaarschuwingen(many,enabled,{fetcher:provider}),many);
  const cache={match:()=>{throw Error("geen vertaalcache lezen");},put:()=>{throw Error("geen vertaalcache vullen");}};
  assert.strictEqual(await t.vertaalWaarschuwingen(base,enabled,{fetcher:provider,cache}),base);
  console.log("Waarschuwingsvertaling: harde publicatieblokkade, nul DeepL-requests, bron ongewijzigd.");
})().catch(e=>{console.error(e);process.exitCode=1});
