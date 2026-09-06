const WEATHERAPI_CODES = Object.freeze({
  1000: 0,
  1003: 2,
  1006: 3,
  1009: 3,
  1012: 45,
  1015: 45,
  1018: 45,
  1021: 45,
  1024: 45,
  1027: 45,
  1030: 45,
  1033: 45,
  1036: 45,
  1039: 45,
  1042: 45,
  1045: 45,
  1048: 45,
  1063: 80,
  1066: 85,
  1069: 67,
  1072: 56,
  1087: 95,
  1114: 85,
  1117: 75,
  1135: 45,
  1147: 48,
  1150: 51,
  1153: 53,
  1168: 56,
  1171: 57,
  1180: 61,
  1183: 61,
  1186: 63,
  1189: 63,
  1192: 65,
  1195: 65,
  1198: 66,
  1201: 67,
  1204: 66,
  1207: 67,
  1210: 71,
  1213: 71,
  1216: 73,
  1219: 73,
  1222: 75,
  1225: 75,
  1237: 77,
  1240: 80,
  1243: 81,
  1246: 82,
  1249: 85,
  1252: 86,
  1255: 85,
  1258: 86,
  1261: 77,
  1264: 77,
  1273: 95,
  1276: 99,
  1279: 96,
  1282: 99
});

const UURVELDEN = Object.freeze([
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "dew_point_2m",
  "precipitation_probability",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "weather_code",
  "cloud_cover",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "visibility",
  "uv_index",
  "pressure_msl",
  "is_day"
]);

const DAGVELDEN = Object.freeze([
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "sunrise",
  "sunset",
  "precipitation_probability_max",
  "precipitation_sum",
  "uv_index_max",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "wind_direction_10m_dominant",
  "sunshine_duration"
]);

function getal(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function begrens(value, min, max) {
  const n = getal(value);
  return n === null ? null : Math.min(max, Math.max(min, n));
}

function lokaleTijd(value) {
  const tekst = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(tekst) ? tekst.replace(" ", "T") : null;
}

function wmoCode(value) {
  const code = Number(value);
  return Object.prototype.hasOwnProperty.call(WEATHERAPI_CODES, code) ? WEATHERAPI_CODES[code] : null;
}

function neerslagSoort(code, precipitation, snowCm) {
  const weer = Number(code);
  const mm = Math.max(0, getal(precipitation) || 0);
  const sneeuw = Math.max(0, getal(snowCm) || 0);
  const sneeuwCode = [1066, 1069, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264, 1279, 1282].includes(weer);
  const buiCode = [1063, 1066, 1069, 1240, 1243, 1246, 1249, 1252, 1255, 1258, 1261, 1264].includes(weer);
  return {
    rain: sneeuwCode ? 0 : (buiCode ? 0 : mm),
    showers: sneeuwCode ? 0 : (buiCode ? mm : 0),
    snowfall: sneeuw
  };
}

function astroTijd(datum, value) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(value || "").trim());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(datum || "")) || !m) return null;
  let uur = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") uur += 12;
  return `${datum}T${String(uur).padStart(2, "0")}:${m[2]}`;
}

function utcOffsetSeconds(location) {
  const lokaal = lokaleTijd(location && location.localtime);
  const epoch = getal(location && location.localtime_epoch);
  if (!lokaal || epoch === null) return 0;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(lokaal);
  if (!m) return 0;
  const alsofUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const offset = Math.round((alsofUtc - epoch * 1000) / 1000);
  return Number.isFinite(offset) && Math.abs(offset) <= 15 * 3600 ? offset : 0;
}

function maakUur(hour) {
  const time = lokaleTijd(hour && hour.time);
  const code = Number(hour && hour.condition && hour.condition.code);
  const soorten = neerslagSoort(code, hour && hour.precip_mm, hour && hour.snow_cm);
  const regenKans = begrens(hour && hour.chance_of_rain, 0, 100);
  const sneeuwKans = begrens(hour && hour.chance_of_snow, 0, 100);
  return {
    time,
    temperature_2m: getal(hour && hour.temp_c),
    apparent_temperature: getal(hour && hour.feelslike_c),
    relative_humidity_2m: begrens(hour && hour.humidity, 0, 100),
    dew_point_2m: getal(hour && hour.dewpoint_c),
    precipitation_probability: Math.max(regenKans || 0, sneeuwKans || 0),
    precipitation: Math.max(0, getal(hour && hour.precip_mm) || 0),
    rain: soorten.rain,
    showers: soorten.showers,
    snowfall: soorten.snowfall,
    weather_code: wmoCode(code),
    cloud_cover: begrens(hour && hour.cloud, 0, 100),
    wind_speed_10m: Math.max(0, getal(hour && hour.wind_kph) || 0),
    wind_direction_10m: begrens(hour && hour.wind_degree, 0, 360),
    wind_gusts_10m: Math.max(0, getal(hour && hour.gust_kph) || 0),
    visibility: Math.max(0, getal(hour && hour.vis_km) || 0) * 1000,
    uv_index: Math.max(0, getal(hour && hour.uv) || 0),
    pressure_msl: getal(hour && hour.pressure_mb),
    is_day: Number(hour && hour.is_day) === 1 ? 1 : 0
  };
}

