import assert from "node:assert/strict";
import worker, { _intern as routeIntern } from "../api/forecast.mjs";
import {
  normaliseerWeatherApi,
  geldigeGenormaliseerdeForecast,
  _intern as adapterIntern
} from "../lib/weatherapi-forecast.mjs";

function uur(datum, index, code = 1003) {
  const hh = String(index).padStart(2, "0");
  return {
    time_epoch: 1788652800 + index * 3600,
    time: `${datum} ${hh}:00`,
    temp_c: 10 + index / 10,
    feelslike_c: 9 + index / 10,
    humidity: 70,
    dewpoint_c: 6,
    chance_of_rain: index % 4 === 0 ? 40 : 5,
    chance_of_snow: 0,
    precip_mm: index % 4 === 0 ? 0.4 : 0,
    snow_cm: 0,
    condition: { code },
    cloud: 45,
    wind_kph: 18,
    wind_degree: 225,
    gust_kph: 31,
    vis_km: 12,
    uv: index > 7 && index < 19 ? 3 : 0,
    pressure_mb: 1015,
    is_day: index > 6 && index < 20 ? 1 : 0
  };
}

function dag(datum, dagIndex) {
  return {
    date: datum,
    day: {
      maxtemp_c: 18 + dagIndex,
      mintemp_c: 9 + dagIndex,
      maxwind_kph: 24,
      totalprecip_mm: 1.2,
      totalsnow_cm: 0,
      condition: { code: dagIndex === 2 ? 1189 : 1003 },
      uv: 4,
      daily_chance_of_rain: 40,
      daily_chance_of_snow: 0
    },
    astro: { sunrise: "06:42 AM", sunset: "08:17 PM" },
    hour: Array.from({ length: 24 }, (_, i) => uur(datum, i, dagIndex === 2 ? 1189 : 1003))
  };
}

function datumVanaf(offset) {
  return new Date(Date.UTC(2026, 8, 6 + offset)).toISOString().slice(0, 10);
}

function payload(aantalDagen = 7) {
  return {
    location: {
      name: "Amsterdam",
      lat: 52.37,
      lon: 4.9,
      tz_id: "Europe/Amsterdam",
      localtime_epoch: 1788652800,
      localtime: "2026-09-06 02:00"
    },
    current: {
      last_updated: "2026-09-06 02:00",
      temp_c: 14.2,
      feelslike_c: 13.4,
      humidity: 71,
      is_day: 0,
      precip_mm: 0,
      condition: { code: 1003 },
      cloud: 45,
      pressure_mb: 1015,
      wind_kph: 17,
      wind_degree: 225,
      gust_kph: 29,
      vis_km: 12
    },
    forecast: {
      forecastday: Array.from({ length: aantalDagen }, (_, i) => dag(datumVanaf(i), i))
    }
  };
}

function historie() {
  const datum = datumVanaf(-1);
  return { forecast: { forecastday: [dag(datum, -1)] } };
}

const genormaliseerd = normaliseerWeatherApi(payload(), historie());
assert.equal(geldigeGenormaliseerdeForecast(genormaliseerd), true);
assert.equal(genormaliseerd.provider, "weatherapi");
assert.equal(genormaliseerd.timezone, "Europe/Amsterdam");
assert.equal(genormaliseerd.utc_offset_seconds, 7200);
assert.equal(genormaliseerd.current.temperature_2m, 14.2);
assert.equal(genormaliseerd.current.weather_code, 2);
assert.equal(genormaliseerd.hourly.time.length, 8 * 24, "gisteren plus zeven forecastdagen blijven beschikbaar");
assert.equal(genormaliseerd.daily.time.length, 7);
assert.equal(genormaliseerd.daily.weather_code[2], 63);
assert.equal(genormaliseerd.daily.sunrise[0], "2026-09-06T06:42");
assert.equal(genormaliseerd.daily.sunset[0], "2026-09-06T20:17");
assert.equal(genormaliseerd.hourly.precipitation_probability.length, genormaliseerd.hourly.time.length);
assert.equal(genormaliseerd.hourly.wind_gusts_10m.length, genormaliseerd.hourly.time.length);
assert.equal(genormaliseerd.hourly.visibility[0], 12000);
assert.equal(new Set(genormaliseerd.hourly.time).size, genormaliseerd.hourly.time.length);
assert.throws(() => normaliseerWeatherApi(payload(3)), /zevendaagse/, "gratis driedaagse payload mag niet als volledige fallback doorgaan");
assert.equal(adapterIntern.wmoCode(1276), 99);
assert.equal(adapterIntern.wmoCode(999999), null);

