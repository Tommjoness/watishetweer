const CACHE = "watishetweer-v1";
const SHELL = [
  "./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png",
  "./bodoni-moda-latin-400-normal.woff2",
  "./bodoni-moda-latin-500-normal.woff2",
  "./instrument-sans-latin-400-normal.woff2",
  "./instrument-sans-latin-500-normal.woff2",
  "./instrument-sans-latin-600-normal.woff2",
  "./dm-mono-latin-400-normal.woff2",
  "./dm-mono-latin-500-normal.woff2"
              ];

/* De app-shell is volledig versioned en wordt uitsluitend tijdens install
   opgebouwd. Een oude worker schrijft daarna nooit meer naar zijn eigen cache.
   Daardoor kan een verwijderde generatiecache tijdens een update niet opnieuw
   met nieuwe runtime-inhoud worden gevuld. */
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // per bestand, zodat één ontbrekend bestand de hele installatie niet sloopt
      Promise.all(SHELL.map(u => c.add(u).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

/* Oude generaties worden op activate opgeruimd. CacheStorage kan tijdens een
   browsertransitie kort een oude naam blijven rapporteren; fetches vertrouwen
   daarom nooit op globale CacheStorage-volgorde maar uitsluitend op CACHE. */
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const uitHuidigeCache = request => caches.match(request,{cacheName:CACHE});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // weer- en luchtdata nooit uit cache serveren
  if (/open-meteo\.com$|bigdatacloud\.net$/.test(url.hostname)) return;
  if (url.pathname.startsWith("/api/")) return;   // serverfuncties altijd vers
  if (url.origin !== location.origin) return;

  /* Navigatie blijft netwerk-eerst zodat een online bezoek direct de deployment
     ziet. Offline valt die uitsluitend terug op de install-cache van déze worker;
     een eventueel nog zichtbare oude cache kan dus geen oude pagina teruggeven. */
  if (e.request.mode === "navigate" || url.pathname.endsWith("index.html")) {
    e.respondWith(
      fetch(e.request).catch(() => uitHuidigeCache(e.request)
          .then(hit => hit || uitHuidigeCache("./index.html"))
          // komt ook daar niets uit, dan een leesbare melding in plaats van een
          // lege belofte, want respondWith(undefined) is opnieuw een netwerkfout
          .then(hit => hit || new Response(
            "<!doctype html><meta charset=utf-8><title>Geen verbinding</title>"
            + "<p style=\"font:16px system-ui;padding:2rem\">Geen verbinding en niets in de cache. "
            + "Probeer het opnieuw zodra je weer online bent.",
            { headers: { "Content-Type": "text/html; charset=utf-8" } })))
    );
    return;
  }

  /* De volledige app-shell is al tijdens install gecachet. Ook hier wordt alleen
     de huidige generatie geraadpleegd; niet-shellresources worden online gewoon
     opgehaald en krijgen geen runtime-cache-eigenaarschap. */
  e.respondWith(
    uitHuidigeCache(e.request)
      .then(hit => hit || fetch(e.request))
      .catch(() => uitHuidigeCache(e.request).then(hit => hit || Response.error()))
  );
});
