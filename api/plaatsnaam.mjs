import legacyHandler from "../lib/plaatsnaam.cjs";

function methodeNietToegestaan() {
  const headers = new Headers({
    "Allow": "GET, HEAD",
    "Cache-Control": "private, no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  return new Response(JSON.stringify({ naam: null, land: null, reden: "methode niet toegestaan" }), {
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
    } catch (error) {
      console.error("[api/plaatsnaam] onverwachte serverfout", error);
      statusCode = 503;
      body = { naam: null, land: null, reden: "plaatsnaamservice tijdelijk niet beschikbaar" };
    }

    const reden = String(body && body.reden || "");
    if (reden.startsWith("viaNominatim:")) {
      console.warn("[api/plaatsnaam] Nominatim tijdelijk niet beschikbaar:", reden.slice("viaNominatim:".length).trim());
      body = { naam: null, land: null, reden: "plaatsnaambron tijdelijk niet beschikbaar" };
      gedegradeerd = true;
    }

    const internCache = headers.get("Cache-Control");
    if (statusCode >= 400) {
      headers.delete("Cloudflare-CDN-Cache-Control");
      headers.set("Cache-Control", "private, no-store");
    } else if (gedegradeerd) {
      headers.set("Cloudflare-CDN-Cache-Control", "s-maxage=30, stale-while-revalidate=30");
      headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    } else if (internCache) {
      headers.set("Cloudflare-CDN-Cache-Control", internCache);
      headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    }

    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(method === "HEAD" ? null : JSON.stringify(body), { status: statusCode, headers });
  }
};
