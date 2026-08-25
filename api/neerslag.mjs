import providerHandler from "../lib/neerslag.cjs";

function methodeNietToegestaan(method) {
  const headers = new Headers({
    "Allow": "GET, HEAD",
    "Cache-Control": "private, no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  return new Response(JSON.stringify({ beschikbaar: false, provider: null, reden: "methode niet toegestaan" }), {
    status: 405,
    headers
  });
}

export default {
  async fetch(request) {
    const method = String(request.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") return methodeNietToegestaan(method);

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
      await providerHandler({ query }, response);
    } catch (error) {
      console.error("[api/neerslag] onverwachte serverfout", error);
      statusCode = 503;
      body = { beschikbaar: false, provider: null, reden: "neerslagservice tijdelijk niet beschikbaar" };
    }

    if (body && body.reden === "ongeldige coördinaten") statusCode = 400;

    if (body && body.beschikbaar === false && body.provider === "knmi") {
      console.warn("[api/neerslag] KNMI tijdelijk niet beschikbaar:", body.reden || "onbekende fout");
      body = { ...body, reden: "KNMI-neerslag tijdelijk niet beschikbaar" };
      gedegradeerd = true;
    }

    const internCache = headers.get("Cache-Control");
    if (statusCode >= 400) {
      headers.delete("Vercel-CDN-Cache-Control");
      headers.set("Cache-Control", "private, no-store");
    } else if (gedegradeerd) {
      headers.set("Vercel-CDN-Cache-Control", "s-maxage=15, stale-while-revalidate=15");
      headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    } else if (internCache) {
      headers.set("Vercel-CDN-Cache-Control", internCache);
      headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    }

    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(method === "HEAD" ? null : JSON.stringify(body), { status: statusCode, headers });
  }
};
