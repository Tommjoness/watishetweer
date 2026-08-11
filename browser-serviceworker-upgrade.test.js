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

function metMarker(html,versie){
  const marker='<meta name="sw-e2e-build" content="'+versie+'">';
  if(!html.includes("</head>"))throw new Error("HTML-headanker ontbreekt voor SW-E2E-marker.");
  return html.replace("</head>",marker+"</head>");
}

function instrumenteerWorker(bron,versie){
  const helper=`\nconst __SW_E2E_VERSION=${JSON.stringify(versie)};\nconst __swE2eDiag=(event,extra={})=>fetch("/__swdiag",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({version:__SW_E2E_VERSION,event,...extra})}).catch(()=>{});\n`;
  let uit=bron.replace(/(const CACHE = "[^"]+";)/,"$1"+helper);
  const eisen=[
    ['const CACHE_HANDLE = caches.open(CACHE);','const CACHE_HANDLE = (__swE2eDiag("cache-handle-open"),caches.open(CACHE));'],
    ['self.addEventListener("install", e => {','self.addEventListener("install", e => {\n  __swE2eDiag("install-start");'],
    ['    CACHE_HANDLE.then(c =>\n      // per bestand','    (__swE2eDiag("install-cache-open"),CACHE_HANDLE).then(c =>\n      // per bestand'],
    ['    ).then(() => self.skipWaiting())','    ).then(() => { __swE2eDiag("install-complete"); return self.skipWaiting(); })'],
    ['self.addEventListener("activate", e => {','self.addEventListener("activate", e => {\n  __swE2eDiag("activate-start");'],
    ['      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))','      .then(keys => { __swE2eDiag("activate-keys",{keys}); return Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))); })'],
    ['      .then(() => self.clients.claim())','      .then(() => { __swE2eDiag("activate-complete"); return self.clients.claim(); })']
  ];
  for(const [van,naar] of eisen){
    if(!uit.includes(van))throw new Error(`SW-diagnoseanker ontbreekt voor ${versie}: ${van}`);
    uit=uit.replace(van,naar);
  }
  let runtimePut=0;
  uit=uit.replace(/CACHE_HANDLE\.then\(c => c\.put\(e\.request, copy\)\)/g,()=>{
    runtimePut++;
    return '(__swE2eDiag("runtime-cache-put",{path:url.pathname}),CACHE_HANDLE).then(c => c.put(e.request, copy))';
  });
  if(runtimePut!==2)throw new Error(`Verwacht twee runtime-cachewrites via de generatiehandle in ${versie}, vond ${runtimePut}.`);
  return uit;
}

const indexOud=metMarker(indexNieuw,"old");
const indexFinal=metMarker(indexNieuw,"new");
const swOudBasis=swBasis.replace(/const CACHE = "[^"]+";/,'const CACHE = "'+cacheOud+'";');
if(swOudBasis===swBasis||!swOudBasis.includes(cacheOud))throw new Error("Oude serviceworkerfixture kon niet veilig worden afgeleid.");
const swOud=instrumenteerWorker(swOudBasis,"old");
const swNieuw=instrumenteerWorker(swBasis,"new");

let fase="old";
const serverStart=Date.now();
const verzoeken=[];
const lifecycle=[];
const mime={
  ".html":"text/html; charset=utf-8",
  ".js":"application/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".woff2":"font/woff2",
  ".png":"image/png"
};
const server=http.createServer((req,res)=>{
  const pathname=(req.url||"/").split("?")[0];
  if(pathname==="/__swdiag"&&req.method==="POST"){
    let body="";
    req.on("data",d=>{body+=d;});
    req.on("end",()=>{
      try{lifecycle.push({ms:Date.now()-serverStart,fase,...JSON.parse(body)});}catch(err){lifecycle.push({ms:Date.now()-serverStart,fase,event:"diag-parse-error",error:String(err)});}
      res.writeHead(204,{"cache-control":"no-store"});res.end();
    });
    return;
  }
  verzoeken.push({ms:Date.now()-serverStart,fase,path:pathname});
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

async function marker(page){
  return page.locator('meta[name="sw-e2e-build"]').getAttribute("content");
}
async function cacheSleutels(page){return page.evaluate(()=>caches.keys());}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const url=`http://127.0.0.1:${server.address().port}/`;
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({serviceWorkers:"allow"});
  const page=await context.newPage();
  const pageErrors=[];page.on("pageerror",e=>pageErrors.push(String(e)));
  try{
    /* 1. Begin werkelijk op de oude app-shell en laat diens worker de client claimen. */
    await page.goto(url,{waitUntil:"load"});
    assert.equal(await marker(page),"old","initiële navigatie moet de oude fixture tonen");
    await page.waitForFunction(async()=>{
      const r=await navigator.serviceWorker.getRegistration();
      return !!(r&&r.active&&r.active.state==="activated"&&navigator.serviceWorker.controller);
    },null,{timeout:10000});
    let keys=await cacheSleutels(page);
    assert(keys.includes(cacheOud),"oude serviceworker moet zijn eigen app-shellcache hebben");
    assert(!keys.includes(cacheNieuw),"nieuwe cache mag vóór update nog niet bestaan");

    /* Diagnostiek: bemonster cache- en workerstates fijnmazig rond de update. */
    await page.evaluate(()=>{
      window.__swDiag=[];
      window.__swDiagStart=performance.now();
      window.__swDiagBusy=false;
      window.__swDiagTimer=setInterval(async()=>{
        if(window.__swDiagBusy)return;
        window.__swDiagBusy=true;
        try{
          const keys=await caches.keys();
          const r=await navigator.serviceWorker.getRegistration();
          window.__swDiag.push({
            ms:Math.round((performance.now()-window.__swDiagStart)*10)/10,
            keys,
            active:r&&r.active?r.active.state:null,
            installing:r&&r.installing?r.installing.state:null,
            waiting:r&&r.waiting?r.waiting.state:null,
            controller:navigator.serviceWorker.controller?navigator.serviceWorker.controller.scriptURL:null
          });
        }finally{window.__swDiagBusy=false;}
      },5);
    });
    await page.waitForTimeout(25);

    /* 2. Publiceer exact de definitieve worker en dwing de normale browser-updatecheck af. */
    fase="new";
    await page.evaluate(async()=>{
      const r=await navigator.serviceWorker.getRegistration();
      if(!r)throw new Error("Serviceworkerregistratie ontbreekt vóór update.");
      await r.update();
    });
    await page.waitForFunction(async({nieuw,oud})=>{
      const keys=await caches.keys();
      const r=await navigator.serviceWorker.getRegistration();
      return !!(r&&r.active&&r.active.state==="activated"&&keys.includes(nieuw)&&!keys.includes(oud));
    },{nieuw:cacheNieuw,oud:cacheOud},{timeout:15000});

    /* Geef eventuele late writes van de oude worker bewust tijd om zichtbaar te worden. */
    await page.waitForTimeout(350);
    const diag=await page.evaluate(()=>{
      clearInterval(window.__swDiagTimer);
      return window.__swDiag||[];
    });
    await page.waitForTimeout(50);
    const overgangen=[];
    for(const x of diag){
      const compact={
        ms:x.ms,
        oud:x.keys.includes(cacheOud),
        nieuw:x.keys.includes(cacheNieuw),
        active:x.active,
        installing:x.installing,
        waiting:x.waiting
      };
      const vorige=overgangen[overgangen.length-1];
      if(!vorige||vorige.oud!==compact.oud||vorige.nieuw!==compact.nieuw||vorige.active!==compact.active||vorige.installing!==compact.installing||vorige.waiting!==compact.waiting)overgangen.push(compact);
    }
    console.log("SW_DIAG_TRANSITIONS "+JSON.stringify(overgangen));
    console.log("SW_DIAG_REQUESTS "+JSON.stringify(verzoeken.filter(v=>v.path==="/"||v.path==="/index.html"||v.path==="/sw.js")));
    console.log("SW_LIFECYCLE_DIAG "+JSON.stringify(lifecycle));
    const schoonIndex=diag.findIndex(x=>x.keys.includes(cacheNieuw)&&!x.keys.includes(cacheOud)&&x.active==="activated");
    const herleeft=schoonIndex>=0&&diag.slice(schoonIndex+1).some(x=>x.keys.includes(cacheOud));
    if(herleeft)throw new Error("BEWEZEN SERVICEWORKER-CACHERACE: oude WeatherNow-cache verdween na activate en werd daarna opnieuw aangemaakt.");

    keys=await cacheSleutels(page);
    assert(keys.includes(cacheNieuw),"nieuwe worker moet de definitieve app-shellcache hebben");
    assert(!keys.includes(cacheOud),"activate moet de oude WeatherNow-cache blijvend verwijderen");

    /* 3. Eén online navigatie moet aantoonbaar de nieuwe HTML tonen en opslaan. */
    const online=await page.reload({waitUntil:"load"});
    assert(online&&online.ok(),"online reload na worker-update moet slagen");
    assert.equal(await marker(page),"new","na update moet de nieuwe app-shell zichtbaar zijn");

    /* 4. Daarna netwerk volledig uit: navigatie en shellasset moeten uit dezelfde nieuwe cache komen. */
    await context.setOffline(true);
    const offline=await page.reload({waitUntil:"domcontentloaded",timeout:10000});
    assert(offline,"offline navigatie moet een response uit de serviceworker ontvangen");
    assert.equal(typeof offline.fromServiceWorker,"function");
    assert.equal(offline.fromServiceWorker(),true,"offline navigatie moet werkelijk door de serviceworker worden afgehandeld");
    assert.equal(await marker(page),"new","offline fallback mag nooit terugvallen naar de oude app-shell");
    const shell=await page.evaluate(async()=>{
      const [manifest,icoon]=await Promise.all([fetch("manifest.json"),fetch("icon-192.png")]);
      return {manifest:manifest.ok,icoon:icoon.ok};
    });
    assert.deepEqual(shell,{manifest:true,icoon:true},"definitieve shellassets moeten offline uit cache beschikbaar blijven");
    assert.deepEqual(pageErrors,[],"serviceworker-upgrade/offlinepad mag geen pageerror veroorzaken");

    console.log("Serviceworker-E2E geslaagd: oude cache → definitieve worker → oude cache verwijderd → nieuwe shell online → nieuwe shell en assets offline.");
  }finally{
    await page.evaluate(()=>{if(window.__swDiagTimer)clearInterval(window.__swDiagTimer);}).catch(()=>{});
    await context.setOffline(false).catch(()=>{});
    await context.close().catch(()=>{});
    await browser.close().catch(()=>{});
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{
  console.error(err&&err.stack||err);
  try{server.close(()=>{});}catch(_){ }
  process.exit(1);
});
