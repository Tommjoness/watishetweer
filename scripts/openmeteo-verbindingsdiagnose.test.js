"use strict";

/* Deterministische regressietest voor de Open-Meteo-verbindingsdiagnostiek van
   scripts/openmeteo-daggrens-contract.js. Geen netwerk en geen echte sockets: alle
   afhankelijkheden zijn nagebootst. Wordt geladen vanuit scripts/provider-storing.test.js. */

const assert=require("assert");
const {EventEmitter}=require("events");
const D=require("./openmeteo-verbindingsdiagnose.js");

/* Het contractscript mag bij require niet zelf gaan ophalen. */
const echteFetch=globalThis.fetch;
let fetchAangeroepen=false;
globalThis.fetch=()=>{fetchAangeroepen=true;return Promise.reject(new Error("test: geen netwerk"));};
const {maakHaal,PLAATSEN}=require("./openmeteo-daggrens-contract.js");
globalThis.fetch=echteFetch;

const IP=/\b\d{1,3}(?:\.\d{1,3}){3}\b|\b[0-9a-f]{1,4}(?::[0-9a-f]{0,4}){2,7}\b/i;
const geenGevoeligs=(regel,tekst)=>{
  assert(!regel.includes("://"),tekst+": URL in logregel: "+regel);
  assert(!regel.includes("latitude=")&&!regel.includes("longitude="),tekst+": query in logregel: "+regel);
  assert(!IP.test(regel),tekst+": IP-adres in logregel: "+regel);
};
const fout=(naam,code,bericht="fout")=>Object.assign(new Error(bericht),{name:naam,...(code?{code}:{})});
const fetchFailed=code=>Object.assign(new TypeError("fetch failed"),{cause:fout("Error",code)});

