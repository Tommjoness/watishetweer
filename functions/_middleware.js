const SECURITY_HEADERS=Object.freeze({
  "X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"strict-origin-when-cross-origin",
  "X-Frame-Options":"DENY",
  "Cross-Origin-Opener-Policy":"same-origin",
  "Strict-Transport-Security":"max-age=31536000",
  "Permissions-Policy":"geolocation=(self), camera=(), microphone=()",
  "Content-Security-Policy":"default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://api.open-meteo.com https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com https://api.bigdatacloud.net; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
});

export async function onRequest(context){
  const isServiceWorker=new URL(context.request.url).pathname==="/sw.js";
  const response=isServiceWorker
    ?await context.env.ASSETS.fetch(context.request)
    :await context.next();
  const headers=new Headers(response.headers);
  for(const [name,value] of Object.entries(SECURITY_HEADERS))headers.set(name,value);
  if(isServiceWorker)headers.set("Cache-Control","public, no-store, max-age=0, must-revalidate");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
