import { normaliseerWeatherApi } from "../lib/weatherapi-forecast.mjs";
import { normaliseerVisualCrossing } from "../lib/visualcrossing-forecast.mjs";

const WEATHERAPI_ROOT = "https://api.weatherapi.com/v1";
const VISUAL_CROSSING_ROOT = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline";
const UPSTREAM_TIMEOUT_MS = 3000;
const VISUAL_CROSSING_TIMEOUT_MS = 1600;
const WEATHERAPI_EMERGENCY_TIMEOUT_MS = 2500;
const WEATHERAPI_EMERGENCY_HISTORY_TIMEOUT_MS = 400;
const VISUAL_CROSSING_ELEMENTS = Object.freeze([
  "datetime",
  "datetimeEpoch",
  "tzoffset",
  "temp",
  "tempmax",
  "tempmin",
  "feelslike",
  "humidity",
  "dew",
  "precip",
  "precipprob",
  "preciptype",
  "snow",
  "windgust",
  "windspeed",
  "winddir",
  "pressure",
  "cloudcover",
  "visibility",
  "uvindex",
  "conditions",
  "icon",
  "sunrise",
  "sunriseEpoch",
  "sunset",
  "sunsetEpoch"
]);

function json(body, status = 200, extraHeaders = {}, head = false) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  if (status >= 400) {
    headers.set("Cache-Control", "private, no-store");
    headers.delete("Cloudflare-CDN-Cache-Control");
  } else {
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    headers.set("Cloudflare-CDN-Cache-Control", "s-maxage=600, stale-while-revalidate=300");
  }
  return new Response(head ? null : JSON.stringify(body), { status, headers });
}

function methodeNietToegestaan(head = false) {
  return json({ beschikbaar: false, provider: "weatherapi", reden: "methode niet toegestaan" }, 405, { Allow: "GET, HEAD" }, head);
}

function coordinaat(value, min, max) {
  if (value === null || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function vorigeDatum(lokaleTijd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(lokaleTijd || ""));
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) - 86400000).toISOString().slice(0, 10);
}

function afstandKm(lat1, lon1, lat2, lon2) {
  const waarden = [lat1, lon1, lat2, lon2].map(Number);
  if (!waarden.every(Number.isFinite)) return Infinity;
  const rad = graden => graden * Math.PI / 180;
  const dLat = rad(waarden[2] - waarden[0]);
  const dLon = rad(waarden[3] - waarden[1]);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(waarden[0])) * Math.cos(rad(waarden[2])) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function haalJson(url, signal, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  let timer = null;
  const afbreken = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", afbreken, { once: true });
  }
  timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`upstream status ${response.status}`);
    return await response.json();
  } finally {
    if (timer !== null) clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", afbreken);
  }
}

function upstreamUrl(pad, key, lat, lon, extra = {}) {
  const url = new URL(WEATHERAPI_ROOT + pad);
  url.searchParams.set("key", key);
  url.searchParams.set("q", `${lat.toFixed(4)},${lon.toFixed(4)}`);
  for (const [naam, waarde] of Object.entries(extra)) url.searchParams.set(naam, String(waarde));
  return url.toString();
}

function visualCrossingUrl(key, lat, lon) {
  const locatie = encodeURIComponent(`${lat.toFixed(4)},${lon.toFixed(4)}`);
  const url = new URL(`${VISUAL_CROSSING_ROOT}/${locatie}`);
  url.searchParams.set("key", key);
  url.searchParams.set("unitGroup", "metric");
  url.searchParams.set("include", "current,hours,days");
  url.searchParams.set("elements", VISUAL_CROSSING_ELEMENTS.join(","));
  url.searchParams.set("iconSet", "icons2");
  url.searchParams.set("lang", "nl");
  url.searchParams.set("contentType", "json");
  return url.toString();
}

async function haalVisualCrossingForecast(key, lat, lon, signal) {
  const payload = await haalJson(visualCrossingUrl(key, lat, lon), signal, VISUAL_CROSSING_TIMEOUT_MS);
  if (afstandKm(lat, lon, payload && payload.latitude, payload && payload.longitude) > 25) {
    throw new Error("Visual Crossing-locatie wijkt af van de aanvraag");
  }
  return normaliseerVisualCrossing(payload);
}

