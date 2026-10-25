import assert from "node:assert/strict";
import { createRequire } from "node:module";
import worker from "../api/forecast.mjs";
import { normaliseerVisualCrossing, geldigeVisualCrossingForecast } from "../lib/visualcrossing-forecast.mjs";
import { SCENARIOS, vcPayload, epochVan, lokaal, volgendeDatum } from "./klokwissel-fixtures.mjs";

/* Visual Crossing-adapter rond klokwissels.

   Contract van de site (interpretatie-engine.js, index.html): alle tijden van
   één antwoord staan op één vaste afwijking, utc_offset_seconds, ook over een
   klokwissel heen, zoals Open-Meteo dat doet. Een tijdtekst plus die afwijking
   is dan het echte moment; pas het tonen gaat via de IANA-zone naar de lokale
   tijd. De reserveroute moest dit ook doen. Zij gaf wel de lokale kloktijd van
   Visual Crossing door, maar met tzoffset als afwijking. Live gemeten op 25
   oktober 2026, 10:37: utc_offset_seconds 7200 bij tijden in wintertijd, dus
   zon onder 16:24 in plaats van 17:24 en een uurtabel die een uur opschuift.

   Deze test volgt het hele pad: Visual Crossing-vormige data, de adapter, en
   dan de omrekening die de site zelf doet naar de lokale tijd van de plaats. */

const engine = createRequire(import.meta.url)("../interpretatie-engine.js");

/* Wat de bezoeker ziet voor een tijdtekst uit het antwoord. */
const zichtbaar = (tijd, data) => engine.minutenNaarLokaal(
  engine.providerNaarMinuten(tijd, data.utc_offset_seconds), data.timezone, data.utc_offset_seconds);
const alsMoment = (tijd, data) => Date.parse(`${tijd}:00Z`) / 1000 - data.utc_offset_seconds;

for (const s of SCENARIOS) {
  const nu = epochVan(s.nu);
  const payload = vcPayload({ timezone: s.timezone, nuEpochS: nu, startDatum: s.start });
  const invoer = payload.days.flatMap(dag => dag.hours.map(uur => uur.datetimeEpoch)).sort((a, b) => a - b);
  const data = normaliseerVisualCrossing(payload);
  const label = s.naam;

  assert.equal(geldigeVisualCrossingForecast(data), true, `${label}: antwoord is geldig`);
  assert.equal(data.utc_offset_seconds, s.offset, `${label}: één vaste afwijking die op het moment van opvragen geldt`);
  assert.equal(data.hourly.time.length, s.uren, `${label}: ieder uur van de bron blijft bewaard (23, 24 of 25 uur per dag)`);
  assert.equal(new Set(data.hourly.time).size, data.hourly.time.length, `${label}: geen dubbele tijdteksten`);
  assert.deepEqual(data.hourly.time.map(t => alsMoment(t, data)), invoer, `${label}: iedere uurtekst plus de afwijking is precies het bronmoment`);
  data.hourly.time.forEach((t, i) => {
    assert.equal(data.hourly.temperature_2m[i], new Date(invoer[i] * 1000).getUTCHours(), `${label}: waarde ${i} hoort bij zijn eigen moment`);
    assert.equal(zichtbaar(t, data), lokaal(invoer[i], s.timezone).tijd, `${label}: uur ${i} wordt in de lokale tijd van de plaats getoond`);
  });
  /* Bij een verschuiving van een half uur (Lord Howe) liggen de hele klokuren rond de sprong anderhalf uur uit elkaar. */
  for (let i = 1; i < invoer.length; i += 1) {
    const stap = alsMoment(data.hourly.time[i], data) - alsMoment(data.hourly.time[i - 1], data);
    if (s.halfuursSprong) assert.ok(stap === 3600 || stap === 1800 || stap === 5400, `${label}: stap ${i} is ${stap} seconden`);
    else assert.equal(stap, 3600, `${label}: uren volgen elkaar zonder gat of herhaling op`);
  }

  const dagen = Array.from({ length: 7 }, (_, i) => volgendeDatum(s.start, i));
  assert.deepEqual(data.daily.time, dagen, `${label}: zeven lokale kalenderdagen`);
  dagen.forEach((datum, i) => {
    assert.equal(zichtbaar(data.daily.sunrise[i], data), `${datum}T07:15`, `${label}: zonsopkomst ${datum} in lokale tijd`);
    assert.equal(zichtbaar(data.daily.sunset[i], data), `${datum}T17:30`, `${label}: zonsondergang ${datum} in lokale tijd`);
  });
  assert.equal(zichtbaar(data.current.time, data), lokaal(nu, s.timezone).tijd, `${label}: lokale tijd nu`);
}

/* De live gemeten fout, letterlijk: opgevraagd op 25 oktober 10:37 in wintertijd. */
{
  const payload = vcPayload({ timezone: "Europe/Amsterdam", nuEpochS: epochVan("2026-10-25T09:37:00Z"), startDatum: "2026-10-25" });
  assert.equal(payload.currentConditions.tzoffset, 2, "Visual Crossing meldt hier de afwijking van het begin van de dag (zomertijd), niet die van nu");
  const data = normaliseerVisualCrossing(payload);
  assert.equal(data.utc_offset_seconds, 3600, "de afwijking van nu, niet de tzoffset van Visual Crossing");
  assert.equal(data.daily.sunset[0], "2026-10-25T17:30");
  assert.equal(zichtbaar(data.daily.sunset[0], data), "2026-10-25T17:30", "zon onder blijft 17:30, geen uur eerder");
}

