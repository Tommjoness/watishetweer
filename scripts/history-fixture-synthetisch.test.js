"use strict";

/* De pre-sale-acceptatie valt bij een Open-Meteo-storing terug op een zelf
   opgebouwde forecast (run-production-pre-sale-acceptance-browser.js). Die moet
   dezelfde velden hebben als de echte aanvraag, plaatselijke tijden op hele uren
   in de echte tijdzone (ook +05:45) en de gevraagde lengtes. */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const bron = fs.readFileSync(path.join(__dirname, "run-production-pre-sale-acceptance-browser.js"), "utf8");
const start = bron.indexOf("  const synthetisch=(url,loc)=>{");
assert(start > 0, "synthetische fixture ontbreekt in de runner");
const eind = bron.indexOf("\n  };\n", start) + 5;
const isVolledigeBron = b => !!(b && b.timezone && b.current && b.hourly && b.daily);
const synthetisch = new Function("isVolledigeBron", bron.slice(start, eind) + "\nreturn synthetisch;")(isVolledigeBron);

const url = "https://api.open-meteo.com/v1/forecast?latitude=27.7172&longitude=85.324"
  + "&current=temperature_2m,is_day,weather_code,wind_speed_10m"
  + "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,sunshine_duration"
  + "&forecast_days=7&forecast_hours=170&timezone=auto"
  + "&minutely_15=precipitation,weather_code&forecast_minutely_15=16&past_minutely_15=4"
  + "&past_hours=24&hourly=temperature_2m,precipitation,weather_code,uv_index,is_day";

for (const loc of [
  { name: "Kathmandu", lat: 27.7172, lon: 85.324, tz: "Asia/Kathmandu" },
  { name: "Almere", lat: 52.3508, lon: 5.2647, tz: "Europe/Amsterdam" },
  { name: "Dubai", lat: 25.2048, lon: 55.2708, tz: "Asia/Dubai" }
]) {
  const b = synthetisch(url, loc);
  assert.equal(b.timezone, loc.tz, `${loc.name}: tijdzone`);
  assert.equal(b.hourly.time.length, 24 + 170, `${loc.name}: 24 uur terug en 170 vooruit`);
  assert.equal(b.minutely_15.time.length, 4 + 16, `${loc.name}: kwartieren`);
  assert.equal(b.daily.time.length, 7, `${loc.name}: zeven dagen`);
  for (const veld of ["temperature_2m", "precipitation", "weather_code", "uv_index", "is_day"]) assert.equal(b.hourly[veld].length, b.hourly.time.length, `${loc.name}: uurreeks ${veld}`);
  for (const veld of ["temperature_2m", "is_day", "weather_code", "wind_speed_10m"]) assert(veld in b.current, `${loc.name}: current.${veld}`);
  assert(b.hourly.time.every(t => /^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(t)), `${loc.name}: uurtijden op hele plaatselijke uren`);
  assert(b.minutely_15.time.every(t => /T\d{2}:(00|15|30|45)$/.test(t)), `${loc.name}: kwartiertijden`);
  const lokaalNu = new Intl.DateTimeFormat("sv-SE", { timeZone: loc.tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).format(new Date()).replace(" ", "T");
  assert.equal(b.hourly.time[24].slice(0, 13), lokaalNu.slice(0, 13), `${loc.name}: uur 24 is het huidige plaatselijke uur`);
  assert.equal(b.daily.time[0], lokaalNu.slice(0, 10), `${loc.name}: eerste dag is vandaag ter plaatse`);
}
const kathmandu = synthetisch(url, { name: "Kathmandu", lat: 27.7172, lon: 85.324, tz: "Asia/Kathmandu" });
assert.equal(kathmandu.utc_offset_seconds, 20700, "Kathmandu: +05:45");

console.log("Synthetische history-fixture: velden, lengtes, tijdzone (ook +05:45) en plaatselijke uren kloppen.");
