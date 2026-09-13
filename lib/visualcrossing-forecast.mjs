const VISUAL_CROSSING_ICONS = Object.freeze({
  "clear-day": 0,
  "clear-night": 0,
  "partly-cloudy-day": 2,
  "partly-cloudy-night": 2,
  cloudy: 3,
  fog: 45,
  rain: 63,
  "showers-day": 80,
  "showers-night": 80,
  snow: 73,
  "snow-showers-day": 85,
  "snow-showers-night": 85,
  "thunder-rain": 95,
  "thunder-showers-day": 95,
  "thunder-showers-night": 95
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

function nietNegatief(value) {
  const n = getal(value);
  return n === null ? null : Math.max(0, n);
}

function icoonCode(record) {
  const icon = String(record && record.icon || "").trim().toLowerCase();
  const types = Array.isArray(record && record.preciptype)
    ? record.preciptype.map(type => String(type).toLowerCase())
    : [];
  if (types.includes("freezingrain")) return 67;
  if (Object.prototype.hasOwnProperty.call(VISUAL_CROSSING_ICONS, icon)) return VISUAL_CROSSING_ICONS[icon];
  if (icon === "wind") {
    const bewolking = begrens(record && record.cloudcover, 0, 100);
    if (bewolking === null) return 2;
    return bewolking > 90 ? 3 : (bewolking > 20 ? 2 : 0);
  }
  const sneeuw = nietNegatief(record && record.snow);
  const neerslag = nietNegatief(record && record.precip);
  if (sneeuw !== null && sneeuw > 0) return 73;
  if (neerslag !== null && neerslag > 0) return 63;
  const bewolking = begrens(record && record.cloudcover, 0, 100);
  if (bewolking === null) return null;
  return bewolking > 90 ? 3 : (bewolking > 20 ? 2 : 0);
}

function neerslagSoort(record) {
  const mm = nietNegatief(record && record.precip);
  const sneeuw = nietNegatief(record && record.snow);
  const icon = String(record && record.icon || "").toLowerCase();
  const types = Array.isArray(record && record.preciptype)
    ? record.preciptype.map(type => String(type).toLowerCase())
    : [];
  const sneeuwType = types.includes("snow") || icon.startsWith("snow");
  const bui = icon.startsWith("showers-") || icon.startsWith("thunder-showers-");
  return {
    rain: mm === null ? null : (sneeuwType || bui ? 0 : mm),
    showers: mm === null ? null : (sneeuwType ? 0 : (bui ? mm : 0)),
    snowfall: sneeuw
  };
}

function icoonDagVlag(icon) {
  const tekst = String(icon || "").toLowerCase();
  if (tekst.endsWith("-day")) return 1;
  if (tekst.endsWith("-night")) return 0;
  return null;
}

function dagVlag(record, dag) {
  const viaIcoon = icoonDagVlag(record && record.icon);
  if (viaIcoon !== null) return viaIcoon;
  const epoch = getal(record && record.datetimeEpoch);
  const op = getal(dag && dag.sunriseEpoch);
  const onder = getal(dag && dag.sunsetEpoch);
  if (epoch !== null && op !== null && onder !== null) return epoch >= op && epoch < onder ? 1 : 0;
  return null;
}

function lokaleDatumTijd(datum, value) {
  const dag = String(datum || "").trim();
  const tekst = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(tekst)) return tekst.slice(0, 16);
  const match = /^(\d{2}):(\d{2})/.exec(tekst);
  return /^\d{4}-\d{2}-\d{2}$/.test(dag) && match ? `${dag}T${match[1]}:${match[2]}` : null;
}

function lokaleTijdVanEpoch(epochSeconds, timezone) {
  const epoch = getal(epochSeconds);
  if (epoch === null || !timezone) return null;
  try {
    const delen = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(epoch * 1000));
    const map = Object.fromEntries(delen.filter(deel => deel.type !== "literal").map(deel => [deel.type, deel.value]));
    if (!map.year || !map.month || !map.day || !map.hour || !map.minute) return null;
    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
  } catch {
    return null;
  }
}

function astroTijd(dag, veld, epochVeld, timezone) {
  const viaEpoch = lokaleTijdVanEpoch(dag && dag[epochVeld], timezone);
  return viaEpoch || lokaleDatumTijd(dag && dag.datetime, dag && dag[veld]);
}

