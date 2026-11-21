"use strict";

/* Contractcontrole van de vastgepinde native browserreload-driver (scripts/ci/native-reload-driver/).

   Draait in `Release recovery verification` op iedere pull request, in dezelfde Playwright-image als de
   releasecontroles en direct na dezelfde installatiestap. Bewijst zonder deployment dat de geïnstalleerde
   xdotool doet wat scripts/production-release-recovery-navigation.js ervan vraagt:

   - een zichtbaar Chromium-venster vinden en native focus geven (zelfde xdotool-aanroepen);
   - een echte Ctrl+R sturen, geen page.reload();
   - de browser meldt die navigatie via CDP als reload;
   - het document komt uit de serviceworker terwijl de server werkelijk uit staat.

   Dit vervangt de releasecontrole niet: die blijft op de deployed preview en op productie draaien met al haar
   eigen assertions. Dit script bewaakt alleen dat de driver zelf werkt voordat een wijziging wordt gemerged.

   Gebruik: xvfb-run --auto-servernum node scripts/native-reload-driver-browser.js */

const assert=require("assert");
const http=require("http");
const {execFile}=require("child_process");
const {promisify}=require("util");
const {chromium}=require("playwright");

const execFileAsync=promisify(execFile);
const VERWACHTE_VERSIE="1:3.20160805.1-5build1";
const TITEL="Native reload driver contract";
const SERVICEWORKER=`
self.addEventListener("install",event=>{event.waitUntil(caches.open("contract").then(cache=>cache.add("/")).then(()=>self.skipWaiting()));});
self.addEventListener("activate",event=>{event.waitUntil(self.clients.claim());});
self.addEventListener("fetch",event=>{event.respondWith(fetch(event.request).catch(()=>caches.match(event.request,{ignoreSearch:true})));});
`;
const PAGINA=`<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>${TITEL}</title></head><body><h1>${TITEL}</h1>
<script>navigator.serviceWorker.register("/sw.js").then(()=>navigator.serviceWorker.ready).then(()=>{document.documentElement.dataset.appBootstrap="ready";});</script>
</body></html>`;

async function pakketversie(pakket){
  const uit=await execFileAsync("dpkg-query",["--show","--showformat=${Version} ${db:Status-Status}",pakket],{timeout:5000});
  return String(uit.stdout||"").trim();
}

async function chromiumVenster(titel){
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
    ||vensters.find(item=>item.naam.includes(titel))
    ||vensters.find(item=>item.naam)
    ||vensters.at(-1);
  assert(gekozen,`geen zichtbaar Chromium-venster gevonden: ${String(gevonden.stderr||"").trim()}`);
  return {venster:gekozen.id,vensters};
}

(async()=>{
  assert(process.env.DISPLAY,"geen X-display: start dit script met xvfb-run");
  for(const pakket of ["libxdo3","xdotool"]){
    assert.equal(await pakketversie(pakket),`${VERWACHTE_VERSIE} installed`,`${pakket} is niet in de vastgepinde versie geïnstalleerd`);
  }

  const server=http.createServer((request,response)=>{
    if(request.url==="/sw.js"){
      response.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store"});
      response.end(SERVICEWORKER);
    }else{
      response.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
      response.end(PAGINA);
    }
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const url=`http://127.0.0.1:${server.address().port}/`;
  let serverUit=false;
  const stopServer=async()=>{
    if(serverUit)return;
    serverUit=true;
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  };

  const browser=await chromium.launch({headless:false});
  try{
    const context=await browser.newContext();
    const page=await context.newPage();
    const cdp=await context.newCDPSession(page);
    await Promise.all([cdp.send("Network.enable"),cdp.send("Page.enable")]);
    await page.goto(url,{waitUntil:"load",timeout:15000});
    await page.waitForFunction(()=>document.documentElement.dataset.appBootstrap==="ready"&&!!navigator.serviceWorker.controller,null,{timeout:15000});

    /* De server gaat werkelijk uit: wat hierna nog laadt, kan alleen uit de serviceworker komen. */
    await stopServer();
    const netwerk=await page.evaluate(async token=>{
      try{await fetch(`/__geen_cache_${token}`,{cache:"no-store"});return {bereikbaar:true};}
      catch(e){return {bereikbaar:false};}
    },Date.now());
    assert.equal(netwerk.bereikbaar,false,"de server is nog bereikbaar; de offlineproef bewijst dan niets");

    const gestart=[],documenten=[];
    cdp.on("Page.frameStartedNavigating",event=>gestart.push(event));
    cdp.on("Network.responseReceived",event=>{if(event.type==="Document")documenten.push(event);});
    const vorigeOrigin=await page.evaluate(()=>performance.timeOrigin);

    await page.bringToFront();
    const {venster,vensters}=await chromiumVenster(await page.title());
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
    assert(hoofdStart,`CDP rapporteerde geen reload-start na native Ctrl+R: ${JSON.stringify(gestart)}`);
    const documentResponse=[...documenten].reverse().find(event=>event.frameId===hoofdStart.frameId)||null;
    assert(documentResponse&&documentResponse.response,"geen documentrespons na native Ctrl+R");
    assert.equal(documentResponse.response.fromServiceWorker,true,"offline reload moet door de serviceworker worden geleverd");
    assert.equal(documentResponse.response.status,200,"offline reload gaf geen HTTP 200 uit de serviceworker");
    const navigationType=await page.evaluate(()=>performance.getEntriesByType("navigation").at(-1)?.type||null);
    assert.equal(navigationType,"reload","de pagina moet de navigatie zelf ook als reload zien");
    assert.equal(await page.title(),TITEL,"na de reload staat niet meer de contractpagina open");

    console.log("NATIVE RELOAD DRIVER CONTRACT GESLAAGD: "+JSON.stringify({
      versie:VERWACHTE_VERSIE,vensters:vensters.length,nativeFocus:true,toets:"ctrl+r",
      cdpNavigationType:hoofdStart.navigationType,fromServiceWorker:documentResponse.response.fromServiceWorker,
      status:documentResponse.response.status,navigationType,serverUit
    }));
  }finally{
    await browser.close();
    await stopServer();
  }
})().catch(fout=>{
  console.error("NATIVE RELOAD DRIVER CONTRACT MISLUKT: "+String(fout&&fout.stack||fout));
  process.exitCode=1;
});
