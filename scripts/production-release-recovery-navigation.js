"use strict";

const assert=require("assert");
const {chromium}=require("playwright");

const ROOT=(process.env.PRODUCTION_ROOT||"https://watishetweer.nl").replace(/\/+$/,"");
const EXPECTED_SHA=String(process.env.EXPECTED_SHA||"").trim();

async function ready(page,timeout=20000){
  await page.waitForFunction(()=>document.documentElement.dataset.appBootstrap==="ready",null,{timeout});
}
async function weatherReady(page,timeout=20000){
  await ready(page,timeout);
  await page.waitForSelector("#app",{state:"visible",timeout});
  await page.waitForFunction(()=>{
    const plaats=(document.getElementById("place")?.getAttribute("aria-label")||"").trim();
    const temp=(document.getElementById("t")?.textContent||"").trim();
    return !!plaats&&!!temp;
  },null,{timeout});
}
async function snap(page){
  return page.evaluate(()=>({
    build:document.querySelector('meta[name="weather-build-sha"]')?.content||null,
    app:[...document.scripts].map(s=>s.getAttribute("src")||"").find(s=>/\/app-[0-9a-f]{12}\.min\.js$/.test(s))||null,
    bootstrap:[...document.scripts].map(s=>s.getAttribute("src")||"").find(s=>/\/bootstrap-[0-9a-f]{12}\.min\.js$/.test(s))||null,
    url:location.href,
    plaats:(document.getElementById("place")?.getAttribute("aria-label")||"").trim(),
    canonical:document.querySelector('link[rel="canonical"]')?.href||null,
    stale:document.querySelector('meta[name="wiw-stale-cache-fixture"]')?.content||null
  }));
}
function assertRelease(s,label){
  if(EXPECTED_SHA)assert.equal(s.build,EXPECTED_SHA,`${label}: buildmarker wijkt af van deployment-SHA`);
  assert(/^\/app-[0-9a-f]{12}\.min\.js$/.test(s.app||""),`${label}: actuele app-bundle ontbreekt`);
  assert(/^\/bootstrap-[0-9a-f]{12}\.min\.js$/.test(s.bootstrap||""),`${label}: actuele bootstrap ontbreekt`);
}
async function offlineReloadViaServiceworker(page){
  const fouten=[];
  for(let poging=1;poging<=3;poging++){
    try{
      const url=page.url();
      const timeOrigin=await page.evaluate(()=>performance.timeOrigin);
      const responsePromise=page.waitForResponse(response=>{
        const request=response.request();
        return request.url()===url&&request.isNavigationRequest()&&request.frame()===page.mainFrame();
      },{timeout:15000});
      const documentPromise=page.waitForFunction(v=>performance.timeOrigin!==v,timeOrigin,{timeout:15000});
      await page.evaluate(()=>{setTimeout(()=>location.reload(),0);});
      const [responseResult,documentResult]=await Promise.allSettled([responsePromise,documentPromise]);
      const state=await page.evaluate(()=>({
        timeOrigin:performance.timeOrigin,
        type:performance.getEntriesByType("navigation").at(-1)?.type||null,
        ready:document.documentElement.dataset.appBootstrap||null,
        build:document.querySelector('meta[name="weather-build-sha"]')?.content||null
      })).catch(err=>({evaluatiefout:String(err&&err.message||err)}));
      const response=responseResult.status==="fulfilled"?responseResult.value:null;
      if(response&&typeof response.fromServiceWorker==="function"&&response.fromServiceWorker()&&documentResult.status==="fulfilled"&&state.type==="reload")return response;
      const responseBewijs=responseResult.status==="fulfilled"
        ?`fromSW=${responseResult.value&&responseResult.value.fromServiceWorker()}`
        :`fout=${String(responseResult.reason&&responseResult.reason.message||responseResult.reason).split("\n")[0]}`;
      const documentBewijs=documentResult.status==="fulfilled"
        ?"nieuwe-documenttijd=true"
        :`fout=${String(documentResult.reason&&documentResult.reason.message||documentResult.reason).split("\n")[0]}`;
      fouten.push(`poging ${poging}: response(${responseBewijs}), document(${documentBewijs}), state=${JSON.stringify(state)}, vorigeTimeOrigin=${timeOrigin}`);
    }catch(err){
      fouten.push(`poging ${poging}: ${String(err&&err.message||err).split("\n")[0]}`);
    }
    if(poging<3)await new Promise(resolve=>setTimeout(resolve,500*poging));
  }
  throw new Error(`offline reload leverde na 3 pogingen geen serviceworker-response; ${fouten.join(" | ")}`);
}
function childCdpSession(root,sessionId){
  let volgnummer=0,gesloten=false;
  const wachtend=new Map();
  const ontvang=event=>{
    if(event.sessionId!==sessionId)return;
    let bericht;
    try{bericht=JSON.parse(event.message);}catch(_){return;}
    const item=wachtend.get(bericht.id);
    if(!item)return;
    wachtend.delete(bericht.id);
    clearTimeout(item.timer);
    if(bericht.error)item.reject(new Error(`${item.method}: ${bericht.error.message||JSON.stringify(bericht.error)}`));
    else item.resolve(bericht.result||{});
  };
  root.on("Target.receivedMessageFromTarget",ontvang);
  return {
    send(method,params={}){
      if(gesloten)return Promise.reject(new Error(`CDP-workersessie is gesloten voor ${method}`));
      const id=++volgnummer;
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{
          wachtend.delete(id);
          reject(new Error(`${method}: geen worker-CDP-antwoord binnen 5000 ms`));
        },5000);
        wachtend.set(id,{resolve,reject,timer,method});
        root.send("Target.sendMessageToTarget",{sessionId,message:JSON.stringify({id,method,params})})
          .catch(err=>{
            const item=wachtend.get(id);
            if(!item)return;
            wachtend.delete(id);clearTimeout(item.timer);reject(err);
          });
      });
    },
    async close(){
      if(gesloten)return;
      gesloten=true;
      root.off("Target.receivedMessageFromTarget",ontvang);
      for(const item of wachtend.values()){
        clearTimeout(item.timer);
        item.reject(new Error(`CDP-workersessie gesloten tijdens ${item.method}`));
      }
      wachtend.clear();
      await root.send("Target.detachFromTarget",{sessionId}).catch(()=>{});
      await root.detach().catch(()=>{});
    }
  };
}
async function koppelActieveWorkerNetwerk(browser,page){
  const root=await browser.newBrowserCDPSession();
  try{
    await root.send("Target.setDiscoverTargets",{discover:true});
    const scriptURL=await page.evaluate(()=>navigator.serviceWorker.controller&&navigator.serviceWorker.controller.scriptURL||null);
    assert(scriptURL,"actieve serviceworker-URL ontbreekt vóór worker-netwerkproef");
    let doel=null,laatste=[];
    const deadline=Date.now()+5000;
    while(Date.now()<deadline&&!doel){
      await page.evaluate(()=>fetch("/index.html",{cache:"reload"}).then(r=>r.arrayBuffer())).catch(()=>{});
      const targets=await root.send("Target.getTargets");
      laatste=(targets.targetInfos||[]).filter(x=>x.type==="service_worker").map(x=>({url:x.url,targetId:x.targetId}));
      doel=(targets.targetInfos||[]).find(x=>x.type==="service_worker"&&x.url===scriptURL)||null;
      if(!doel)await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert(doel,`actieve sw.js-target ontbreekt; verwacht=${scriptURL}; targets=${JSON.stringify(laatste)}`);
    const gekoppeld=await root.send("Target.attachToTarget",{targetId:doel.targetId,flatten:false});
    const child=childCdpSession(root,gekoppeld.sessionId);
    await child.send("Network.enable");
    return {child,scriptURL,targetId:doel.targetId};
  }catch(err){
    await root.detach().catch(()=>{});
    throw err;
  }
}
async function serviceworkerStabiel(page){
  return page.evaluate(async()=>{
    const deadline=Date.now()+15000;
    let laatst=null;
    while(Date.now()<deadline){
      const registratie=await navigator.serviceWorker.getRegistration("/");
      if(registratie&&registratie.waiting)registratie.waiting.postMessage("weathernow:skip-waiting");
      const controller=navigator.serviceWorker.controller;
      laatst={
        controller:!!controller,
        controllerState:controller&&controller.state||null,
        controllerUrl:controller&&controller.scriptURL||null,
        activeState:registratie&&registratie.active&&registratie.active.state||null,
        installingState:registratie&&registratie.installing&&registratie.installing.state||null,
        waitingState:registratie&&registratie.waiting&&registratie.waiting.state||null
      };
      if(controller&&controller.state==="activated"&&registratie&&registratie.active&&registratie.active.state==="activated"&&!registratie.installing&&!registratie.waiting)return {ok:true,...laatst};
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    return {ok:false,...laatst};
  });
}
async function maakStaleCache(page,naam){
  await page.evaluate(async ({naam})=>{
    const c=await caches.open(naam);
    const stale='<!doctype html><html><head><meta name="wiw-stale-cache-fixture" content="old"><meta name="weather-build-sha" content="stale-old"></head><body>STALE OLD SHELL</body></html>';
    const headers={"content-type":"text/html; charset=utf-8"};
    await Promise.all([
      c.put(new URL("/",location.href).href,new Response(stale,{status:200,headers})),
      c.put(new URL("/index.html",location.href).href,new Response(stale,{status:200,headers}))
    ]);
  },{naam});
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    /* Hard refresh: Chromium-cache expliciet uit, dezelfde live release moet terugkomen. */
    {
      const context=await browser.newContext({serviceWorkers:"block"});
      const page=await context.newPage();
      await page.goto(ROOT+"/?lat=52.368&lon=4.904&plaats=Amsterdam&land=NL",{waitUntil:"load",timeout:30000});
      await weatherReady(page);
      const voor=await snap(page);assertRelease(voor,"hard-refresh voor");
      assert.equal(voor.plaats,"Amsterdam","hard-refresh uitgangspunt moet Amsterdam zijn");
      const cdp=await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled",{cacheDisabled:true});
      await page.reload({waitUntil:"load",timeout:30000});
      await weatherReady(page);
      const na=await snap(page);assertRelease(na,"hard-refresh na");
      for(const sleutel of ["build","app","bootstrap","plaats","canonical"])
        assert.equal(na[sleutel],voor[sleutel],`hard refresh wijzigde release-identiteit/state voor ${sleutel}`);
      await cdp.send("Network.setCacheDisabled",{cacheDisabled:false});
      await context.close();
    }

    /* Nieuw tabblad: een verse documentcontext moet dezelfde productie-generatie openen. */
    {
      const context=await browser.newContext({serviceWorkers:"block"});
      const eerste=await context.newPage();
      await eerste.goto(ROOT+"/weer/amsterdam/",{waitUntil:"load",timeout:30000});await weatherReady(eerste);
      const a=await snap(eerste);assertRelease(a,"nieuw-tabblad eerste");
      const tweede=await context.newPage();
      await tweede.goto(ROOT+"/weer/amsterdam/",{waitUntil:"load",timeout:30000});await weatherReady(tweede);
      const b=await snap(tweede);assertRelease(b,"nieuw-tabblad tweede");
      for(const sleutel of ["build","app","bootstrap","plaats","canonical"])
        assert.equal(b[sleutel],a[sleutel],`nieuw tabblad divergeert voor ${sleutel}`);
      await context.close();
    }

    /* Back én Forward: route -> statische hub -> terug -> vooruit -> terug. */
    {
      const context=await browser.newContext({serviceWorkers:"block"});
      const page=await context.newPage();
      await page.goto(ROOT+"/weer/amsterdam/",{waitUntil:"load",timeout:30000});await weatherReady(page);
      const start=await snap(page);assertRelease(start,"history start");
      await page.goto(ROOT+"/weer/",{waitUntil:"load",timeout:30000});
      assert.equal(new URL(page.url()).pathname,"/weer/","history hubnavigatie wijkt af");
      await page.goBack({waitUntil:"commit",timeout:15000});await ready(page);
      const terug=await snap(page);assertRelease(terug,"history back");
      for(const sleutel of ["build","app","bootstrap","plaats","canonical"])
        assert.equal(terug[sleutel],start[sleutel],`Back wijzigt ${sleutel}`);
      await page.goForward({waitUntil:"commit",timeout:15000});
      await page.waitForFunction(()=>location.pathname==="/weer/",null,{timeout:5000});
      await page.goBack({waitUntil:"commit",timeout:15000});await ready(page);
      const terug2=await snap(page);assertRelease(terug2,"history tweede back");
      for(const sleutel of ["build","app","bootstrap","plaats","canonical"])
        assert.equal(terug2[sleutel],start[sleutel],`Back/Forward-cyclus wijzigt ${sleutel}`);
      await context.close();
    }

    /* SW/cache: voeg na activatie expres een oude cachegeneratie toe. Offline
       navigatie moet uitsluitend de actuele install-cache kiezen, inclusief de
       huidige app + bootstrap, en nooit onze stale shell. */
    {
      const context=await browser.newContext({serviceWorkers:"allow"});
      const page=await context.newPage();
      const cdp=await context.newCDPSession(page);
      await Promise.all([cdp.send("Network.enable"),cdp.send("Page.enable")]);
      const staleCache=`watishetweer-e2e-stale-${Date.now()}`;
      let workerNetwerk=null;
      try{
        await page.goto(ROOT+"/?lat=52.368&lon=4.904&plaats=Amsterdam&land=NL",{waitUntil:"load",timeout:30000});
        await weatherReady(page);
        await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
        if(!await page.evaluate(()=>!!navigator.serviceWorker.controller)){
          await page.reload({waitUntil:"load",timeout:30000});await ready(page);
          await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:10000});
        }
        const stabiel=await serviceworkerStabiel(page);
        assert(stabiel.ok,`serviceworker lifecycle werd niet stabiel vóór cacheproef: ${JSON.stringify(stabiel)}`);
        const actief=await snap(page);assertRelease(actief,"SW online");
        const cacheInfo=await page.evaluate(async ({app,bootstrap})=>{
          const keys=await caches.keys(),matches=[];
          for(const naam of keys){
            const c=await caches.open(naam);
            const [appHit,bootHit,indexHit]=await Promise.all([
              c.match(new URL(app,location.href).href),
              c.match(new URL(bootstrap,location.href).href),
              c.match(new URL("/index.html",location.href).href)
            ]);
            if(appHit&&bootHit&&indexHit)matches.push(naam);
          }
          return {keys,matches};
        },{app:actief.app,bootstrap:actief.bootstrap});
        assert(cacheInfo.matches.length>=1,`geen huidige SW-cache bevat index + app + bootstrap; caches=${JSON.stringify(cacheInfo.keys)}`);

        await maakStaleCache(page,staleCache);
        assert((await page.evaluate(naam=>caches.keys().then(x=>x.includes(naam)),staleCache)),"adversarial stale cache kon niet worden aangemaakt");

        const onlineResponse=await page.reload({waitUntil:"load",timeout:30000});
        assert(onlineResponse&&onlineResponse.ok(),"online netwerk-eerst-herlaad vóór offlineproef moet slagen");
        await ready(page,10000);
        const online=await snap(page);assertRelease(online,"SW online herlaad");
        assert.equal(online.stale,null,"online netwerk-eerst-herlaad koos de kunstmatig oude cachegeneratie");
        assert.equal(online.build,actief.build,"online netwerk-eerst-herlaad wijzigde de actieve build");
        assert((await serviceworkerStabiel(page)).ok,"serviceworker lifecycle verloor stabiliteit na online herlaad");
        await maakStaleCache(page,staleCache);

        workerNetwerk=await koppelActieveWorkerNetwerk(browser,page);
        await workerNetwerk.child.send("Network.emulateNetworkConditions",{
          offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1
        });
        const netwerkProbe=await page.evaluate(async token=>{
          try{
            const response=await fetch(`/__wiw_network_must_fail_${token}`,{cache:"no-store"});
            return {gefaald:false,status:response.status};
          }catch(e){return {gefaald:true,fout:String(e)};}
        },Date.now());
        assert(netwerkProbe.gefaald,`browsernetwerk bleef bereikbaar na offline-schakeling: ${JSON.stringify(netwerkProbe)}`);
        const indexResponsePromise=page.waitForResponse(response=>new URL(response.url()).pathname==="/index.html",{timeout:10000});
        const offlineProbePromise=page.evaluate(async()=>{
          try{
            const response=await fetch("/index.html",{cache:"reload"});
            return {ok:response.ok,status:response.status,lengte:(await response.text()).length};
          }catch(e){return {ok:false,status:0,lengte:0,fout:String(e)};}
        });
        const [indexResponse,offlineProbe]=await Promise.all([indexResponsePromise,offlineProbePromise]);
        assert(indexResponse.fromServiceWorker(),"offline index-preflight moet aantoonbaar uit de actieve serviceworker komen");
        assert(offlineProbe.ok&&offlineProbe.lengte>0,`actieve serviceworker leverde geen gecachete index terwijl netwerk offline was: ${JSON.stringify(offlineProbe)}`);
        console.log("Offline serviceworker-preflight:",JSON.stringify({lifecycle:await serviceworkerStabiel(page),workerTarget:{scriptURL:workerNetwerk.scriptURL,targetId:workerNetwerk.targetId},netwerkProbe,offlineProbe,indexFromServiceWorker:indexResponse.fromServiceWorker()}));
        const response=await offlineReloadViaServiceworker(page);
        assert(response&&typeof response.fromServiceWorker==="function"&&response.fromServiceWorker(),"offline reload moet door de actieve serviceworker worden geleverd");
        await ready(page,10000);
        const navigationType=await page.evaluate(()=>performance.getEntriesByType("navigation").at(-1)?.type||null);
        assert.equal(navigationType,"reload","offline serviceworker-navigatie moet aantoonbaar een echte reload zijn");
        const offline=await snap(page);assertRelease(offline,"SW offline");
        assert.equal(offline.stale,null,"offline navigatie koos de kunstmatig oude cachegeneratie");
        assert.equal(offline.build,actief.build,"offline shell wijkt af van actuele build");
        assert.equal(offline.app,actief.app,"offline shell wijkt af van actuele app-bundle");
        assert.equal(offline.bootstrap,actief.bootstrap,"offline shell wijkt af van actuele bootstrap-bundle");
        for(const id of ["q","here","ververs","thema"])
          assert.equal(await page.locator("#"+id).isDisabled(),false,`offline actuele appstart moet ${id} activeren`);
      }finally{
        if(workerNetwerk){
          await workerNetwerk.child.send("Network.emulateNetworkConditions",{
            offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1
          }).catch(()=>{});
          await workerNetwerk.child.close().catch(()=>{});
        }
        await page.evaluate(naam=>caches.delete(naam),staleCache).catch(()=>{});
        await context.close().catch(()=>{});
      }
    }

    console.log("Productie navigatie/cache-herstel geslaagd: hard refresh, nieuw tabblad, Back/Forward en adversarial stale-SW-cache kiezen dezelfde actuele releasegeneratie.");
  }finally{
    await browser.close();
  }
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
