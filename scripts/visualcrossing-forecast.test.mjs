import assert from "node:assert/strict";
import worker, { _intern as routeIntern } from "../api/forecast.mjs";
import { normaliseerVisualCrossing, geldigeVisualCrossingForecast, _intern as adapterIntern } from "../lib/visualcrossing-forecast.mjs";

const basis = Date.UTC(2026, 8, 6);
const datum = i => new Date(basis + i * 86400000).toISOString().slice(0, 10);
const epoch = (d, h, m = 0) => (basis + d * 86400000 + h * 3600000 + m * 60000) / 1000;

function vcUur(d, h) {
  const daglicht = h >= 7 && h < 20;
  return {
    datetime: `${String(h).padStart(2, "0")}:00:00`, datetimeEpoch: epoch(d, h - 2),
    temp: 11 + h / 10, feelslike: 10 + h / 10, humidity: 72, dew: 6,
    precip: h % 5 === 0 ? 0.4 : 0, precipprob: h % 5 === 0 ? 45 : 5,
    preciptype: h % 5 === 0 ? ["rain"] : null, snow: 0,
    windgust: 30, windspeed: 18, winddir: 225, pressure: 1015, cloudcover: 45,
    visibility: 12, uvindex: daglicht ? 3 : 0,
    icon: daglicht ? "partly-cloudy-day" : "partly-cloudy-night"
  };
}

function vcDag(d) {
  return {
    datetime: datum(d), tempmax: 19 + d, tempmin: 9 + d, temp: 14 + d,
    precip: 1.2, precipprob: 45, preciptype: ["rain"], snow: 0,
    windgust: 31, windspeed: 24, winddir: 225, pressure: 1015, cloudcover: 45,
    visibility: 12, uvindex: 4, icon: d === 2 ? "rain" : "partly-cloudy-day",
    sunrise: "06:42:00", sunriseEpoch: epoch(d, 4, 42),
    sunset: "20:17:00", sunsetEpoch: epoch(d, 18, 17),
    hours: Array.from({ length: 24 }, (_, h) => vcUur(d, h))
  };
}

function vcPayload(aantal = 8) {
  return {
    latitude: 52.37, longitude: 4.9, timezone: "Europe/Amsterdam", tzoffset: 2,
    currentConditions: {
      datetime: "02:00:00", datetimeEpoch: epoch(0, 0), tzoffset: 2,
      temp: 14.2, feelslike: 13.4, humidity: 71, dew: 8, precip: 0, precipprob: 5,
      preciptype: null, snow: 0, windgust: 29, windspeed: 17, winddir: 225,
      pressure: 1015, cloudcover: 45, visibility: 12, uvindex: 0, icon: "partly-cloudy-night"
    },
    days: Array.from({ length: aantal }, (_, d) => vcDag(d))
  };
}

const data = normaliseerVisualCrossing(vcPayload());
assert.equal(geldigeVisualCrossingForecast(data), true);
assert.equal(data.provider, "visualcrossing");
assert.equal(data.timezone, "Europe/Amsterdam");
assert.equal(data.utc_offset_seconds, 7200);
assert.equal(data.current.time, "2026-09-06T02:00");
assert.equal(data.current.is_day, 0);
assert.equal(data.hourly.time.length, 168);
assert.equal(data.daily.time.length, 7);
assert.equal(data.daily.weather_code[2], 63);
assert.equal(data.daily.sunrise[0], "2026-09-06T06:42");
assert.equal(data.daily.sunset[0], "2026-09-06T20:17");
assert.equal(data.hourly.visibility[0], 12000);
assert.equal(adapterIntern.icoonCode({ icon: "thunder-rain" }), 95);
assert.equal(adapterIntern.icoonCode({ icon: "rain", preciptype: ["freezingrain"] }), 67);
assert.equal(adapterIntern.icoonCode({ icon: "wind", cloudcover: 95 }), 3);

{
  const p = vcPayload();
  p.days[2].hours.splice(2, 1);
  assert.equal(geldigeVisualCrossingForecast(normaliseerVisualCrossing(p)), true, "23-uurs DST-dag blijft geldig");
}
{
  const p = vcPayload();
  p.days[2].hours.splice(3, 0, { ...p.days[2].hours[2], datetimeEpoch: p.days[2].hours[2].datetimeEpoch + 3600 });
  const dst = normaliseerVisualCrossing(p);
  assert.equal(new Set(dst.hourly.time).size, dst.hourly.time.length, "dubbel lokaal DST-klokuur wordt veilig gededupliceerd");
}
assert.throws(() => normaliseerVisualCrossing(vcPayload(3)), /zevendaagse/);
assert.equal(geldigeVisualCrossingForecast({ ...data, timezone: "Geen/Geldige_Zone" }), false);
assert.match(routeIntern.visualCrossingUrl("test-key", 52.370234, 4.895234), /52\.3702%2C4\.8952/);
assert.match(routeIntern.visualCrossingUrl("test-key", 52.370234, 4.895234), /unitGroup=metric/);
assert.match(routeIntern.visualCrossingUrl("test-key", 52.370234, 4.895234), /iconSet=icons2/);

{
  const origineel = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    return new Response(JSON.stringify(vcPayload()), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const response = await worker.fetch(
      new Request("https://watishetweer.nl/api/forecast?lat=52.370234&lon=4.895234"),
      { VISUAL_CROSSING_API_KEY: "test-key", WEATHERAPI_KEY: "emergency-test-key" }
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-wiw-weather-source"), "visualcrossing");
    assert.equal((await response.json()).provider, "visualcrossing");
    assert.equal(urls.length, 1, "geldige Visual Crossing-response start WeatherAPI niet");
  } finally {
    globalThis.fetch = origineel;
  }
}

{
  const origineel = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(vcPayload(3)), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    const response = await worker.fetch(
      new Request("https://watishetweer.nl/api/forecast?lat=52.37&lon=4.9"),
      { VISUAL_CROSSING_API_KEY: "test-key" }
    );
    assert.equal(response.status, 503, "onvolledige Visual Crossing-data mag niet worden geserveerd");
  } finally {
    globalThis.fetch = origineel;
  }
}

console.log("Visual Crossing forecast-adapter: contract, zeven dagen, lokale tijd, DST, WMO-mapping, servervolgorde en fail-closed gedrag groen.");