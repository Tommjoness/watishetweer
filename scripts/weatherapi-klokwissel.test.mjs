import assert from "node:assert/strict";
import { createRequire } from "node:module";
import worker from "../api/forecast.mjs";
import { normaliseerWeatherApi, geldigeGenormaliseerdeForecast } from "../lib/weatherapi-forecast.mjs";
import { SCENARIOS, weatherApiPayload, epochVan, lokaal, volgendeDatum } from "./klokwissel-fixtures.mjs";

/* WeatherAPI-adapter rond klokwissels (noodbron na Visual Crossing).

   Zelfde contract als bij Visual Crossing: alle tijden van één antwoord staan
   op één vaste afwijking (utc_offset_seconds); een tijdtekst plus die afwijking
   is het echte moment. WeatherAPI geeft lokale kloktijden ("2026-10-25 02:00")
   en bij ieder uur time_epoch. De afwijking klopte al (die van het moment van
   opvragen), maar de kloktijden stonden onveranderd in het antwoord: bevat het
   venster een klokwissel, dan staan de uren erna een uur te vroeg of te laat.

   WeatherAPI is niet live getest (geen sleutel). De vorm van de data volgt de
   API-documentatie; de test dekt dus het gedrag van de adapter, niet de levering
   van WeatherAPI zelf. */

const engine = createRequire(import.meta.url)("../interpretatie-engine.js");
const zichtbaar = (tijd, data) => engine.minutenNaarLokaal(
  engine.providerNaarMinuten(tijd, data.utc_offset_seconds), data.timezone, data.utc_offset_seconds);
const alsMoment = (tijd, data) => Date.parse(`${tijd}:00Z`) / 1000 - data.utc_offset_seconds;

for (const uren24 of [false, true]) {
  for (const s of SCENARIOS) {
    const nu = epochVan(s.nu);
    const payload = weatherApiPayload({ timezone: s.timezone, nuEpochS: nu, startDatum: s.start, uren24 });
    const invoer = payload.forecast.forecastday.flatMap(dag => dag.hour.map(uur => uur.time_epoch)).sort((a, b) => a - b);
    const data = normaliseerWeatherApi(payload);
    const label = `${s.naam}${uren24 ? " (24 klokuren per dag)" : ""}`;

    assert.equal(geldigeGenormaliseerdeForecast(data), true, `${label}: antwoord is geldig`);
    assert.equal(data.utc_offset_seconds, s.offset, `${label}: één vaste afwijking die op het moment van opvragen geldt`);
    assert.equal(data.hourly.time.length, invoer.length, `${label}: ieder uur van de bron blijft bewaard`);
    assert.equal(new Set(data.hourly.time).size, data.hourly.time.length, `${label}: geen dubbele tijdteksten`);
    assert.deepEqual(data.hourly.time.map(t => alsMoment(t, data)), invoer, `${label}: iedere uurtekst plus de afwijking is precies het bronmoment`);
    data.hourly.time.forEach((t, i) => {
      assert.equal(data.hourly.temperature_2m[i], new Date(invoer[i] * 1000).getUTCHours(), `${label}: waarde ${i} hoort bij zijn eigen moment`);
      assert.equal(zichtbaar(t, data), lokaal(invoer[i], s.timezone).tijd, `${label}: uur ${i} wordt in de lokale tijd van de plaats getoond`);
    });
    const dagen = Array.from({ length: 7 }, (_, i) => volgendeDatum(s.start, i));
    assert.deepEqual(data.daily.time, dagen, `${label}: zeven lokale kalenderdagen`);
    dagen.forEach((datum, i) => {
      assert.equal(zichtbaar(data.daily.sunrise[i], data), `${datum}T07:15`, `${label}: zonsopkomst ${datum} in lokale tijd`);
      assert.equal(zichtbaar(data.daily.sunset[i], data), `${datum}T17:30`, `${label}: zonsondergang ${datum} in lokale tijd`);
    });
    assert.equal(zichtbaar(data.current.time, data), lokaal(nu, s.timezone).tijd, `${label}: lokale tijd nu`);
  }
}

/* Het uur van gisteren (history.json) hoort in dezelfde tijdas, ook over een wissel heen. */
{
  const nu = epochVan("2026-10-25T09:37:00Z");
  const payload = weatherApiPayload({ timezone: "Europe/Amsterdam", nuEpochS: nu, startDatum: "2026-10-25" });
  const historie = { forecast: { forecastday: weatherApiPayload({ timezone: "Europe/Amsterdam", nuEpochS: nu, startDatum: "2026-10-24", dagen: 1 }).forecast.forecastday } };
  const data = normaliseerWeatherApi(payload, historie);
  const invoer = [...historie.forecast.forecastday, ...payload.forecast.forecastday].flatMap(dag => dag.hour.map(uur => uur.time_epoch)).sort((a, b) => a - b);
  assert.deepEqual(data.hourly.time.map(t => alsMoment(t, data)), invoer, "gisteren plus zeven dagen, ieder uur op zijn moment");
  assert.equal(data.hourly.time.length, 24 + 25 + 6 * 24);
}

/* Ontbreekt time_epoch of past het niet bij de kloktekst, dan telt de kloktijd met de IANA-zone. */
{
  const nu = epochVan("2026-10-24T10:00:00Z");
  const metEpoch = normaliseerWeatherApi(weatherApiPayload({ timezone: "Europe/Amsterdam", nuEpochS: nu, startDatum: "2026-10-24", uren24: true }));
  const payload = weatherApiPayload({ timezone: "Europe/Amsterdam", nuEpochS: nu, startDatum: "2026-10-24", uren24: true });
  payload.forecast.forecastday.forEach(dag => dag.hour.forEach((uur, i) => { if (i % 2) delete uur.time_epoch; else uur.time_epoch = 1788652800; }));
  const afgeleid = normaliseerWeatherApi(payload);
  assert.deepEqual(afgeleid.hourly.time, metEpoch.hourly.time);
  assert.deepEqual(afgeleid.hourly.temperature_2m, metEpoch.hourly.temperature_2m);
}

/* De daadwerkelijke noodroute /api/forecast, met Visual Crossing buiten bedrijf. */
{
  const origineel = globalThis.fetch;
  try {
    const nu = epochVan("2026-10-25T09:37:00Z");
    globalThis.fetch = async url => {
      const historie = String(url).includes("history.json");
      const payload = weatherApiPayload({ timezone: "Europe/Amsterdam", nuEpochS: nu, startDatum: historie ? "2026-10-24" : "2026-10-25", dagen: historie ? 1 : 7 });
      return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const response = await worker.fetch(
      new Request("https://watishetweer.nl/api/forecast?lat=52.3676&lon=4.9041"),
      { WEATHERAPI_KEY: "test-key" }
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-wiw-weather-source"), "weatherapi");
    const body = await response.json();
    assert.equal(body.utc_offset_seconds, 3600);
    assert.equal(zichtbaar(body.daily.sunset[0], body), "2026-10-25T17:30");
    assert.equal(zichtbaar(body.daily.sunrise[1], body), "2026-10-26T07:15");
  } finally {
    globalThis.fetch = origineel;
  }
}

console.log(`WeatherAPI klokwissels: ${SCENARIOS.length} situaties met volledige en met 24-uurs dagen, uren zonder verlies in één vaste tijdas, zon en nu in lokale tijd, en de echte noodroute /api/forecast groen.`);
