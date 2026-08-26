import worker from "../../api/neerslag.mjs";

function voorCloudflare(response) {
  const headers = new Headers(response.headers);
  const cdnCache = headers.get("Vercel-CDN-Cache-Control");
  if (cdnCache) {
    headers.set("Cloudflare-CDN-Cache-Control", cdnCache);
    headers.delete("Vercel-CDN-Cache-Control");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function onRequest(context) {
  return voorCloudflare(await worker.fetch(context.request));
}
