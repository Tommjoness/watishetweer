"use strict";
const assert=require("assert");
const p=require("./progressive-location.js");

const url=p.snellePreviewUrl(52.3676,4.9041);
assert(url&&url.startsWith("https://api.open-meteo.com/v1/forecast?"));
assert(url.includes("latitude=52.3676"));
assert(url.includes("longitude=4.9041"));
assert(url.includes("current=temperature_2m%2Capparent_temperature%2Cis_day%2Cweather_code")||url.includes("current=temperature_2m,apparent_temperature,is_day,weather_code"));
assert(url.includes("timezone=auto"));
assert(!url.includes("hourly="),"snelle preview mag geen zware uurreeks opvragen");
assert(!url.includes("daily="),"snelle preview mag geen weekdata opvragen");
assert(!url.includes("minutely_15="),"snelle preview mag geen kwartierdata opvragen");
assert.equal(p.snellePreviewUrl(null,4.9),null);

assert.deepEqual(
  p.normaliseerSnellePreview({timezone:"Europe/Amsterdam",current:{temperature_2m:21.6,apparent_temperature:22.4,is_day:1,weather_code:1}}),
  {temperatuur:22,gevoel:22,code:1,isDag:true,tijdzone:"Europe/Amsterdam"}
);
assert.deepEqual(
  p.normaliseerSnellePreview({timezone:"Asia/Seoul",current:{temperature_2m:19.4,apparent_temperature:null,is_day:0,weather_code:3}}),
  {temperatuur:19,gevoel:null,code:3,isDag:false,tijdzone:"Asia/Seoul"}
);
assert.equal(p.normaliseerSnellePreview({current:{temperature_2m:null,is_day:1,weather_code:1}}),null,"ontbrekende temperatuur mag geen 0 °C-preview geven");
assert.equal(p.normaliseerSnellePreview({current:{temperature_2m:20,is_day:2,weather_code:1}}),null,"ongeldige dag/nachtstatus wordt niet gepresenteerd");
assert.equal(p.SNEL_START_VERTRAGING_MS,120);
assert.equal(p.SNEL_TIMEOUT_MS,3000);

console.log("Progressieve locatielading: current-only previewcontract geslaagd.");