function dominanteWindrichting(hours) {
  const geldig = hours.map(uur => ({
    richting: getal(uur && uur.wind_degree),
    gewicht: Math.max(0.1, getal(uur && uur.wind_kph) || 0.1)
  })).filter(item => item.richting !== null);
  if (!geldig.length) return null;
  const vector = geldig.reduce((acc, item) => {
    const rad = item.richting * Math.PI / 180;
    acc.x += Math.sin(rad) * item.gewicht;
    acc.y += Math.cos(rad) * item.gewicht;
    return acc;
  }, { x: 0, y: 0 });
  const graden = Math.atan2(vector.x, vector.y) * 180 / Math.PI;
  return (Math.round(graden) + 360) % 360;
}

function maakDag(forecastday) {
  const datum = String(forecastday && forecastday.date || "");
  const day = forecastday && forecastday.day || {};
  const astro = forecastday && forecastday.astro || {};
  const hours = Array.isArray(forecastday && forecastday.hour) ? forecastday.hour : [];
  const kansen = hours.flatMap(hour => [
    begrens(hour && hour.chance_of_rain, 0, 100),
    begrens(hour && hour.chance_of_snow, 0, 100)
  ]).filter(Number.isFinite);
  const gusts = hours.map(hour => getal(hour && hour.gust_kph)).filter(Number.isFinite);
  return {
    time: /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : null,
    weather_code: wmoCode(day && day.condition && day.condition.code),
    temperature_2m_max: getal(day.maxtemp_c),
    temperature_2m_min: getal(day.mintemp_c),
    sunrise: astroTijd(datum, astro.sunrise),
    sunset: astroTijd(datum, astro.sunset),
    precipitation_probability_max: kansen.length ? Math.max(...kansen) : Math.max(
      begrens(day.daily_chance_of_rain, 0, 100) || 0,
      begrens(day.daily_chance_of_snow, 0, 100) || 0
    ),
    precipitation_sum: Math.max(0, getal(day.totalprecip_mm) || 0),
    uv_index_max: Math.max(0, getal(day.uv) || 0),
    wind_speed_10m_max: Math.max(0, getal(day.maxwind_kph) || 0),
    wind_gusts_10m_max: gusts.length ? Math.max(...gusts) : Math.max(0, getal(day.maxwind_kph) || 0),
    wind_direction_10m_dominant: dominanteWindrichting(hours),
    sunshine_duration: null
  };
}

function voegUrenToe(map, payload) {
  const dagen = payload && payload.forecast && payload.forecast.forecastday;
  if (!Array.isArray(dagen)) return;
  for (const dag of dagen) {
    for (const raw of Array.isArray(dag && dag.hour) ? dag.hour : []) {
      const uur = maakUur(raw);
      if (uur.time) map.set(uur.time, uur);
    }
  }
}

function arraysVanRijen(rijen, velden) {
  const uit = { time: rijen.map(rij => rij.time) };
  for (const veld of velden) uit[veld] = rijen.map(rij => rij[veld]);
  return uit;
}

function maakCurrent(payload) {
  const current = payload && payload.current || {};
  const code = Number(current && current.condition && current.condition.code);
  const soorten = neerslagSoort(code, current.precip_mm, 0);
  return {
    time: lokaleTijd(current.last_updated) || lokaleTijd(payload && payload.location && payload.location.localtime),
    interval: 900,
    temperature_2m: getal(current.temp_c),
    apparent_temperature: getal(current.feelslike_c),
    relative_humidity_2m: begrens(current.humidity, 0, 100),
    is_day: Number(current.is_day) === 1 ? 1 : 0,
    precipitation: Math.max(0, getal(current.precip_mm) || 0),
    rain: soorten.rain,
    showers: soorten.showers,
    snowfall: null,
    visibility: Math.max(0, getal(current.vis_km) || 0) * 1000,
    weather_code: wmoCode(code),
    cloud_cover: begrens(current.cloud, 0, 100),
    pressure_msl: getal(current.pressure_mb),
    wind_speed_10m: Math.max(0, getal(current.wind_kph) || 0),
    wind_direction_10m: begrens(current.wind_degree, 0, 360),
    wind_gusts_10m: Math.max(0, getal(current.gust_kph) || 0)
  };
}

