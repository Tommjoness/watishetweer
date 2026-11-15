"use strict";

const assert=require("assert");
const fs=require("fs");
const net=require("net");
const path=require("path");
const {spawnSync}=require("child_process");
const {coloUitRay,meetVerzoek,formatteer,diagnose,beschrijfFetchFout,PADEN,TIMEOUT_MS}=require("./netwerkdiagnostiek.js");

function antwoord({status=200,headers={}}={}){
  return {status,headers:new Headers(headers),arrayBuffer:async()=>new ArrayBuffer(8)};
}
function klokMet(...tijden){let i=0;return()=>tijden[Math.min(i++,tijden.length-1)];}

(async()=>{
  /* colo uit CF-Ray */
  assert.equal(coloUitRay("9a1b2c3d4e5f6071-AMS"),"AMS");
  assert.equal(coloUitRay("9a1b2c3d4e5f6071-iad"),"IAD");
  assert.equal(coloUitRay(null),"onbekend");
  assert.equal(coloUitRay("geen-ray"),"onbekend");

  /* succesvol verzoek: status, ray, colo, cache en tijden */
  const ok=await meetVerzoek("https://example.test/",PADEN[0],{
    fetchImpl:async()=>antwoord({headers:{"cf-ray":"9a1b2c3d4e5f6071-FRA","cf-cache-status":"HIT"}}),
    klok:klokMet(1000,1120,1180)
  });
  assert.equal(formatteer(ok),"NETWERKDIAGNOSTIEK host=example.test pad=/robots.txt status=200 cf-ray=9a1b2c3d4e5f6071-FRA colo=FRA cf-cache-status=HIT ttfb=120ms totaal=180ms");

  /* geen cf-ray of cache-header: nette tekst, geen crash */
  const kaal=await meetVerzoek("https://example.test/",PADEN[1],{fetchImpl:async()=>antwoord({status:503}),klok:klokMet(0,5,9)});
  assert.equal(formatteer(kaal),"NETWERKDIAGNOSTIEK host=example.test pad=/ status=503 cf-ray=- colo=onbekend cf-cache-status=- ttfb=5ms totaal=9ms");

  /* gevoelige gegevens komen nooit in de uitvoer: alleen de vaste, witgelijste velden worden gelezen */
  const gevoelig=await meetVerzoek("https://example.test/?token=geheim&x=1",PADEN[0],{
    fetchImpl:async url=>{assert.equal(url,"https://example.test/robots.txt","querystring uit de root is meegestuurd");return antwoord({headers:{
      "cf-ray":"abc123-AMS","cf-cache-status":"DYNAMIC","set-cookie":"sessie=GEHEIM","authorization":"Bearer GEHEIM",
      "cf-access-client-secret":"GEHEIM","x-api-key":"GEHEIM"
    }});},
    klok:klokMet(0,1,2)
  });
  const regel=formatteer(gevoelig);
  assert(!/GEHEIM|geheim|sessie|Bearer|token/.test(regel),"gevoelige gegevens in de logregel: "+regel);
  assert(!/\?/.test(regel),"querystring in de logregel");

  /* cf-ray met afwijkende tekens wordt niet doorgegeven */
  const vuil=await meetVerzoek("https://example.test/",PADEN[0],{fetchImpl:async()=>antwoord({headers:{"cf-ray":"ab\"c;rm -rf-AMS"}}),klok:klokMet(0,1,2)});
  assert(!/[";\s]rm/.test(formatteer(vuil).replace("NETWERKDIAGNOSTIEK ","")),"ongefilterde ray: "+formatteer(vuil));

  /* netwerkfout en time-out geven één regel met de foutcode en geen stack, URL of bericht */
  const netwerk=await meetVerzoek("https://example.test/",PADEN[0],{
    fetchImpl:async()=>{const e=new TypeError("fetch failed https://example.test/?token=geheim");e.cause={code:"ECONNRESET"};throw e;},
    klok:klokMet(0,40)
  });
  assert.equal(formatteer(netwerk),"NETWERKDIAGNOSTIEK host=example.test pad=/robots.txt fout=ECONNRESET na=40ms");
  assert(!/geheim|token/.test(formatteer(netwerk)));

  /* time-out: de aanroep wordt na de diagnostiek-time-out afgebroken (zonder de time-outs van de tests aan te raken) */
  assert.equal(TIMEOUT_MS,8000);
  let afgebroken=false;
  const traag=await meetVerzoek("https://example.test/",PADEN[0],{
    timeoutMs:20,
    fetchImpl:(url,{signal})=>new Promise((_,afwijs)=>signal.addEventListener("abort",()=>{afgebroken=true;const e=new Error("aborted");e.name="AbortError";afwijs(e);})),
    klok:klokMet(0,25)
  });
  assert(afgebroken,"verzoek is niet afgebroken");
  assert.equal(traag.fout,"AbortError");

  /* diagnose meet beide paden, in vaste volgorde */
  const gezien=[];
  const regels=await diagnose("https://example.test",{fetchImpl:async url=>{gezien.push(new URL(url).pathname);return antwoord({headers:{"cf-ray":"1f-AMS"}});}});
  assert.deepEqual(gezien,["/robots.txt","/"]);
  assert.equal(regels.length,2);

  /* CLI: eindigt altijd met exitcode 0, ook als de host onbereikbaar is, en logt geen stacktrace */
  const cli=spawnSync(process.execPath,[path.join(__dirname,"netwerkdiagnostiek.js"),"http://127.0.0.1:9"],{encoding:"utf8",timeout:60000});
  assert.equal(cli.status,0,"CLI eindigt niet met exitcode 0: "+cli.stderr);
  assert(/NETWERKDIAGNOSTIEK host=127\.0\.0\.1:9 pad=\/robots\.txt fout=/.test(cli.stdout),"CLI-uitvoer onverwacht: "+cli.stdout);
  assert(!/\bat \w/.test(cli.stdout+cli.stderr),"stacktrace in de CLI-uitvoer");

  /* beschrijfFetchFout: het bestaande bericht blijft ongewijzigd voorop; daarachter alleen oorzaakcode, -naam en duur */
  const connectTimeout=new TypeError("fetch failed");
  connectTimeout.cause=Object.assign(new Error("Connect Timeout Error (attempted address: 203.0.113.7:443, timeout: 10000ms)"),{name:"ConnectTimeoutError",code:"UND_ERR_CONNECT_TIMEOUT"});
  assert.equal(beschrijfFetchFout(connectTimeout,10012.4),"fetch failed [oorzaak=UND_ERR_CONNECT_TIMEOUT (ConnectTimeoutError); na=10012ms]");
  assert(!/203\.0\.113|attempted|timeout:/.test(beschrijfFetchFout(connectTimeout,1)),"oorzaakbericht hoort niet in de foutregel");
  const happyEyeballs=new TypeError("fetch failed");
  happyEyeballs.cause=Object.assign(new AggregateError([Object.assign(new Error("x"),{code:"ETIMEDOUT"}),Object.assign(new Error("y"),{code:"ENETUNREACH"})],"agg"),{code:"ETIMEDOUT"});
  assert.equal(beschrijfFetchFout(happyEyeballs,251),"fetch failed [oorzaak=ETIMEDOUT (AggregateError); adrespogingen=ETIMEDOUT,ENETUNREACH; na=251ms]");
  const dns=new TypeError("fetch failed");dns.cause={code:"ENOTFOUND",message:"getaddrinfo ENOTFOUND api.open-meteo.com?token=geheim"};
  assert.equal(beschrijfFetchFout(dns,40),"fetch failed [oorzaak=ENOTFOUND; na=40ms]");
  assert.equal(beschrijfFetchFout(new Error("HTTP 429"),120),"HTTP 429 [na=120ms]","eigen fout zonder oorzaak: bericht ongewijzigd plus duur");
  assert.equal(beschrijfFetchFout(new Error("onvolledige forecastrespons")),"onvolledige forecastrespons","zonder duur en oorzaak exact het oude bericht");
  const timeoutFout=new Error("The operation was aborted due to timeout");timeoutFout.name="TimeoutError";
  assert.equal(beschrijfFetchFout(timeoutFout,15003),"The operation was aborted due to timeout [na=15003ms]");
  assert.equal(beschrijfFetchFout("los",NaN),"los");
  const vuileCode=new TypeError("fetch failed");vuileCode.cause={code:"E;rm -rf /",name:"<script>"};
  assert(!/[;<>\s\/]rm|<script>/.test(beschrijfFetchFout(vuileCode,1).replace("fetch failed ","")),"ongefilterde oorzaakcode: "+beschrijfFetchFout(vuileCode,1));

  /* Met echte undici-fouten: een reset en een gesloten poort geven hun eigen code, binnen milliseconden */
  const resetServer=net.createServer(s=>{s.resetAndDestroy?s.resetAndDestroy():s.destroy();});
  await new Promise(klaar=>resetServer.listen(0,"127.0.0.1",klaar));
  const echteFout=async url=>{const begin=Date.now();try{await fetch(url,{signal:AbortSignal.timeout(5000)});}catch(e){return beschrijfFetchFout(e,Date.now()-begin);}throw new Error("fetch slaagde onverwacht");};
  assert.match(await echteFout(`http://127.0.0.1:${resetServer.address().port}/`),/^fetch failed \[oorzaak=ECONNRESET \(Error\); na=\d+ms\]$/);
  await new Promise(klaar=>resetServer.close(klaar));
  const vrij=net.createServer();await new Promise(klaar=>vrij.listen(0,"127.0.0.1",klaar));const vrijePoort=vrij.address().port;await new Promise(klaar=>vrij.close(klaar));
  assert.match(await echteFout(`http://127.0.0.1:${vrijePoort}/`),/^fetch failed \[oorzaak=ECONNREFUSED \(Error\); na=\d+ms\]$/);

  /* Koppeling: de vijf live-bronlussen gebruiken de helper en gooien de oorzaak niet meer weg */
  const scripts=bestand=>fs.readFileSync(path.join(__dirname,bestand),"utf8");
  for(const [bestand,aantal] of [
    ["production-final-release-browser.js",1],
    ["production-worldwide-browser.js",2],
    ["production-pre-sale-acceptance-browser.js",1],
    ["run-production-pre-sale-acceptance-browser.js",1]
  ]){
    const bron=scripts(bestand);
    assert.equal(bron.split("Fout=beschrijfFetchFout(e,Date.now()-begin);").length-1,aantal,`${bestand}: verwacht ${aantal} lus(sen) met beschrijfFetchFout`);
    assert(!/(laatsteFout|reserveFout)=String\(e&&e\.message\|\|e\)/.test(bron),`${bestand}: een live-bronlus gooit de foutoorzaak nog weg`);
    assert(bron.includes('require("./netwerkdiagnostiek.js")'),`${bestand}: helper niet geladen`);
  }
  const workflow=fs.readFileSync(path.join(__dirname,"..",".github","workflows","production-smoke.yml"),"utf8");
  const finaleJob=workflow.slice(workflow.indexOf("\n  final-release-browser:"),workflow.indexOf("\n  cwv-layout-browser:"));
  assert(finaleJob.includes("node scripts/netwerkdiagnostiek.js https://watishetweer.nl")&&finaleJob.includes("node scripts/netwerkdiagnostiek.js https://api.open-meteo.com"),"finale releasejob mist de diagnostiek van site of Open-Meteo");
  assert(/aanvullende aanwijzing, geen equivalent van de forecastaanvraag/.test(finaleJob),"de Open-Meteo-meting moet als aanvullende aanwijzing gelabeld zijn");

  console.log("Netwerkdiagnostiek: colo-herkenning, witgelijste logregel zonder gevoelige gegevens, foutpad, time-out, CLI (exit 0), foutoorzaak per poging en koppeling in de vijf live-bronlussen OK.");
})().catch(e=>{console.error(e);process.exit(1);});
