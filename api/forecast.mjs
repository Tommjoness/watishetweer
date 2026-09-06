import { normaliseerWeatherApi } from "../lib/weatherapi-forecast.mjs";

const WEATHERAPI_ROOT = "https://api.weatherapi.com/v1";
const UPSTREAM_TIMEOUT_MS = 3000;

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

    const key = String(env && env.WEATHERAPI_KEY || "").trim();
    if (!key) {
      return json({ beschikbaar: false, provider: "weatherapi", reden: "secundaire weerservice niet geconfigureerd" }, 503, {
        "Retry-After": "300"
      }, head);
    }

    try {
      const forecastUrl = upstreamUrl("/forecast.json", key, lat, lon, {
        days: 7,
        aqi: "no",
        alerts: "no",
        lang: "nl"
      });
      const forecast = await haalJson(forecastUrl, request.signal);
      if (afstandKm(lat, lon, forecast && forecast.location && forecast.location.lat, forecast && forecast.location && forecast.location.lon) > 25) {
        throw new Error("WeatherAPI-locatie wijkt af van de aanvraag");
      }
      const gisteren = vorigeDatum(forecast && forecast.location && forecast.location.localtime);
      let history = null;
      if (gisteren) {
        try {
          history = await haalJson(upstreamUrl("/history.json", key, lat, lon, { dt: gisteren, lang: "nl" }), request.signal, 1000);
        } catch (error) {
          if (request.signal && request.signal.aborted) throw error;
        }
      }
      const body = normaliseerWeatherApi(forecast, history);
      return json(body, 200, { "X-WIW-Weather-Source": "weatherapi" }, head);
    } catch (error) {
      if (request.signal && request.signal.aborted) throw error;
      return json({ beschikbaar: false, provider: "weatherapi", reden: "secundaire weerservice tijdelijk niet beschikbaar" }, 503, {
        "Retry-After": "60"
      }, head);
    }
  }
};

export const _intern = Object.freeze({
  WEATHERAPI_ROOT,
  UPSTREAM_TIMEOUT_MS,
  coordinaat,
  vorigeDatum,
  afstandKm,
  upstreamUrl,
  haalJson
});
