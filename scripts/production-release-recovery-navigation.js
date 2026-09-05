"use strict";

const assert=require("assert");
const {execFile}=require("child_process");
const {promisify}=require("util");
const {chromium}=require("playwright");

const ROOT=(process.env.PRODUCTION_ROOT||"https://watishetweer.nl").replace(/\/+$/,"");
const EXPECTED_SHA=String(process.env.EXPECTED_SHA||"").trim();
const HEADLESS=process.env.HEADLESS!=="false";
const NATIVE_BROWSER_RELOAD=process.env.NATIVE_BROWSER_RELOAD==="true";
const execFileAsync=promisify(execFile);
const begrensdeMs=(naam,standaard,min,max)=>{
  const waarde=Number(process.env[naam]||standaard);
  return Number.isFinite(waarde)?Math.min(max,Math.max(min,Math.round(waarde))):standaard;
};
const NAVIGATION_INITIAL_COOLDOWN_MS=begrensdeMs("NAVIGATION_INITIAL_COOLDOWN_MS",0,0,60000);
const NAVIGATION_WEATHER_RETRY_BACKOFF_MS=begrensdeMs("NAVIGATION_WEATHER_RETRY_BACKOFF_MS",5000,1000,30000);
const slaap=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function chromiumVenster(page){
  await page.bringToFront();
  const titel=await page.title();
  const gevonden=await execFileAsync("xdotool",[
    "search","--sync","--onlyvisible","--class",".*[Cc]hrom(e|ium).*"
  ],{timeout:5000});
  const ids=[...new Set(String(gevonden.stdout||"").trim().split(/\s+/).filter(Boolean))];
  const vensters=[];
  for(const id of ids){
    const [naam,klasse]=await Promise.all([
      execFileAsync("xdotool",["getwindowname",id],{timeout:2000}).catch(()=>({stdout:""})),
      execFileAsync("xdotool",["getwindowclassname",id],{timeout:2000}).catch(()=>({stdout:""}))
    ]);
    vensters.push({id,naam:String(naam.stdout||"").trim(),klasse:String(klasse.stdout||"").trim()});
  }
  const gekozen=vensters.find(item=>item.naam===titel)
    ||vensters.find(item=>/watishetweer|wat is het weer/i.test(item.naam))
    ||vensters.find(item=>item.naam)
    ||vensters.at(-1);
  assert(gekozen,`geen zichtbaar Chromium-venster gevonden: ${String(gevonden.stderr||"").trim()}`);
  console.log("Native browserreload-venster:",JSON.stringify({titel,vensters,gekozen}));
  return gekozen.id;
}

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
async function openWeather(page,url,label,{reloadOnly=false}={}){
  let laatsteFout=null,laatsteToestand=null;
  for(let poging=1;poging<=3;poging++){
    try{
      if(reloadOnly||poging>1)await page.reload({waitUntil:"load",timeout:30000});
      else await page.goto(url,{waitUntil:"load",timeout:30000});
      await weatherReady(page);
      if(poging>1)console.log(`${label}: geldige weatherdata op begrensde poging ${poging}.`);
      return poging;
    }catch(err){
      laatsteFout=String(err&&err.message||err).split("\n")[0];
      laatsteToestand=await page.evaluate(()=>({
        href:location.href,
        bootstrap:document.documentElement.dataset.appBootstrap||null,
        appVisible:!!document.getElementById("app")&&getComputedStyle(document.getElementById("app")).display!=="none",
        status:(document.getElementById("locatie-laadstatus")?.textContent||document.getElementById("state")?.textContent||"").trim()
      })).catch(e=>({evaluatieFout:String(e&&e.message||e).split("\n")[0]}));
      if(poging<3){
        const backoff=NAVIGATION_WEATHER_RETRY_BACKOFF_MS*poging;
        console.warn(`${label}: geen geldige weatherdata op poging ${poging}; backoff=${backoff}ms; fout=${laatsteFout}; toestand=${JSON.stringify(laatsteToestand)}`);
        await slaap(backoff);
      }
    }
  }
  throw new Error(`${label}: geen geldige weatherdata na 3 begrensde pogingen; fout=${laatsteFout}; toestand=${JSON.stringify(laatsteToestand)}`);
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
async function offlineReloadViaServiceworker(page,cdp){
  assert(!HEADLESS&&NATIVE_BROWSER_RELOAD,"deployed offline-reloadbewijs vereist zichtbare Chromium + native browserreload");
  const fouten=[];
  for(let poging=1;poging<=3;poging++){
    const gestart=[];
    const documenten=[];
    const noteerStart=event=>gestart.push(event);
    const noteerResponse=event=>{if(event.type==="Document")documenten.push(event);};
    cdp.on("Page.frameStartedNavigating",noteerStart);
    cdp.on("Network.responseReceived",noteerResponse);
    try{
      const vorigeOrigin=await page.evaluate(()=>performance.timeOrigin);
      const venster=await chromiumVenster(page);
      await execFileAsync("xdotool",["windowfocus","--sync",venster],{timeout:5000});
      const focus=String((await execFileAsync("xdotool",["getwindowfocus"],{timeout:2000})).stdout||"").trim();
      const [vensterPid,focusPid]=await Promise.all([
        execFileAsync("xdotool",["getwindowpid",venster],{timeout:2000}),
        execFileAsync("xdotool",["getwindowpid",focus],{timeout:2000})
      ]);
      assert.equal(String(focusPid.stdout||"").trim(),String(vensterPid.stdout||"").trim(),`Chromium kreeg geen native focus (venster ${venster}, focus ${focus||"niets"})`);
      await execFileAsync("xdotool",["key","--clearmodifiers","ctrl+r"],{timeout:5000});
      await page.waitForFunction(vorige=>performance.timeOrigin!==vorige&&document.documentElement.dataset.appBootstrap==="ready",vorigeOrigin,{timeout:15000});
      const hoofdStart=gestart.find(event=>event.navigationType==="reload")||null;
      const documentResponse=[...documenten].reverse().find(event=>event.frameId===hoofdStart?.frameId)||null;
      if(!hoofdStart||hoofdStart.navigationType!=="reload"){
        fouten.push(`poging ${poging}: CDP rapporteerde geen reload-start (${JSON.stringify(hoofdStart||null)})`);
      }else if(documentResponse&&documentResponse.response&&documentResponse.response.fromServiceWorker){
        return {documentResponse,cdpNavigationType:hoofdStart.navigationType};
      }else fouten.push(`poging ${poging}: geen serviceworker-response`);
    }catch(err){
      const toestand=await page.evaluate(()=>({
        timeOrigin:performance.timeOrigin,url:location.href,title:document.title,
        ready:document.documentElement.dataset.appBootstrap||null,
        navigationType:performance.getEntriesByType("navigation").at(-1)?.type||null
      })).catch(e=>({evaluatieFout:String(e&&e.message||e).split("\n")[0]}));
      fouten.push(`poging ${poging}: ${String(err&&err.message||err).split("\n")[0]}; starts=${JSON.stringify(gestart)}; documenten=${JSON.stringify(documenten.map(x=>({frameId:x.frameId,url:x.response&&x.response.url,fromServiceWorker:x.response&&x.response.fromServiceWorker,status:x.response&&x.response.status})))}; toestand=${JSON.stringify(toestand)}`);
    }finally{
      cdp.off("Page.frameStartedNavigating",noteerStart);
      cdp.off("Network.responseReceived",noteerResponse);
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
    await Promise.all([child.send("Network.enable"),child.send("Runtime.enable")]);
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
  const browser=await chromium.launch({headless:HEADLESS});
  try{
    if(NAVIGATION_INITIAL_COOLDOWN_MS>0){
      console.log(`Navigatiecontract: begrensde upstream-afkoeling ${NAVIGATION_INITIAL_COOLDOWN_MS} ms.`);
      await slaap(NAVIGATION_INITIAL_COOLDOWN_MS);
    }
    /* Hard refresh: Chromium-cache expliciet uit, dezelfde live release moet terugkomen. */
    {
      const context=await browser.newContext({serviceWorkers:"block"});
      const page=await context.newPage();
      await openWeather(page,ROOT+"/?lat=52.368&lon=4.904&plaats=Amsterdam&land=NL","hard-refresh voor");
      const voor=await snap(page);assertRelease(voor,"hard-refresh voor");
      assert.equal(voor.plaats,"Amsterdam","hard-refresh uitgangspunt moet Amsterdam zijn");
      const cdp=await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled",{cacheDisabled:true});
      await openWeather(page,null,"hard-refresh na",{reloadOnly:true});
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
      await openWeather(eerste,ROOT+"/weer/amsterdam/","nieuw tabblad eerste");
      const a=await snap(eerste);assertRelease(a,"nieuw-tabblad eerste");
      const tweede=await context.newPage();
      await openWeather(tweede,ROOT+"/weer/amsterdam/","nieuw tabblad tweede");
      const b=await snap(tweede);assertRelease(b,"nieuw-tabblad tweede");
      for(const sleutel of ["build","app","bootstrap","plaats","canonical"])
        assert.equal(b[sleutel],a[sleutel],`nieuw tabblad divergeert voor ${sleutel}`);
      await context.close();
    }

    /* Back én Forward: route -> statische hub -> terug -> vooruit -> terug. */
    {
      const context=await browser.newContext({serviceWorkers:"block"});
      const page=await context.newPage();
      await openWeather(page,ROOT+"/weer/amsterdam/","Back/Forward uitgangspunt");
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
      let workerNetwerk=null,witness=null,workerNetwerkfoutActief=false;
      try{
        await openWeather(page,ROOT+"/?lat=52.368&lon=4.904&plaats=Amsterdam&land=NL","serviceworker uitgangspunt");
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

        witness=await context.newPage();
        await witness.goto(ROOT+"/weer/",{waitUntil:"load",timeout:30000});
        await witness.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:10000});

        workerNetwerk=await koppelActieveWorkerNetwerk(browser,page);
        const injectie=await workerNetwerk.child.send("Runtime.evaluate",{
          expression:'(()=>{if(typeof globalThis.__WIW_E2E_ORIGINAL_FETCH__!=="function")globalThis.__WIW_E2E_ORIGINAL_FETCH__=globalThis.fetch.bind(globalThis);globalThis.fetch=()=>Promise.reject(new TypeError("WIW E2E network unavailable"));return true;})()',
          returnByValue:true
        });
        assert.equal(injectie&&injectie.result&&injectie.result.value,true,"worker-netwerkfoutinjectie kon niet worden geactiveerd");
        workerNetwerkfoutActief=true;
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
        console.log("Offline serviceworker-preflight:",JSON.stringify({lifecycle:await serviceworkerStabiel(page),workerTarget:{scriptURL:workerNetwerk.scriptURL,targetId:workerNetwerk.targetId},workerNetworkFailureInjected:true,netwerkProbe,offlineProbe,indexFromServiceWorker:indexResponse.fromServiceWorker()}));
        await workerNetwerk.child.close();
        workerNetwerk=null;
        const losgekoppeldeProbe=await witness.evaluate(async token=>{
          try{
            const response=await fetch(`/__wiw_detached_network_must_fail_${token}`,{cache:"no-store"});
            return {gefaald:false,status:response.status};
          }catch(e){return {gefaald:true,fout:String(e)};}
        },Date.now());
        assert(losgekoppeldeProbe.gefaald,`worker-netwerkfout bleef na debugontkoppeling niet actief: ${JSON.stringify(losgekoppeldeProbe)}`);
        const reloadBewijs=await offlineReloadViaServiceworker(page,cdp);
        const {documentResponse,cdpNavigationType}=reloadBewijs;
        assert(documentResponse&&documentResponse.response&&documentResponse.response.fromServiceWorker,"offline reload moet door de actieve serviceworker worden geleverd");
        assert.equal(cdpNavigationType,"reload","browserprotocol moet de offline navigatie als reload rapporteren");
        await ready(page,10000);
        const witnessProbe=await witness.evaluate(async token=>{
          try{
            const response=await fetch(`/__wiw_post_reload_network_must_fail_${token}`,{cache:"no-store"});
            return {gefaald:false,status:response.status};
          }catch(e){return {gefaald:true,fout:String(e)};}
        },Date.now());
        assert(witnessProbe.gefaald,`worker-netwerkfout was na offline reload niet meer actief: ${JSON.stringify(witnessProbe)}`);
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
        if(!workerNetwerk&&workerNetwerkfoutActief&&witness){
          workerNetwerk=await koppelActieveWorkerNetwerk(browser,witness).catch(()=>null);
        }
        if(workerNetwerk){
          await workerNetwerk.child.send("Runtime.evaluate",{
            expression:'(()=>{if(typeof globalThis.__WIW_E2E_ORIGINAL_FETCH__==="function"){globalThis.fetch=globalThis.__WIW_E2E_ORIGINAL_FETCH__;delete globalThis.__WIW_E2E_ORIGINAL_FETCH__;}return true;})()',
            returnByValue:true
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