export function geldigeGenormaliseerdeForecast(data) {
  if (!data || typeof data !== "object" || data.provider !== "weatherapi") return false;
  if (!data.current || !data.hourly || !data.daily) return false;
  if (data.latitude === null || data.latitude === undefined || data.longitude === null || data.longitude === undefined) return false;
  if (!Number.isFinite(Number(data.latitude)) || !Number.isFinite(Number(data.longitude))) return false;
  if (Number(data.latitude) < -90 || Number(data.latitude) > 90 || Number(data.longitude) < -180 || Number(data.longitude) > 180) return false;
  if (!data.timezone || data.utc_offset_seconds === null || data.utc_offset_seconds === undefined || !Number.isFinite(Number(data.utc_offset_seconds))) return false;
  if (!data.current.time || data.current.temperature_2m === null || data.current.weather_code === null || !Number.isFinite(Number(data.current.temperature_2m)) || !Number.isFinite(Number(data.current.weather_code))) return false;
  const uren = data.hourly.time;
  const dagen = data.daily.time;
  if (!Array.isArray(uren) || uren.length < 7 * 24 || !Array.isArray(dagen) || dagen.length !== 7) return false;
  if (new Set(uren).size !== uren.length || new Set(dagen).size !== dagen.length) return false;
  if (UURVELDEN.some(veld => !Array.isArray(data.hourly[veld]) || data.hourly[veld].length !== uren.length)) return false;
  if (DAGVELDEN.some(veld => !Array.isArray(data.daily[veld]) || data.daily[veld].length !== dagen.length)) return false;
  if (data.hourly.temperature_2m.slice(-7 * 24).some(v => v === null || !Number.isFinite(Number(v)))) return false;
  if (data.hourly.weather_code.slice(-7 * 24).some(v => v === null || !Number.isFinite(Number(v)))) return false;
  if (data.daily.temperature_2m_max.some(v => v === null || !Number.isFinite(Number(v)))) return false;
  if (data.daily.temperature_2m_min.some(v => v === null || !Number.isFinite(Number(v)))) return false;
  if (data.daily.weather_code.some(v => v === null || !Number.isFinite(Number(v)))) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: data.timezone }).format(new Date()); }
  catch { return false; }
  return true;
}

export function normaliseerWeatherApi(forecastPayload, historyPayload = null) {
  const forecastdagen = forecastPayload && forecastPayload.forecast && forecastPayload.forecast.forecastday;
  if (!Array.isArray(forecastdagen) || forecastdagen.length !== 7) {
    throw new Error("WeatherAPI leverde geen volledige zevendaagse verwachting");
  }
  const locatie = forecastPayload && forecastPayload.location || {};
  const timezone = String(locatie.tz_id || "").trim();
  if (!timezone) throw new Error("WeatherAPI leverde geen locatie-timezone");

  const uurMap = new Map();
  voegUrenToe(uurMap, historyPayload);
  voegUrenToe(uurMap, forecastPayload);
  const uren = [...uurMap.values()].sort((a, b) => a.time.localeCompare(b.time));
  const dagen = forecastdagen.map(maakDag);
  const uit = {
    provider: "weatherapi",
    generationtime_ms: null,
    latitude: getal(locatie.lat),
    longitude: getal(locatie.lon),
    elevation: null,
    timezone,
    timezone_abbreviation: null,
    utc_offset_seconds: utcOffsetSeconds(locatie),
    current_units: {},
    current: maakCurrent(forecastPayload),
    hourly_units: {},
    hourly: arraysVanRijen(uren, UURVELDEN),
    daily_units: {},
    daily: arraysVanRijen(dagen, DAGVELDEN)
  };
  if (!geldigeGenormaliseerdeForecast(uit)) throw new Error("WeatherAPI-normalisatie leverde onvolledige weerdata");
  return uit;
}

export const _intern = Object.freeze({
  WEATHERAPI_CODES,
  UURVELDEN,
  DAGVELDEN,
  getal,
  begrens,
  lokaleTijd,
  wmoCode,
  neerslagSoort,
  astroTijd,
  utcOffsetSeconds,
  maakUur,
  maakDag,
  dominanteWindrichting
});
