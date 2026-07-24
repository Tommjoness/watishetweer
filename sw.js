const CACHE = "weerbriefing-v42";
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
    caches.open(CACHE).then(c =>
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
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // weer- en luchtdata nooit uit cache serveren
  if (/open-meteo\.com$|bigdatacloud\.net$|rainviewer\.com$|cartocdn\.com$/.test(url.hostname)) return;
  if (url.pathname.startsWith("/api/")) return;   // waarschuwingen altijd vers
  if (url.origin !== location.origin) return;

  // app-shell: netwerk eerst voor index.html zodat updates direct doorkomen
  if (e.request.mode === "navigate" || url.pathname.endsWith("index.html")) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return r;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return r;
    }))
  );
});