assert.equal(routeIntern.coordinaat("", -90, 90), null);
assert.equal(routeIntern.coordinaat("91", -90, 90), null);
assert.equal(routeIntern.coordinaat("52.37", -90, 90), 52.37);
assert.equal(routeIntern.vorigeDatum("2026-01-01 00:10"), "2025-12-31");
assert(routeIntern.afstandKm(52.37, 4.9, 52.38, 4.91) < 2);
assert(routeIntern.afstandKm(52.37, 4.9, 51.9, 4.9) > 25);
assert.match(routeIntern.upstreamUrl("/forecast.json", "zeer-geheim", 52.370234, 4.895234, { days: 7 }), /q=52\.3702%2C4\.8952/);

{
  const response = await worker.fetch(new Request("https://watishetweer.nl/api/forecast?lat=&lon=4.9"), {});
  assert.equal(response.status, 400);
  assert.equal((await response.json()).reden, "ongeldige coördinaten");
  assert.match(response.headers.get("cache-control") || "", /no-store/);
}

{
  const response = await worker.fetch(new Request("https://watishetweer.nl/api/forecast?lat=52.37&lon=4.9"), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).reden, "secundaire weerservice niet geconfigureerd");
  assert.match(response.headers.get("cache-control") || "", /no-store/);
}

{
  const response = await worker.fetch(new Request("https://watishetweer.nl/api/forecast?lat=52.37&lon=4.9", { method: "POST" }), {});
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
}

{
  const origineel = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    return new Response(JSON.stringify(String(url).includes("history.json") ? historie() : payload()), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  try {
    const response = await worker.fetch(
      new Request("https://watishetweer.nl/api/forecast?lat=52.370234&lon=4.895234"),
      { WEATHERAPI_KEY: "zeer-geheim" }
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-wiw-weather-source"), "weatherapi");
    assert.equal(response.headers.get("cloudflare-cdn-cache-control"), "s-maxage=600, stale-while-revalidate=300");
    const responseTekst = await response.text();
    assert.equal(JSON.parse(responseTekst).daily.time.length, 7);
    assert.equal(urls.length, 2);
    assert(urls.every(url => url.includes("key=zeer-geheim")));
    assert(urls.every(url => url.includes("q=52.3702%2C4.8952")), "upstreamcoördinaten moeten op vier decimalen worden begrensd");
    assert.equal(responseTekst.includes("zeer-geheim"), false, "API-key mag nooit in de clientresponse staan");
  } finally {
    globalThis.fetch = origineel;
  }
}

{
  const origineel = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(payload(3)), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    const response = await worker.fetch(
      new Request("https://watishetweer.nl/api/forecast?lat=52.37&lon=4.9"),
      { WEATHERAPI_KEY: "zeer-geheim" }
    );
    assert.equal(response.status, 503, "onvolledige WeatherAPI-data mag nooit als geldige fallback worden geserveerd");
    const body = await response.json();
    assert.equal(body.reden, "secundaire weerservice tijdelijk niet beschikbaar");
    assert.equal(JSON.stringify(body).includes("zeer-geheim"), false);
  } finally {
    globalThis.fetch = origineel;
  }
}

console.log("WeatherAPI forecast-adapter: zeven dagen, uur/dag/current-normalisatie, timezone, WMO-codes, coördinaten, geheimhouding en fail-closed contract groen.");
