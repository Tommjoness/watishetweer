import legacyHandler from "../lib/knmi-neerslag.cjs";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());
    let statusCode = 200;
    let body = null;
    const headers = new Headers();
    const response = {
      setHeader(name, value) { headers.set(name, String(value)); },
      status(code) { statusCode = Number(code); return response; },
      json(value) { body = value; return response; }
    };

    await legacyHandler({ query }, response);
    const internCache = headers.get("Cache-Control");
    if (internCache) {
      headers.set("Vercel-CDN-Cache-Control", internCache);
      headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    }
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(body), { status: statusCode, headers });
  }
};
