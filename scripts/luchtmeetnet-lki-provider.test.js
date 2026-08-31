"use strict";

const assert=require("assert");
const {haalLki,_intern}=require("../lib/luchtmeetnet-lki.cjs");
const NU=Date.parse("2026-08-31T18:00:00Z");

function antwoord(data,status=200){
  return {ok:status>=200&&status<300,status,async json(){return {data};}};
}

(async()=>{
  _intern.leegCache();
  let calls=0;
  const fetchImpl=async url=>{
    calls++;
    assert(url.includes("formula=lki"));
    assert(url.includes("latitude=52.35"));
    assert(url.includes("longitude=5.26"));
    return antwoord([
      {formula:"LKI",value:2.4,timestamp_measured:"2026-08-31T17:00:00Z"},
      {formula:"LKI",value:8.8,timestamp_measured:"2026-08-31T19:00:00Z"},
      {formula:"LKI",value:3.4,timestamp_measured:"2026-08-31T18:00:00Z"}
    ]);
  };
  const a=await haalLki({lat:52.35,lon:5.26,land:"nl",fetchImpl,nuMs:NU});
  assert.equal(a.beschikbaar,true);
  assert.equal(a.provider,"luchtmeetnet");
  assert.equal(a.type,"actuele_lki");
  assert.equal(a.lki,3,"meest recente niet-toekomstige waarde wordt als LKI 1–11 afgerond");
  assert.equal(a.lkiRaw,3.4);
  assert.equal(a.geldigOp,"2026-08-31T18:00:00.000Z");
  assert.equal(calls,1);

  const b=await haalLki({lat:52.35001,lon:5.26001,land:"NL",fetchImpl,nuMs:NU+60_000});
  assert.equal(b.beschikbaar,true);
  assert.equal(b.cache,"memory","equivalente lokale punten delen de korte Fair-Use-cache");
  assert.equal(calls,1,"cachehit mag upstream niet opnieuw aanroepen");

  _intern.leegCache();
  let buitenlandCalls=0;
  const buiten=await haalLki({lat:50.85,lon:4.35,land:"BE",fetchImpl:async()=>{buitenlandCalls++;return antwoord([]);},nuMs:NU});
  assert.equal(buiten.beschikbaar,false);
  assert.equal(buiten.provider,null);
  assert.equal(buitenlandCalls,0,"niet-Nederlandse locaties mogen Luchtmeetnet niet aanroepen");

  _intern.leegCache();
  const oud=await haalLki({lat:52.35,lon:5.26,land:"NL",fetchImpl:async()=>antwoord([
    {formula:"LKI",value:4,timestamp_measured:"2026-08-31T14:00:00Z"},
    {formula:"LKI",value:5,timestamp_measured:"2026-08-31T19:00:00Z"}
  ]),nuMs:NU});
  assert.equal(oud.beschikbaar,false,"oude en duidelijke toekomstige waarden mogen niet als actueel verschijnen");

  _intern.leegCache();
  const kapot=await haalLki({lat:52.35,lon:5.26,land:"NL",fetchImpl:async()=>{throw new Error("offline");},nuMs:NU});
  assert.equal(kapot.beschikbaar,false);
  assert.equal(kapot.provider,"luchtmeetnet");

  const ongeldig=await haalLki({lat:"x",lon:5.26,land:"NL",fetchImpl:async()=>{throw new Error("mag niet");},nuMs:NU});
  assert.equal(ongeldig.reden,"ongeldige coördinaten");

  console.log("Luchtmeetnet LKI-provider: semantiek, freshness, scope en cache geslaagd.");
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
