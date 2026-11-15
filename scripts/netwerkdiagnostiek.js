"use strict";

/* Netwerkdiagnostiek voor CI-foutmeldingen.
   Meet na een mislukte browsercontrole twee gewone GET-verzoeken (/robots.txt en /) en schrijft per verzoek één
   logregel met uitsluitend publieke gegevens: HTTP-status, CF-Ray, Cloudflare-colo (suffix van CF-Ray),
   cf-cache-status en responstijden. Zo is een time-out achteraf aan een colo of aan traagheid van het moment te koppelen.

   Alleen diagnostiek: het script wijzigt geen time-outs of controles, logt nooit headers of body (geen cookies,
   tokens of Access-gegevens) en eindigt altijd met exitcode 0, zodat het de uitkomst van een job niet beïnvloedt.
   Voor beveiligde previews gebruikt de job `--require=./scripts/cloudflare-access-preload.cjs`; de Access-headers
   komen dus uit de bestaande preload en worden hier niet gelezen of afgedrukt.

   Gebruik: node scripts/netwerkdiagnostiek.js [root]
   Zonder argument: NETWERK_ROOT, PREVIEW_ROOT, PRODUCTION_ROOT, CWV_ROOT of https://watishetweer.nl. */

const PADEN=["/robots.txt","/"];
const TIMEOUT_MS=8000;

/* CF-Ray heeft de vorm "<hex>-<IATA-colo>", bijvoorbeeld "9a1b2c3d4e5f6071-AMS". */
function coloUitRay(ray){
  const m=/^[0-9a-f]+-([A-Za-z]{3})$/.exec(String(ray||"").trim());
  return m?m[1].toUpperCase():"onbekend";
}

/* Alleen tekens die in een CF-Ray, cache-status of hostnaam voorkomen; alles anders wordt weggelaten. */
const veilig=w=>String(w==null?"":w).replace(/[^A-Za-z0-9._:-]/g,"").slice(0,64)||"-";
const ms=getal=>Math.round(getal)+"ms";

/* Foutregel voor een mislukte fetch in de productiemonitors: het bestaande bericht (bijv. "fetch failed" of
   "HTTP 503") ongewijzigd voorop, daarachter de foutcode en -naam van de onderliggende oorzaak en de duur van die
   poging. Undici meldt iedere transportfout als "fetch failed"; pas de oorzaakcode onderscheidt DNS
   (ENOTFOUND, EAI_AGAIN), connect- of TLS-time-out (UND_ERR_CONNECT_TIMEOUT), reset (ECONNRESET) of een
   happy-eyeballs-time-out (AggregateError ETIMEDOUT). Alleen code en naam worden gelezen, nooit het
   oorzaakbericht (dat kan een URL of adres bevatten). Puur diagnostisch: retries, time-outs en uitkomsten
   veranderen niet. */
function beschrijfFetchFout(fout,duurMs){
  const bericht=String(fout&&fout.message||fout);
  const oorzaak=fout&&typeof fout==="object"?fout.cause:null;
  const delen=[];
  if(oorzaak&&typeof oorzaak==="object"){
    const code=oorzaak.code?veilig(oorzaak.code):"",naam=oorzaak.name?veilig(oorzaak.name):"";
    if(code||naam)delen.push("oorzaak="+(code&&naam?`${code} (${naam})`:code||naam));
    if(Array.isArray(oorzaak.errors)&&oorzaak.errors.length){
      delen.push("adrespogingen="+oorzaak.errors.slice(0,4).map(e=>veilig(e&&(e.code||e.name))).join(","));
    }
  }
  if(Number.isFinite(duurMs))delen.push("na="+ms(duurMs));
  return delen.length?`${bericht} [${delen.join("; ")}]`:bericht;
}

async function meetVerzoek(root,pad,{fetchImpl=globalThis.fetch,timeoutMs=TIMEOUT_MS,klok=()=>performance.now()}={}){
  const begin=klok(),stop=new AbortController(),timer=setTimeout(()=>stop.abort(),timeoutMs);
  const uit={pad,host:veilig(new URL(root).host)};
  try{
    const antwoord=await fetchImpl(new URL(pad,root).href,{signal:stop.signal,redirect:"manual"});
    uit.ttfb=klok()-begin;
    await antwoord.arrayBuffer();
    uit.totaal=klok()-begin;
    uit.status=antwoord.status;
    uit.ray=antwoord.headers.get("cf-ray");
    uit.cache=antwoord.headers.get("cf-cache-status");
  }catch(fout){
    uit.totaal=klok()-begin;
    const oorzaak=fout&&fout.cause&&fout.cause.code;
    uit.fout=veilig(oorzaak||(fout&&fout.name)||"onbekend");
  }finally{
    clearTimeout(timer);
  }
  return uit;
}

function formatteer(m){
  const kop=`NETWERKDIAGNOSTIEK host=${m.host} pad=${m.pad}`;
  if(m.fout)return `${kop} fout=${m.fout} na=${ms(m.totaal)}`;
  return `${kop} status=${m.status} cf-ray=${veilig(m.ray)} colo=${coloUitRay(m.ray)} cf-cache-status=${veilig(m.cache)} ttfb=${ms(m.ttfb)} totaal=${ms(m.totaal)}`;
}

async function diagnose(root,opties){
  const regels=[];
  for(const pad of PADEN)regels.push(formatteer(await meetVerzoek(root,pad,opties)));
  return regels;
}

module.exports={coloUitRay,meetVerzoek,formatteer,diagnose,beschrijfFetchFout,PADEN,TIMEOUT_MS};

if(require.main===module){
  (async()=>{
    const root=process.argv[2]||process.env.NETWERK_ROOT||process.env.PREVIEW_ROOT||process.env.PRODUCTION_ROOT||process.env.CWV_ROOT||"https://watishetweer.nl";
    try{
      console.log("NETWERKDIAGNOSTIEK tijd="+new Date().toISOString());
      for(const regel of await diagnose(root))console.log(regel);
    }catch(fout){
      console.log("NETWERKDIAGNOSTIEK niet beschikbaar: "+veilig(fout&&fout.name));
    }
    process.exitCode=0;
  })();
}
