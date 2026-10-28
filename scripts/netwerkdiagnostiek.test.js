"use strict";

const assert=require("assert");
const path=require("path");
const {spawnSync}=require("child_process");
const {coloUitRay,meetVerzoek,formatteer,diagnose,PADEN,TIMEOUT_MS}=require("./netwerkdiagnostiek.js");

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

  console.log("Netwerkdiagnostiek: colo-herkenning, witgelijste logregel zonder gevoelige gegevens, foutpad, time-out en CLI (exit 0) OK.");
})().catch(e=>{console.error(e);process.exit(1);});
