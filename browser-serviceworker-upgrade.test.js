"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium}=require("playwright");

const ROOT=__dirname;
const PUBLIC=path.join(ROOT,"public");
const indexPad=path.join(PUBLIC,"index.html");
const swPad=path.join(PUBLIC,"sw.js");
if(!fs.existsSync(indexPad)||!fs.existsSync(swPad))throw new Error("Definitieve public-artifact ontbreekt voor serviceworker-E2E.");

const indexNieuw=fs.readFileSync(indexPad,"utf8");
const swBasis=fs.readFileSync(swPad,"utf8");
const cacheMatch=/const CACHE = "([^"]+)";/.exec(swBasis);
if(!cacheMatch)throw new Error("Definitieve serviceworker-cache-id ontbreekt.");
const cacheNieuw=cacheMatch[1];
const cacheOud="watishetweer-deadbeef0000";
if(cacheNieuw===cacheOud)throw new Error("Testcache botst met definitieve cache-id.");
assert.equal((swBasis.match(/caches\.open\(CACHE\)/g)||[]).length,1,"definitieve worker opent zijn generatiecache alleen tijdens install");
assert(!/CACHE_HANDLE|\.put\(e\.request/.test(swBasis),"definitieve worker heeft geen runtime-schrijfpad naar zijn generatiecache");
assert(/caches\.match\(request,\{cacheName:CACHE\}\)/.test(swBasis),"offline lookup is tot de huidige generatiecache beperkt");

function metMarker(html,versie){
  const marker='<meta name="sw-e2e-build" content="'+versie+'">';
  if(!html.includes("</head>"))throw new Error("HTML-headanker ontbreekt voor SW-E2E-marker.");
  return html.replace("</head>",marker+"</head>");
}

function instrumenteerWorker(bron,versie){
  const helper=`\nconst __SW_E2E_VERSION=${JSON.stringify(versie)};\nself.addEventListener("message",e=>{if(e.data==="__sw-e2e-version"&&e.ports&&e.ports[0])e.ports[0].postMessage(__SW_E2E_VERSION);});\n`;
  return bron.replace(/(const CACHE = "[^"]+";)/,"$1"+helper);
}

const indexOud=metMarker(indexNieuw,"old");
const indexFinal=metMarker(indexNieuw,"new");
const swOudBasis=swBasis.replace(/const CACHE = "[^"]+";/,'const CACHE = "'+cacheOud+'";');
if(swOudBasis===swBasis||!swOudBasis.includes(cacheOud))throw new Error("Oude serviceworkerfixture kon niet veilig worden afgeleid.");
const swOud=instrumenteerWorker(swOudBasis,"old");
const swNieuw=instrumenteerWorker(swBasis,"new");

let fase="old";
const mime={
  ".html":"text/html; charset=utf-8",
  ".js":"application/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".woff2":"font/woff2",
  ".png":"image/png"
};
const server=http.createServer((req,res)=>{
  const pathname=(req.url||"/").split("?")[0];
  if(pathname==="/"||pathname==="/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
    res.end(fase==="old"?indexOud:indexFinal);return;
  }
  if(pathname==="/sw.js"){
    res.writeHead(200,{"content-type":"application/javascript; charset=utf-8","cache-control":"no-store","service-worker-allowed":"/"});
    res.end(fase==="old"?swOud:swNieuw);return;
  }
  const rel=pathname.startsWith("/")?pathname.slice(1):pathname;
  const bestand=path.join(PUBLIC,rel);
  if(bestand.startsWith(PUBLIC+path.sep)&&fs.existsSync(bestand)&&fs.statSync(bestand).isFile()){
    res.writeHead(200,{"content-type":mime[path.extname(bestand).toLowerCase()]||"application/octet-stream","cache-control":"no-store"});
    fs.createReadStream(bestand).pipe(res);return;
  }
  res.writeHead(404,{"content-type":"text/plain; charset=utf-8"});res.end("not found");
});

async function marker(page){return page.locator('meta[name="sw-e2e-build"]').getAttribute("content");}
async function cacheSleutels(page){return page.evaluate(()=>caches.keys());}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const url=`http://127.0.0.1:${server.address().port}/`;
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({serviceWorkers:"allow"});
  const page=await context.newPage();
  const pageErrors=[];page.on("pageerror",e=>pageErrors.push(String(e)));
  try{
    /* 1. Werkelijk met de oude shell/worker beginnen. */
    await page.goto(url,{waitUntil:"load"});
    assert.equal(await marker(page),"old","initiële navigatie moet de oude fixture tonen");
    await page.waitForFunction(async()=>{
      const r=await navigator.serviceWorker.getRegistration();
      return !!(r&&r.active&&r.active.state==="activated"&&navigator.serviceWorker.controller);
    },null,{timeout:10000});
    let keys=await cacheSleutels(page);
    assert(keys.includes(cacheOud),"oude serviceworker moet zijn eigen app-shellcache hebben");
    assert(!keys.includes(cacheNieuw),"nieuwe cache mag vóór update nog niet bestaan");

    /* 2. Normale updatecheck naar exact de definitieve worker. De worker mag pas
       activeren nadat zijn install-waitUntil klaar is. Chromium kan de zojuist
       gecommitte CacheStorage-entries vanuit de page-context echter een fractie
       later zichtbaar maken dan active/controller.

       De observatie blijft read-only: caches.open() wordt pas gebruikt nadat
       caches.keys() de nieuwe generatiecache al heeft aangetoond. Bij een timeout
       retourneert dezelfde browser-evaluatie de laatste lifecycle-, versie- en
       cachestatus. Daarmee kan CI een echte workerfout onderscheiden van een
       observatierace zonder de 15 s grens of de inhoudelijke eisen te versoepelen. */
    fase="new";
    await page.evaluate(async()=>{
      const r=await navigator.serviceWorker.getRegistration();
      if(!r)throw new Error("Serviceworkerregistratie ontbreekt vóór update.");
      await r.update();
    });
    const installInfo=await page.evaluate(async ({nieuw,timeout,polling})=>{
      const deadline=Date.now()+timeout;
      const vraagVersie=worker=>new Promise(resolve=>{
        if(!worker)return resolve(null);
        const kanaal=new MessageChannel(),timer=setTimeout(()=>resolve(null),150);
        kanaal.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data);};
        try{worker.postMessage("__sw-e2e-version",[kanaal.port2]);}
        catch(_){clearTimeout(timer);resolve(null);}
      });
      let laatste=null;
      while(Date.now()<deadline){
        const r=await navigator.serviceWorker.getRegistration();
        const controller=navigator.serviceWorker.controller||null;
        const keys=await caches.keys();
        const [installingVersie,wachtendVersie,actiefVersie,controllerVersie]=await Promise.all([
          vraagVersie(r&&r.installing),vraagVersie(r&&r.waiting),vraagVersie(r&&r.active),vraagVersie(controller)
        ]);
        laatste={
          installingState:r&&r.installing?r.installing.state:null,
          waitingState:r&&r.waiting?r.waiting.state:null,
          activeState:r&&r.active?r.active.state:null,
          installingVersie,wachtendVersie,actiefVersie,controllerVersie,
          controllerAanwezig:!!controller,
          cacheSleutels:keys
        };
        if(r&&r.active&&r.active.state==="activated"&&controller&&actiefVersie==="new"&&controllerVersie==="new"&&keys.includes(nieuw)){
          const c=await caches.open(nieuw),index=await c.match(new URL("/index.html",location.href).href);
          if(index){
            const tekst=await index.text(),m=/name="sw-e2e-build" content="([^"]+)"/.exec(tekst);
            laatste={...laatste,heeftIndex:true,indexMarker:m&&m[1]||null,indexLengte:tekst.length};
            if(m&&m[1]==="new"){
              const requests=await c.keys();
              return {ok:true,urls:requests.map(x=>x.url),marker:m[1],heeftIndex:true,lengte:tekst.length,laatste};
            }
          }else laatste={...laatste,heeftIndex:false,indexMarker:null,indexLengte:0};
        }
        await new Promise(resolve=>setTimeout(resolve,polling));
      }
      return {ok:false,laatste};
    },{nieuw:cacheNieuw,timeout:15000,polling:25});
    assert(installInfo&&installInfo.ok,"nieuwe worker/controller + install-cache met nieuwe indexmarker moeten binnen 15 s zichtbaar zijn; laatste status="+JSON.stringify(installInfo&&installInfo.laatste));
    assert.equal(installInfo.marker,"new","nieuwe install-cache bevat de nieuwe index vóór online reload; "+JSON.stringify(installInfo));
    assert.equal(installInfo.heeftIndex,true,"geslaagde install-observatie moet de canonieke index bevatten");
    assert(installInfo.lengte>0,"geslaagde install-observatie moet niet-lege index-HTML bevatten");

    /* 3. Maak daarna expres een kwaadaardige oude cache terug met oude HTML.
       Dit bootst het slechtste CacheStorage-randgeval na. De actieve worker mag
       die cache nooit kunnen kiezen, ongeacht cachevolgorde of browser-GC. */
    await page.evaluate(async ({naam,oudeHtml})=>{
      const c=await caches.open(naam),headers={"content-type":"text/html; charset=utf-8"};
      await Promise.all([
        c.put("./",new Response(oudeHtml,{status:200,headers})),
        c.put("./index.html",new Response(oudeHtml,{status:200,headers}))
      ]);
    },{naam:cacheOud,oudeHtml:'<!doctype html><html><head><meta name="sw-e2e-build" content="old"></head><body>STALE OLD SHELL</body></html>'});
    keys=await cacheSleutels(page);
    assert(keys.includes(cacheOud)&&keys.includes(cacheNieuw),"adversarial test bevat bewust oude én nieuwe cache naast elkaar");

    /* Online blijft netwerk-eerst en moet dus de nieuwe deployment tonen. */
    const online=await page.reload({waitUntil:"load"});
    assert(online&&online.ok(),"online reload na worker-update moet slagen");
    assert.equal(await marker(page),"new","online mag de bewust teruggeplaatste oude shell niet tonen");

    /* De oude cache nogmaals aanwezig houden voor de echte offlineproef. */
    await page.evaluate(async ({naam,oudeHtml})=>{
      const c=await caches.open(naam),headers={"content-type":"text/html; charset=utf-8"};
      await c.put("./index.html",new Response(oudeHtml,{status:200,headers}));
    },{naam:cacheOud,oudeHtml:'<!doctype html><html><head><meta name="sw-e2e-build" content="old"></head><body>STALE OLD SHELL</body></html>'});

    /* 4. Netwerk volledig uit. Juist nu bewijst de marker dat de fallback alleen
       de huidige generation-scoped CACHE leest, zelfs als een oude cache bestaat. */
    await context.setOffline(true);
    const offline=await page.reload({waitUntil:"domcontentloaded",timeout:10000});
    assert(offline,"offline navigatie moet een response uit de serviceworker ontvangen");
    assert.equal(typeof offline.fromServiceWorker,"function");
    assert.equal(offline.fromServiceWorker(),true,"offline navigatie moet werkelijk door de serviceworker worden afgehandeld");
    assert.equal(await marker(page),"new","offline fallback moet de nieuwe install-shell kiezen en nooit de oude cache");
    const shell=await page.evaluate(async()=>{
      const [manifest,icoon]=await Promise.all([fetch("manifest.json"),fetch("icon-192.png")]);
      return {manifest:manifest.ok,icoon:icoon.ok};
    });
    assert.deepEqual(shell,{manifest:true,icoon:true},"definitieve shellassets moeten offline uit de huidige cache beschikbaar blijven");
    assert.deepEqual(pageErrors,[],"serviceworker-upgrade/offlinepad mag geen pageerror veroorzaken");

    console.log("Serviceworker-E2E geslaagd: nieuwe worker/controller + install-shell; opzettelijk aanwezige stale cache kan online noch offline oude HTML lekken.");
  }finally{
    await context.setOffline(false).catch(()=>{});
    await page.evaluate(async naam=>{try{await caches.delete(naam);}catch(_){}},cacheOud).catch(()=>{});
    await context.close().catch(()=>{});
    await browser.close().catch(()=>{});
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{
  console.error(err&&err.stack||err);
  try{server.close(()=>{});}catch(_){ }
  process.exit(1);
});
