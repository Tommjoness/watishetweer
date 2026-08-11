const CACHE = "watishetweer-v1";
/* Eén cachehandle per worker-generatie. Een oude worker mag na activatie van een
   opvolger nooit via caches.open(CACHE) zijn verwijderde naam heraanmaken. Een
   bestaande Cache-handle blijft na CacheStorage.delete wel bruikbaar voor een
   reeds lopende fetch, maar wordt niet opnieuw onder die oude naam geregistreerd. */
const CACHE_HANDLE = caches.open(CACHE);
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

self.addEventListener("install", e => {
  e.waitUntil(
    CACHE_HANDLE.then(c =>
      // per bestand, zodat één ontbrekend bestand de hele installatie niet sloopt
      Promise.all(SHELL.map(u => c.add(u).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      /* Een fetch van de vorige worker kan precies tijdens activate nog met zijn
         bestaande Cache-handle afronden. Onder CI-belasting bleek 150 ms daarvoor
         niet altijd genoeg: zo'n late response kon de verwijderde cachenaam na
         onze sweep opnieuw zichtbaar maken. Geef de oude generatie één korte,
         begrensde uitlooptijd en ruim daarna pas definitief op. Een oudere worker
         mag intussen nooit de cache van een al installerende opvolger verwijderen;
         alleen de nieuwste generatie doet daarom deze late sweep. */
      .then(() => new Promise(resolve => setTimeout(resolve, 650)))
      .then(() => {
        if (self.registration.installing || self.registration.waiting) return;
        return caches.keys()
          .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))));
      })
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // weer- en luchtdata nooit uit cache serveren
  if (/open-meteo\.com$|bigdatacloud\.net$/.test(url.hostname)) return;
  if (url.pathname.startsWith("/api/")) return;   // serverfuncties altijd vers
  if (url.origin !== location.origin) return;

  // app-shell: netwerk eerst voor index.html zodat updates direct doorkomen
  if (e.request.mode === "navigate" || url.pathname.endsWith("index.html")) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        return CACHE_HANDLE.then(c => c.put(e.request, copy)).then(() => r);
      }).catch(() => caches.match(e.request)
          .then(hit => hit || caches.match("./index.html"))
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

  /* Zonder vangnet werd een mislukte ophaalpoging een onafgevangen belofte, en
     dan geeft respondWith een netwerkfout terug in plaats van door te vallen naar
     de browser. Dat leverde "Failed to fetch at sw.js" op in de console. */
  e.respondWith(
    caches.match(e.request)
      .then(hit => hit || fetch(e.request).then(r => {
        const copy = r.clone();
        return CACHE_HANDLE.then(c => c.put(e.request, copy)).then(() => r);
      }))
      .catch(() => caches.match(e.request).then(hit => hit || Response.error()))
  );
});
