import legacyHandler from "../lib/waarschuwingen.cjs";
import scopeModule from "../lib/waarschuwing-scope.cjs";

const { alleenPlaatsgebonden } = scopeModule;

function methodeNietToegestaan() {
  const headers = new Headers({
    "Allow": "GET, HEAD",
    "Cache-Control": "private, no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  return new Response(JSON.stringify({ bron: null, dekking: false, lijst: [], reden: "methode niet toegestaan" }), {
    status: 405,
    headers
  });
}

export default {
  async fetch(request) {
    const method = String(request.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") return methodeNietToegestaan();

    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());
    let statusCode = 200;
    let body = null;
    let gedegradeerd = false;
    const headers = new Headers();
    const response = {
      setHeader(name, value) { headers.set(name, String(value)); },
      status(code) { statusCode = Number(code); return response; },
      json(value) { body = value; return response; }
    };

    try {
      await legacyHandler({ query }, response);
      body = alleenPlaatsgebonden(body);
    } catch (error) {
      console.error("[api/waarschuwingen] onverwachte serverfout", error);
      statusCode = 503;
      body = { bron: null, dekking: false, lijst: [], reden: "waarschuwingsservice tijdelijk niet beschikbaar" };
    }

    if (body && body.reden === "geen geldige locatie") statusCode = 400;

    if (body && body.dekking === false && (body.reden === "bron onbereikbaar" || body.reden === "land onbekend")) {
      console.warn("[api/waarschuwingen] provider tijdelijk gedegradeerd:", body.bron || body.reden);
      gedegradeerd = true;
    }

    const internCache = headers.get("Cache-Control");
    if (statusCode >= 400) {
      headers.delete("Vercel-CDN-Cache-Control");
      headers.set("Cache-Control", "private, no-store");
    } else if (gedegradeerd) {
      headers.set("Vercel-CDN-Cache-Control", "s-maxage=30, stale-while-revalidate=30");
      headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    } else if (internCache) {
      headers.set("Vercel-CDN-Cache-Control", internCache);
      headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    }

    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(method === "HEAD" ? null : JSON.stringify(body), { status: statusCode, headers });
  }
};
