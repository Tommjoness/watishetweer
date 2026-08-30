const CACHE_SCHEMA = "v1";
const CACHE_HEADER = "X-WIW-Edge-Cache";

const ROUTES = Object.freeze({
  plaatsnaam: Object.freeze({
    coordDecimals: 4,
    gebruiktLand: false,
    cachebaar(body) {
      return Boolean(body && body.bron === "viaNominatim" && !body.reden);
    }
  }),
  neerslag: Object.freeze({
    coordDecimals: 5,
    gebruiktLand: true,
    cachebaar(body) {
      if (!body) return false;
      if (body.beschikbaar === true && body.provider === "knmi") return true;
      return body.beschikbaar === false && body.provider == null
        && body.reden === "geen actuele neerslagprovider voor deze locatie";
    }
  }),
  waarschuwingen: Object.freeze({
    coordDecimals: null,
    gebruiktLand: true,
    cachebaar(body) {
      if (!body) return false;
      if (body.dekking === true) return true;
      return body.dekking === false && body.bron == null
        && typeof body.reden === "string"
        && body.reden.startsWith("geen waarschuwingsbron voor ");
    }
  })
});

function geldigeCoordinaat(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function canoniekGetal(waarde, decimalen) {
  const n = Number(waarde);
  if (!Number.isFinite(n)) return null;
  if (decimalen == null) return String(Object.is(n, -0) ? 0 : n);
  return n.toFixed(decimalen);
}

function canoniekeLandcode(waarde) {
  const land = String(waarde || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(land) ? land : "";
}

export function canoniekeCacheUrl(request, routeNaam) {
  const config = ROUTES[routeNaam];
  if (!config) return null;
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!geldigeCoordinaat(lat, lon)) return null;

  const sleutel = new URL(url.origin + url.pathname);
  sleutel.searchParams.set("__wiw_cache", CACHE_SCHEMA);
  sleutel.searchParams.set("lat", canoniekGetal(lat, config.coordDecimals));
  sleutel.searchParams.set("lon", canoniekGetal(lon, config.coordDecimals));
  if (config.gebruiktLand) {
    const land = canoniekeLandcode(url.searchParams.get("land"));
    if (land) sleutel.searchParams.set("land", land);
  }
  return sleutel.toString();
}

function explicieteBypass(request) {
  if (String(request.method || "GET").toUpperCase() !== "GET") return true;
  if (request.headers.get("authorization") || request.headers.get("cookie")) return true;
  const cc = String(request.headers.get("cache-control") || "").toLowerCase();
  const pragma = String(request.headers.get("pragma") || "").toLowerCase();
  return /(?:^|,)\s*(?:no-cache|no-store)\b/.test(cc) || pragma.includes("no-cache");
}

function edgeTtl(response) {
  const bron = response.headers.get("cloudflare-cdn-cache-control")
    || response.headers.get("cache-control") || "";
  const match = /(?:^|,)\s*s-maxage=(\d+)/i.exec(bron);
  const ttl = match ? Number(match[1]) : 0;
  return Number.isFinite(ttl) && ttl > 0 ? Math.min(ttl, 86400) : 0;
}

async function leesJson(response) {
  try { return await response.clone().json(); }
  catch { return null; }
}

async function responseCachebaar(routeNaam, response) {
  const config = ROUTES[routeNaam];
  if (!config || response.status !== 200) return false;
  if (!/application\/json/i.test(response.headers.get("content-type") || "")) return false;
  return config.cachebaar(await leesJson(response));
}

function metCacheStatus(response, status) {
  const headers = new Headers(response.headers);
  headers.set(CACHE_HEADER, status);
  if (status === "HIT") headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function cacheOps(context) {
  if (context && context.cache && typeof context.cache.match === "function") return context.cache;
  try {
    if (globalThis.caches && globalThis.caches.default) return globalThis.caches.default;
  } catch {}
  return null;
}

export async function metEdgeCache(context, routeNaam, maakResponse) {
  const request = context && context.request;
  if (!request || explicieteBypass(request)) return metCacheStatus(await maakResponse(), "BYPASS");

  const keyUrl = canoniekeCacheUrl(request, routeNaam);
  const cache = cacheOps(context);
  if (!keyUrl || !cache) return metCacheStatus(await maakResponse(), "BYPASS");

  const key = new Request(keyUrl, { method: "GET" });
  try {
    const hit = await cache.match(key);
    if (hit) return metCacheStatus(hit, "HIT");
  } catch (error) {
    console.warn(`[edge-cache:${routeNaam}] cache.match mislukt`, error);
    return metCacheStatus(await maakResponse(), "BYPASS");
  }

  const response = await maakResponse();
  const ttl = edgeTtl(response);
  if (!(ttl > 0 && await responseCachebaar(routeNaam, response))) return metCacheStatus(response, "BYPASS");

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `public, max-age=${ttl}`);
  headers.delete(CACHE_HEADER);
  const kopie = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });

  /* De observability-header is bewijs, geen intentie. Een MISS wordt daarom pas
     teruggegeven nadat caches.default.put werkelijk is voltooid. Mislukt de
     write, dan blijft de API-response gewoon bruikbaar maar rapporteren we
     BYPASS zodat een cachepoging nooit als succesvolle opslag wordt verkocht. */
  try {
    await cache.put(key, kopie);
  } catch (error) {
    console.warn(`[edge-cache:${routeNaam}] cache.put mislukt`, error);
    return metCacheStatus(response, "BYPASS");
  }
  return metCacheStatus(response, "MISS");
}

export const _intern = Object.freeze({
  CACHE_HEADER,
  CACHE_SCHEMA,
  ROUTES,
  canoniekGetal,
  canoniekeLandcode,
  geldigeCoordinaat,
  explicieteBypass,
  edgeTtl,
  responseCachebaar
});
