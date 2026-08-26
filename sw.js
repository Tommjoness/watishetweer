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
const SHELL_VERPLICHT = new Set(["./","./index.html"]);

/* Een nieuwe worker kan zijn installrequests uitvoeren terwijl de vorige worker
   dezelfde client/origin nog controleert. Een gewone c.add('./index.html') kan
   daardoor via de oude cache-first fetchhandler oude HTML terugkrijgen. Vraag de
   shell daarom met een generatiegebonden query op; die bestaat nooit in een oude
   cache. Sla de response daarna bewust onder de canonieke, queryloze sleutel van
   de nieuwe CACHE op. Root en index zijn verplicht: zonder die twee activeert de
   nieuwe worker niet met een onvolledige/offline-onbruikbare shell. */
async function cacheerShellBestand(cache,u){
  const canoniek=new URL(u,self.location.href);
  const vers=new URL(canoniek.href);
  vers.searchParams.set("__sw_install",CACHE);
  try{
    const r=await fetch(new Request(vers.href,{cache:"reload"}));
    if(!r.ok)throw new Error("shell fetch "+r.status+" voor "+canoniek.pathname);
    await cache.put(new Request(canoniek.href),r);
  }catch(err){
    if(SHELL_VERPLICHT.has(u))throw err;
  }
}

self.addEventListener("install", e => {
  /* Zet de activatie-intentie meteen wanneer install begint. De worker kan
     hierdoor niet onnodig in waiting blijven hangen achter de vorige controller.
     event.waitUntil bewaakt onafhankelijk daarvan de volledige shellinstallatie:
     activering kan dus pas plaatsvinden nadat alle verplichte cachewrites klaar
     zijn en een mislukte verplichte shellfetch laat install nog steeds falen. */
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => cacheerShellBestand(c,u))))
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