async function haalWeatherApiForecast(key, lat, lon, signal, emergency = false) {
  const forecastUrl = upstreamUrl("/forecast.json", key, lat, lon, {
    days: 7,
    aqi: "no",
    alerts: "no",
    lang: "nl"
  });
  const forecast = await haalJson(
    forecastUrl,
    signal,
    emergency ? WEATHERAPI_EMERGENCY_TIMEOUT_MS : UPSTREAM_TIMEOUT_MS
  );
  if (afstandKm(lat, lon, forecast && forecast.location && forecast.location.lat, forecast && forecast.location && forecast.location.lon) > 25) {
    throw new Error("WeatherAPI-locatie wijkt af van de aanvraag");
  }
  const gisteren = vorigeDatum(forecast && forecast.location && forecast.location.localtime);
  let history = null;
  if (gisteren) {
    try {
      history = await haalJson(
        upstreamUrl("/history.json", key, lat, lon, { dt: gisteren, lang: "nl" }),
        signal,
        emergency ? WEATHERAPI_EMERGENCY_HISTORY_TIMEOUT_MS : 1000
      );
    } catch (error) {
      if (signal && signal.aborted) throw error;
    }
  }
  return normaliseerWeatherApi(forecast, history);
}

export default {
  async fetch(request, env = {}) {
    const method = String(request && request.method || "GET").toUpperCase();
    const head = method === "HEAD";
    if (method !== "GET" && !head) return methodeNietToegestaan(false);

    const url = new URL(request.url);
    const lat = coordinaat(url.searchParams.get("lat"), -90, 90);
    const lon = coordinaat(url.searchParams.get("lon"), -180, 180);
    if (lat === null || lon === null) {
      return json({ beschikbaar: false, provider: "weatherapi", reden: "ongeldige coördinaten" }, 400, {}, head);
    }

    const visualCrossingKey = String(env && env.VISUAL_CROSSING_API_KEY || "").trim();
    const weatherApiKey = String(env && env.WEATHERAPI_KEY || "").trim();
    if (!visualCrossingKey && !weatherApiKey) {
      return json({ beschikbaar: false, provider: "weatherapi", reden: "secundaire weerservice niet geconfigureerd" }, 503, {
        "Retry-After": "300"
      }, head);
    }

    if (visualCrossingKey) {
      try {
        const body = await haalVisualCrossingForecast(visualCrossingKey, lat, lon, request.signal);
        return json(body, 200, { "X-WIW-Weather-Source": "visualcrossing" }, head);
      } catch (error) {
        if (request.signal && request.signal.aborted) throw error;
      }
    }

    if (weatherApiKey) {
      try {
        const body = await haalWeatherApiForecast(weatherApiKey, lat, lon, request.signal, Boolean(visualCrossingKey));
        return json(body, 200, { "X-WIW-Weather-Source": "weatherapi" }, head);
      } catch (error) {
        if (request.signal && request.signal.aborted) throw error;
      }
    }

    return json({ beschikbaar: false, provider: "weatherapi", reden: "secundaire weerservice tijdelijk niet beschikbaar" }, 503, {
      "Retry-After": "60"
    }, head);
  }
};

export const _intern = Object.freeze({
  WEATHERAPI_ROOT,
  VISUAL_CROSSING_ROOT,
  UPSTREAM_TIMEOUT_MS,
  VISUAL_CROSSING_TIMEOUT_MS,
  WEATHERAPI_EMERGENCY_TIMEOUT_MS,
  WEATHERAPI_EMERGENCY_HISTORY_TIMEOUT_MS,
  VISUAL_CROSSING_ELEMENTS,
  coordinaat,
  vorigeDatum,
  afstandKm,
  upstreamUrl,
  visualCrossingUrl,
  haalJson,
  haalVisualCrossingForecast,
  haalWeatherApiForecast
});