/* Opgevraagd vóór de wissel: Open-Meteo-conform staan ook dagen in wintertijd
   op de zomertijdafwijking (zondag 04:00 CET als 05:00), de site rekent terug. */
{
  const data = normaliseerVisualCrossing(vcPayload({ timezone: "Europe/Amsterdam", nuEpochS: epochVan("2026-10-24T10:00:00Z"), startDatum: "2026-10-24" }));
  assert.equal(data.utc_offset_seconds, 7200);
  assert.equal(data.daily.sunrise[2], "2026-10-26T08:15", "maandag 07:15 CET staat op de afwijking van het antwoord (+02:00)");
  assert.equal(zichtbaar(data.daily.sunrise[2], data), "2026-10-26T07:15");
  const zondag = data.hourly.time.filter(t => t.startsWith("2026-10-25T"));
  assert.equal(zondag.length, 24, "de 25 uur van zondag liggen in deze tijdas van 25 oktober 00:00 tot en met 26 oktober 00:00");
  const labels = data.hourly.time.map(t => zichtbaar(t, data)).filter(t => t.startsWith("2026-10-25T")).map(t => t.slice(11));
  assert.deepEqual(labels.slice(0, 5), ["00:00", "01:00", "02:00", "02:00", "03:00"], "het dubbele klokuur 02:00 blijft twee keer bestaan");
  assert.equal(labels.length, 25);
}

/* Ontbreekt het bronmoment van een uur, dan telt de lokale kloktijd met de IANA-zone. */
{
  const metEpoch = normaliseerVisualCrossing(vcPayload({ timezone: "Asia/Tokyo", nuEpochS: epochVan("2026-10-25T03:00:00Z"), startDatum: "2026-10-25" }));
  const zonderEpoch = normaliseerVisualCrossing(vcPayload({ timezone: "Asia/Tokyo", nuEpochS: epochVan("2026-10-25T03:00:00Z"), startDatum: "2026-10-25", zonderUurEpoch: true }));
  assert.deepEqual(zonderEpoch.hourly.time, metEpoch.hourly.time);
  assert.deepEqual(zonderEpoch.hourly.temperature_2m, metEpoch.hourly.temperature_2m);
  const najaar = normaliseerVisualCrossing(vcPayload({ timezone: "Europe/Amsterdam", nuEpochS: epochVan("2026-10-24T10:00:00Z"), startDatum: "2026-10-24", zonderUurEpoch: true }));
  assert.equal(geldigeVisualCrossingForecast(najaar), true, "zonder uurmomenten blijft het antwoord geldig");
  assert.equal(new Set(najaar.hourly.time).size, najaar.hourly.time.length);
  assert.equal(najaar.hourly.time.length, 168, "zonder bronmomenten is het dubbele klokuur niet te onderscheiden en telt het één keer");
}

/* Een echte dubbele record (zelfde moment) wordt wel samengevoegd. */
{
  const payload = vcPayload({ timezone: "Europe/Amsterdam", nuEpochS: epochVan("2026-10-24T10:00:00Z"), startDatum: "2026-10-24" });
  const zonder = normaliseerVisualCrossing(payload);
  payload.days[1].hours.splice(4, 0, { ...payload.days[1].hours[3] });
  const met = normaliseerVisualCrossing(payload);
  assert.deepEqual(met.hourly.time, zonder.hourly.time, "hetzelfde moment tweemaal geleverd telt één keer");
  assert.equal(met.hourly.time.length, 169);
}

/* Dezelfde fout zonder tzoffset in het antwoord: de afwijking komt uit de IANA-zone. */
{
  const payload = vcPayload({ timezone: "America/New_York", nuEpochS: epochVan("2026-10-31T16:00:00Z"), startDatum: "2026-10-31" });
  delete payload.tzoffset;
  delete payload.currentConditions.tzoffset;
  assert.equal(normaliseerVisualCrossing(payload).utc_offset_seconds, -14400);
}

/* De daadwerkelijke reserveroute /api/forecast met Visual Crossing-vormige data. */
{
  const origineel = globalThis.fetch;
  try {
    for (const [nuIso, start, offset, sunset] of [
      ["2026-10-25T09:37:00Z", "2026-10-25", 3600, "2026-10-25T17:30"],
      ["2026-10-24T10:00:00Z", "2026-10-24", 7200, "2026-10-24T17:30"]
    ]) {
      const payload = vcPayload({ timezone: "Europe/Amsterdam", nuEpochS: epochVan(nuIso), startDatum: start });
      globalThis.fetch = async () => new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
      const response = await worker.fetch(
        new Request("https://watishetweer.nl/api/forecast?lat=52.3676&lon=4.9041"),
        { VISUAL_CROSSING_API_KEY: "test-key" }
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("x-wiw-weather-source"), "visualcrossing");
      const body = await response.json();
      assert.equal(body.utc_offset_seconds, offset, `route ${nuIso}: afwijking van het moment van opvragen`);
      assert.equal(body.daily.sunset[0], sunset, `route ${nuIso}: zon onder in de tijdas van het antwoord`);
      assert.equal(zichtbaar(body.daily.sunset[0], body), `${start}T17:30`, `route ${nuIso}: de site toont 17:30 lokale tijd`);
      assert.equal(zichtbaar(body.hourly.time[0], body), `${start}T00:00`, `route ${nuIso}: eerste uur is lokale middernacht`);
    }
  } finally {
    globalThis.fetch = origineel;
  }
}

console.log(`Visual Crossing klokwissels: ${SCENARIOS.length} situaties (Amsterdam, New York, Sydney, Santiago en zones zonder zomertijd, voor en na iedere wissel, 23- en 25-uursdagen), uren zonder verlies in één vaste tijdas, zon en nu in lokale tijd, en de echte route /api/forecast groen.`);
