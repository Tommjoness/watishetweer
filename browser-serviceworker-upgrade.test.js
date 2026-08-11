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
const swNieuw=fs.readFileSync(swPad,"utf8");
const cacheMatch=/const CACHE = "([^"]+)";/.exec(swNieuw);
if(!cacheMatch)throw new Error("Definitieve serviceworker-cache-id ontbreekt.");
const cacheNieuw=cacheMatch[1];
const cacheOud="watishetweer-deadbeef0000";
if(cacheNieuw===cacheOud)throw new Error("Testcache botst met definitieve cache-id.");

function metMarker(html,versie){
  const marker='<meta name="sw-e2e-build" content="'+versie+'">';
  if(!html.includes("</head>"))throw new Error("HTML-headanker ontbreekt voor SW-E2E-marker.");
  return html.replace("</head>",marker+"</head>");
}
const indexOud=metMarker(indexNieuw,"old");
const indexFinal=metMarker(indexNieuw,"new");
const swOud=swNieuw.replace(/const CACHE = "[^"]+";/,'const CACHE = "'+cacheOud+'";');
if(swOud===swNieuw||!swOud.includes(cacheOud))throw new Error("Oude serviceworkerfixture kon niet veilig worden afgeleid.");

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
    keys=await cacheSleutels(page);
    assert(keys.includes(cacheNieuw),"nieuwe worker moet de definitieve app-shellcache hebben");
    assert(!keys.includes(cacheOud),"activate moet de oude WeatherNow-cache verwijderen");

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