function maakUur(dag, hour) {
  const soorten = neerslagSoort(hour);
  return {
    time: lokaleDatumTijd(dag && dag.datetime, hour && hour.datetime),
    temperature_2m: getal(hour && hour.temp),
    apparent_temperature: getal(hour && hour.feelslike),
    relative_humidity_2m: begrens(hour && hour.humidity, 0, 100),
    dew_point_2m: getal(hour && hour.dew),
    precipitation_probability: begrens(hour && hour.precipprob, 0, 100),
    precipitation: nietNegatief(hour && hour.precip),
    rain: soorten.rain,
    showers: soorten.showers,
    snowfall: soorten.snowfall,
    weather_code: icoonCode(hour),
    cloud_cover: begrens(hour && hour.cloudcover, 0, 100),
    wind_speed_10m: nietNegatief(hour && hour.windspeed),
    wind_direction_10m: begrens(hour && hour.winddir, 0, 360),
    wind_gusts_10m: nietNegatief(hour && hour.windgust),
    visibility: nietNegatief(hour && hour.visibility) === null ? null : nietNegatief(hour && hour.visibility) * 1000,
    uv_index: nietNegatief(hour && hour.uvindex),
    pressure_msl: getal(hour && hour.pressure),
    is_day: dagVlag(hour, dag)
  };
}

function maakDag(dag, timezone) {
  return {
    time: /^\d{4}-\d{2}-\d{2}$/.test(String(dag && dag.datetime || "")) ? String(dag.datetime) : null,
    weather_code: icoonCode(dag),
    temperature_2m_max: getal(dag && dag.tempmax),
    temperature_2m_min: getal(dag && dag.tempmin),
    sunrise: astroTijd(dag, "sunrise", "sunriseEpoch", timezone),
    sunset: astroTijd(dag, "sunset", "sunsetEpoch", timezone),
    precipitation_probability_max: begrens(dag && dag.precipprob, 0, 100),
    precipitation_sum: nietNegatief(dag && dag.precip),
    uv_index_max: nietNegatief(dag && dag.uvindex),
    wind_speed_10m_max: nietNegatief(dag && dag.windspeed),
    wind_gusts_10m_max: nietNegatief(dag && dag.windgust),
    wind_direction_10m_dominant: begrens(dag && dag.winddir, 0, 360),
    sunshine_duration: null
  };
}

function arraysVanRijen(rijen, velden) {
  const uit = { time: rijen.map(rij => rij.time) };
  for (const veld of velden) uit[veld] = rijen.map(rij => rij[veld]);
  return uit;
}

function forecastUurIndexen(uren, dagen) {
  const indexen = [];
  for (const dag of dagen) {
    const voorDag = [];
    for (let i = 0; i < uren.length; i += 1) if (uren[i].startsWith(`${dag}T`)) voorDag.push(i);
    if (voorDag.length < 23 || voorDag.length > 25) return null;
    indexen.push(...voorDag);
  }
  return indexen;
}

function maakCurrent(payload, eersteDag, timezone) {
  const current = payload && payload.currentConditions || {};
  const soorten = neerslagSoort(current);
  return {
    time: lokaleTijdVanEpoch(current.datetimeEpoch, timezone) || lokaleDatumTijd(eersteDag && eersteDag.datetime, current.datetime),
    interval: 900,
    temperature_2m: getal(current.temp),
    apparent_temperature: getal(current.feelslike),
    relative_humidity_2m: begrens(current.humidity, 0, 100),
    is_day: dagVlag(current, eersteDag),
    precipitation: nietNegatief(current.precip),
    rain: soorten.rain,
    showers: soorten.showers,
    snowfall: soorten.snowfall,
    visibility: nietNegatief(current.visibility) === null ? null : nietNegatief(current.visibility) * 1000,
    weather_code: icoonCode(current),
    cloud_cover: begrens(current.cloudcover, 0, 100),
    pressure_msl: getal(current.pressure),
    wind_speed_10m: nietNegatief(current.windspeed),
    wind_direction_10m: begrens(current.winddir, 0, 360),
    wind_gusts_10m: nietNegatief(current.windgust)
  };
}

