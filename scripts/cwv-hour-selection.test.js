"use strict";
const assert=require("assert");
const {komendeUurRijen,formatTemp}=require("./final-desktop-ui-runtime-20260902.js");
const {normaliseerRouteAppStart}=require("./release-recovery-finalize.js");
function data(zone,offset,start){
  const instants=Array.from({length:30},(_,i)=>start+i*3600000);
  return {timezone:zone,utc_offset_seconds:offset,hourly:{time:instants.map(ms=>new Date(ms+offset*1000).toISOString().slice(0,16)),temperature_2m:instants.map((_,i)=>i===2?null:i),apparent_temperature:instants.map((_,i)=>i===3?null:i-1)}};
}
for(const [zone,offset,start,first,next] of [
  ["Europe/Amsterdam",7200,"2026-07-22T20:00:00Z","2026-07-22T23:00","2026-07-23T00:00"],
  ["America/New_York",-14400,"2026-07-23T02:00:00Z","2026-07-22T23:00","2026-07-23T00:00"],
  ["Asia/Tokyo",32400,"2026-07-22T13:00:00Z","2026-07-22T23:00","2026-07-23T00:00"],
  ["Asia/Kathmandu",20700,"2026-07-22T16:15:00Z","2026-07-22T23:00","2026-07-23T00:00"]
]){
  const epoch=Date.parse(start),d=data(zone,offset,epoch),original=JSON.stringify(d);
  const before=komendeUurRijen(d,epoch+3599000,8),after=komendeUurRijen(d,epoch+3601000,8);
  assert.equal(before.length,8);assert.equal(after.length,8);
  assert.equal(before[0].tijd,first);assert.equal(after[0].tijd,next);
  assert.equal(after[0].bronIndex,before[0].bronIndex+1,"uurwisseling schuift precies één bronrecord door");
  assert(after[0].datumLabel,"middernacht behoudt lokale datumcontext");
  assert.equal(after[0].temp,null,"ontbrekende temperatuur blijft null zonder uur over te slaan");
  assert.equal(after[1].gevoel,null,"ontbrekend gevoel blijft null");
  assert.equal(formatTemp(after[0].temp),"–");
  assert.equal(formatTemp(0),"0 °C");
  assert.equal(JSON.stringify(d),original,"selectie mag providerdata niet veranderen");
  for(let i=1;i<after.length;i++)assert.equal(Date.parse(after[i].instant)-Date.parse(after[i-1].instant),3600000);
}
const herfst=data("Europe/Amsterdam",7200,Date.parse("2026-10-24T23:00:00Z"));
const dubbel=komendeUurRijen(herfst,Date.parse("2026-10-24T23:30:00Z"),8);
assert.equal(dubbel[0].tijd,"2026-10-25T02:00");assert.equal(dubbel[1].tijd,"2026-10-25T02:00");
assert.notEqual(dubbel[0].instant,dubbel[1].instant,"herhaalde lokale kloktijd zijn twee unieke instanties");
assert.equal(Date.parse(dubbel[1].instant)-Date.parse(dubbel[0].instant),3600000);
const voorjaar=komendeUurRijen(data("Europe/Amsterdam",3600,Date.parse("2026-03-29T00:00:00Z")),Date.parse("2026-03-29T00:30:00Z"),8);
assert.equal(voorjaar[0].tijd,"2026-03-29T03:00","niet-bestaand civiel 02:00 mag niet worden getoond");
const kapot=JSON.parse(JSON.stringify(herfst));kapot.hourly.time[3]=kapot.hourly.time[2];
assert.deepEqual(komendeUurRijen(kapot,Date.parse("2026-10-24T23:30:00Z"),8),[],"dubbele providerinstanties falen gesloten");
assert.deepEqual(komendeUurRijen({...herfst,utc_offset_seconds:null},Date.now()),[]);
assert.deepEqual(komendeUurRijen(null,Date.now()),[]);
const root='<main id="app" tabindex="-1" style="visibility:hidden"></main>';
const route='<main id="app" tabindex="-1" style="display:none"></main><section class="seo-route-context">Amsterdam</section>';
assert.equal(normaliseerRouteAppStart(route,root,"amsterdam"),route.replace("display:none","visibility:hidden"));
assert.throws(()=>normaliseerRouteAppStart(route,root.replace("visibility:hidden","display:none"),"amsterdam"),/startgeometrie/);
assert.throws(()=>normaliseerRouteAppStart(route+route,root,"amsterdam"),/één main/);
console.log("CWV uurselectie: lokale uur-/middernachtwissel, New York/Tokyo/Kathmandu, beide DST-overgangen, null/zero en identieke gereserveerde routeshell groen.");