(async()=>{
  /* 1. Categorieën uit de foutketen. */
  const connectTimeout=Object.assign(new TypeError("fetch failed"),{cause:Object.assign(new Error("Connect Timeout Error (attempted address: 203.0.113.9:443, timeout: 10000ms)"),{name:"ConnectTimeoutError",code:"UND_ERR_CONNECT_TIMEOUT"})});
  assert.equal(D.foutSoort(connectTimeout).soort,"verbindingslimiet");
  assert.deepEqual(D.foutSoort(connectTimeout).codes,["UND_ERR_CONNECT_TIMEOUT"]);
  assert.equal(D.foutSoort(fetchFailed("ENOTFOUND")).soort,"dns");
  assert.equal(D.foutSoort(fetchFailed("EAI_AGAIN")).soort,"dns");
  assert.equal(D.foutSoort(fetchFailed("ERR_TLS_CERT_ALTNAME_INVALID")).soort,"tls");
  assert.equal(D.foutSoort(fetchFailed("ECONNRESET")).soort,"tcp");
  assert.equal(D.foutSoort(fetchFailed("ETIMEDOUT")).soort,"tcp");
  assert.equal(D.foutSoort(fetchFailed("UND_ERR_HEADERS_TIMEOUT")).soort,"antwoordlimiet");
  assert.equal(D.foutSoort(fout("TimeoutError",null,"The operation was aborted due to timeout")).soort,"afgebroken");
  assert.deepEqual([D.foutSoort(new Error("HTTP 503")).soort,D.foutSoort(new Error("HTTP 503")).http],["http",503]);
  assert.equal(D.foutSoort(new SyntaxError("Unexpected token")).soort,"json");
  assert.equal(D.foutSoort(new TypeError("fetch failed")).soort,"onbekend");
  /* AggregateError (meerdere adressen) en een cyclische cause blijven begrensd. */
  const agg=Object.assign(new AggregateError([fout("Error","ECONNREFUSED"),fout("Error","ENETUNREACH")],"x"),{});
  assert.deepEqual(D.foutCodes(Object.assign(new TypeError("fetch failed"),{cause:agg})).codes,["ECONNREFUSED","ENETUNREACH"]);
  const cyclisch=new Error("a");cyclisch.cause=cyclisch;
  assert.deepEqual(D.foutCodes(cyclisch).codes,[]);

  /* 2. Logregel van de oorspronkelijke aanvraag: gelabeld en zonder gevoelige gegevens, ook al
        staat er een IP-adres in het foutbericht en een URL in de plaatsnaam. */
  const regel=D.pogingRegel({plaats:"Amster dam https://evil.example/?a=1",poging:2,duurMs:10493.6,fout:connectTimeout});
  assert.match(regel,/^OPENMETEO_POGING waarneming=oorspronkelijke-aanvraag plaats=\S+ poging=2 duur_ms=10494 soort=verbindingslimiet http_status=- oorzaakcodes=UND_ERR_CONNECT_TIMEOUT foutnamen=TypeError,ConnectTimeoutError$/);
  geenGevoeligs(regel,"pogingregel");

  /* 3. Runtime-regel. */
  const rt=D.runtimeRegel({version:"v24.22.1",versions:{undici:"7.30.1"}},{getDefaultAutoSelectFamily:()=>true,getDefaultAutoSelectFamilyAttemptTimeout:()=>250});
  assert.equal(rt,"OPENMETEO_RUNTIME node=v24.22.1 undici=7.30.1 autoSelectFamily=true autoSelectFamilyAttemptTimeout_ms=250");
  assert.equal(D.runtimeRegel({version:"v18",versions:{}},{}),"OPENMETEO_RUNTIME node=v18 undici=- autoSelectFamily=- autoSelectFamilyAttemptTimeout_ms=-");

  /* 4. Fasemeting met nagebootste DNS, TCP en TLS. */
  let klok=0;const nu=()=>klok;
  const socket=(gedrag)=>{const s=new EventEmitter();s.vernietigd=false;s.destroy=()=>{s.vernietigd=true;};s.authorized=true;s.getProtocol=()=>"TLSv1.3";setImmediate(()=>gedrag(s));return s;};
  const adressen=[{address:"203.0.113.5",family:4},{address:"2001:db8::5",family:6}];
  const opgeroepen={};
  const goed=await D.fasemeting({grensMs:50,nu,
    lookup:(h,cb)=>{opgeroepen.dns=h;klok+=12;cb(null,adressen);},
    tcpConnect:o=>{opgeroepen.tcp=o;return opgeroepen.tcpSocket=socket(s=>{klok+=30;s.emit("connect");});},
    tlsConnect:o=>{opgeroepen.tls=o;return opgeroepen.tlsSocket=socket(s=>{klok+=60;s.emit("secureConnect");});}});
  assert.deepEqual(goed.map(r=>[r.fase,r.uitkomst,r.duurMs]),[["dns","succes",12],["tcp","succes",30],["tls","succes",60]]);
  assert.deepEqual([goed[0].adressen,goed[0].families,goed[1].familie,goed[2].protocol,goed[2].geautoriseerd],[2,[4,6],4,"TLSv1.3",true]);
  assert.equal(opgeroepen.dns,"api.open-meteo.com");
  assert.deepEqual([opgeroepen.tcp.port,opgeroepen.tcp.family,opgeroepen.tls.port,opgeroepen.tls.servername],[443,4,443,"api.open-meteo.com"]);
  assert(opgeroepen.tcpSocket.vernietigd&&opgeroepen.tlsSocket.vernietigd,"sockets van de meting worden opgeruimd");
  const regels=D.fasemetingRegels(goed,{plaats:"Amsterdam"});
  assert.match(regels[0],/^OPENMETEO_FASEMETING waarneming=afzonderlijke-meting-achteraf plaats=Amsterdam host=api\.open-meteo\.com grens_ms=10000 let_op=losse_meting_na_de_mislukte_aanvraag_geen_bewijs_voor_de_oorzaak_daarvan$/);
  assert.equal(regels[1],"OPENMETEO_FASEMETING waarneming=afzonderlijke-meting-achteraf fase=dns uitkomst=succes duur_ms=12 adressen=2 families=4,6");
  assert.equal(regels[2],"OPENMETEO_FASEMETING waarneming=afzonderlijke-meting-achteraf fase=tcp uitkomst=succes duur_ms=30 familie=4");
  assert.equal(regels[3],"OPENMETEO_FASEMETING waarneming=afzonderlijke-meting-achteraf fase=tls uitkomst=succes duur_ms=60 protocol=TLSv1.3 certificaat_geldig=ja");
  for(const r of regels)geenGevoeligs(r,"fasemetingregel");

  /* DNS-fout: TCP en TLS worden overgeslagen. */
  const dnsFout=await D.fasemeting({grensMs:50,nu,lookup:(h,cb)=>cb(fout("Error","ENOTFOUND")),tcpConnect:()=>assert.fail("geen TCP na DNS-fout"),tlsConnect:()=>assert.fail("geen TLS")});
  assert.deepEqual(dnsFout.map(r=>[r.fase,r.uitkomst]),[["dns","fout"],["tcp","overgeslagen"],["tls","overgeslagen"]]);
  assert.deepEqual(dnsFout[0].codes,["ENOTFOUND"]);

  /* Hangende DNS: begrensd, daarna overgeslagen. */
  const dnsHangt=await D.fasemeting({grensMs:20,lookup:()=>{},tcpConnect:()=>assert.fail("geen TCP"),tlsConnect:()=>assert.fail("geen TLS")});
  assert.deepEqual(dnsHangt.map(r=>[r.fase,r.uitkomst]),[["dns","grens"],["tcp","overgeslagen"],["tls","overgeslagen"]]);
  assert(dnsHangt[0].duurMs>=15&&dnsHangt[0].duurMs<2000,"DNS-grens wordt gerespecteerd ("+dnsHangt[0].duurMs+" ms)");

  /* Hangende TCP: begrensd en opgeruimd; TLS overgeslagen. */
  let tcpHangt=null;
  const tcpGrens=await D.fasemeting({grensMs:20,lookup:(h,cb)=>cb(null,adressen),tcpConnect:()=>(tcpHangt=socket(()=>{})),tlsConnect:()=>assert.fail("geen TLS")});
  assert.deepEqual(tcpGrens.map(r=>[r.fase,r.uitkomst]),[["dns","succes"],["tcp","grens"],["tls","overgeslagen"]]);
  assert(tcpHangt.vernietigd,"hangende TCP-verbinding wordt na de grens opgeruimd");
  /* Een late fout na het opruimen stopt het proces niet. */
  tcpHangt.emit("error",fout("Error","ECONNRESET"));

  /* TLS-fout met code; hangende TLS begrensd. */
  const tlsFout=await D.fasemeting({grensMs:50,lookup:(h,cb)=>cb(null,adressen),tcpConnect:()=>socket(s=>s.emit("connect")),tlsConnect:()=>socket(s=>s.emit("error",fout("Error","ERR_TLS_CERT_ALTNAME_INVALID")))});
  assert.deepEqual(tlsFout.map(r=>[r.fase,r.uitkomst]),[["dns","succes"],["tcp","succes"],["tls","fout"]]);
  assert.deepEqual(tlsFout[2].codes,["ERR_TLS_CERT_ALTNAME_INVALID"]);
  const tlsHangt=await D.fasemeting({grensMs:20,lookup:(h,cb)=>cb(null,adressen),tcpConnect:()=>socket(s=>s.emit("connect")),tlsConnect:()=>socket(()=>{})});
  assert.equal(tlsHangt[2].uitkomst,"grens");

  /* logFasemeting gooit nooit: de oorspronkelijke fout blijft leidend. */
  const gelogd=[];
  await D.logFasemeting({plaats:"Sydney",log:r=>gelogd.push(r),meting:async()=>{throw fout("Error","EAI_AGAIN");}});
  assert.match(gelogd[0],/^OPENMETEO_RUNTIME node=/);
  assert.equal(gelogd[1],"OPENMETEO_FASEMETING waarneming=afzonderlijke-meting-achteraf uitkomst=meting_mislukt soort=dns");

  /* 5. Contractscript: gedrag ongewijzigd, alleen logging erbij. */
  assert.equal(fetchAangeroepen,false,"het contractscript start bij require geen ophaalronde");
  assert.deepEqual(PLAATSEN.map(p=>p.naam),["Amsterdam","New York","Sydney"]);
  const ams=PLAATSEN[0];
  {
    const log=[],slapen=[],metingen=[],aanroepen=[];
    let klok2=0;
    const haal=maakHaal({nu:()=>(klok2+=10493),log:r=>log.push(r),slaap:async ms=>{slapen.push(ms);},fasemeting:async p=>{metingen.push(p);},
      fetchImpl:async(url,init)=>{aanroepen.push([url,init]);throw connectTimeout;}});
    await assert.rejects(haal(ams),e=>e.message==="EXTERN: Open-Meteo niet bereikbaar voor Amsterdam: fetch failed");
    assert.equal(aanroepen.length,3,"precies drie pogingen");
    assert.equal(aanroepen[0][0],"https://api.open-meteo.com/v1/forecast?latitude=52.37&longitude=4.9&hourly=precipitation_probability&daily=precipitation_probability_max&timezone=Europe%2FAmsterdam&forecast_days=7","ongewijzigde aanvraag");
    assert(aanroepen.every(([,init])=>init&&init.signal instanceof AbortSignal),"elke poging heeft de bestaande AbortSignal-time-out");
    assert.deepEqual(slapen,[1000,2000,3000],"ongewijzigde wachttijden");
    assert.deepEqual(metingen,["Amsterdam"],"precies één afzonderlijke meting, na de laatste poging");
    assert.deepEqual(log.map(r=>r.split(" ").slice(0,4).join(" ")),[1,2,3].map(n=>"OPENMETEO_POGING waarneming=oorspronkelijke-aanvraag plaats=Amsterdam poging="+n));
    assert(log.every(r=>/ soort=verbindingslimiet .*oorzaakcodes=UND_ERR_CONNECT_TIMEOUT /.test(r)));
    for(const r of log)geenGevoeligs(r,"contract-pogingregel");
  }
  {
    const log=[],slapen=[],metingen=[];let n=0;
    const haal=maakHaal({log:r=>log.push(r),slaap:async ms=>{slapen.push(ms);},fasemeting:async p=>{metingen.push(p);},
      fetchImpl:async()=>{n++;if(n===1)throw fetchFailed("ECONNRESET");return {ok:true,json:async()=>({daily:{},hourly:{}})};}});
    assert.deepEqual(await haal(ams),{daily:{},hourly:{}});
    assert.deepEqual([n,slapen,metingen,log.length],[2,[1000],[],1],"succes bij poging 2: geen fasemeting, één pogingregel");
    assert.match(log[0],/ poging=1 .* soort=tcp .*oorzaakcodes=ECONNRESET /);
  }
  {
    const log=[];
    const haal=maakHaal({log:r=>log.push(r),slaap:async()=>{},fasemeting:async()=>{},fetchImpl:async()=>({ok:false,status:503})});
    await assert.rejects(haal(ams),e=>e.message==="EXTERN: Open-Meteo niet bereikbaar voor Amsterdam: HTTP 503");
    assert(log.every(r=>/ soort=http http_status=503 /.test(r))&&log.length===3);
  }
  {
    const log=[];let n=0;
    const haal=maakHaal({log:r=>log.push(r),slaap:async()=>{},fasemeting:async()=>{},fetchImpl:async()=>{n++;return {ok:true,json:async()=>({ok:1})};}});
    assert.deepEqual([await haal(ams),n,log],[{ok:1},1,[]],"succesroute: geen extra logregels");
  }
  console.log("Open-Meteo-verbindingsdiagnose: foutcategorieën, gelabelde waarnemingen, begrensde fasemeting zonder IP's of URL's, en ongewijzigde pogingen, wachttijden, time-out en foutmelding van het daggrenscontract.");
})().catch(e=>{console.error(e&&e.stack||e);process.exitCode=1;});