export function geldigeVisualCrossingForecast(data) {
  if (!data || typeof data !== "object" || data.provider !== "visualcrossing") return false;
  if (!data.current || !data.hourly || !data.daily) return false;
  if (!Number.isFinite(Number(data.latitude)) || !Number.isFinite(Number(data.longitude))) return false;
  if (Number(data.latitude) < -90 || Number(data.latitude) > 90 || Number(data.longitude) < -180 || Number(data.longitude) > 180) return false;
  if (!data.timezone || !Number.isFinite(Number(data.utc_offset_seconds)) || Math.abs(Number(data.utc_offset_seconds)) > 15 * 3600) return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(data.current.time || ""))) return false;
  if (!Number.isFinite(Number(data.current.temperature_2m)) || !Number.isFinite(Number(data.current.weather_code))) return false;
  if (data.current.is_day !== 0 && data.current.is_day !== 1) return false;
  const uren = data.hourly.time;
  const dagen = data.daily.time;
  if (!Array.isArray(uren) || uren.length < 7 * 23 || !Array.isArray(dagen) || dagen.length !== 7) return false;
  if (new Set(uren).size !== uren.length || new Set(dagen).size !== dagen.length) return false;
  if (!uren.every(tijd => typeof tijd === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(tijd))) return false;
  if (!dagen.every(dag => typeof dag === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dag))) return false;
  if (UURVELDEN.some(veld => !Array.isArray(data.hourly[veld]) || data.hourly[veld].length !== uren.length)) return false;
  if (DAGVELDEN.some(veld => !Array.isArray(data.daily[veld]) || data.daily[veld].length !== dagen.length)) return false;
  const forecastIndexen = forecastUurIndexen(uren, dagen);
  if (!forecastIndexen) return false;
  if (forecastIndexen.some(i => !Number.isFinite(Number(data.hourly.temperature_2m[i])))) return false;
  if (forecastIndexen.some(i => !Number.isFinite(Number(data.hourly.weather_code[i])))) return false;
  if (forecastIndexen.some(i => data.hourly.is_day[i] !== 0 && data.hourly.is_day[i] !== 1)) return false;
  if (data.daily.temperature_2m_max.some(v => !Number.isFinite(Number(v)))) return false;
  if (data.daily.temperature_2m_min.some(v => !Number.isFinite(Number(v)))) return false;
  if (data.daily.weather_code.some(v => !Number.isFinite(Number(v)))) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: data.timezone }).format(new Date()); }
  catch { return false; }
  return true;
}

export function normaliseerVisualCrossing(payload) {
  const alleDagen = payload && payload.days;
  if (!Array.isArray(alleDagen) || alleDagen.length < 7) {
    throw new Error("Visual Crossing leverde geen volledige zevendaagse verwachting");
  }
  const forecastdagen = alleDagen.slice(0, 7);
  const timezone = String(payload && payload.timezone || "").trim();
  if (!timezone) throw new Error("Visual Crossing leverde geen locatie-timezone");
  const urenMap = new Map();
  for (const dag of forecastdagen) {
    for (const raw of Array.isArray(dag && dag.hours) ? dag.hours : []) {
      const uur = maakUur(dag, raw);
      if (uur.time && !urenMap.has(uur.time)) urenMap.set(uur.time, uur);
    }
  }
  const uren = [...urenMap.values()].sort((a, b) => a.time.localeCompare(b.time));
  const dagen = forecastdagen.map(dag => maakDag(dag, timezone));
  const current = payload && payload.currentConditions || {};
  const offsetUren = getal(current.tzoffset) ?? getal(payload && payload.tzoffset);
  const uit = {
    provider: "visualcrossing",
    generationtime_ms: null,
    latitude: getal(payload && payload.latitude),
    longitude: getal(payload && payload.longitude),
    elevation: getal(payload && payload.elevation),
    timezone,
    timezone_abbreviation: null,
    utc_offset_seconds: offsetUren === null ? null : Math.round(offsetUren * 3600),
    current_units: {},
    current: maakCurrent(payload, forecastdagen[0], timezone),
    hourly_units: {},
    hourly: arraysVanRijen(uren, UURVELDEN),
    daily_units: {},
    daily: arraysVanRijen(dagen, DAGVELDEN)
  };
  if (!geldigeVisualCrossingForecast(uit)) throw new Error("Visual Crossing-normalisatie leverde onvolledige weerdata");
  return uit;
}

export const _intern = Object.freeze({
  VISUAL_CROSSING_ICONS,
  UURVELDEN,
  DAGVELDEN,
  getal,
  begrens,
  nietNegatief,
  icoonCode,
  neerslagSoort,
  icoonDagVlag,
  dagVlag,
  lokaleDatumTijd,
  lokaleTijdVanEpoch,
  astroTijd,
  maakUur,
  maakDag,
  forecastUurIndexen
});