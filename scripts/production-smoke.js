"use strict";

const assert=require("assert");

const ROOT="https://watishetweer.nl";
const WWW="https://www.watishetweer.nl";
const verwacht=String(process.env.EXPECTED_SHA||process.argv[2]||"").trim();
const wachtMs=Number(process.env.SMOKE_POLL_MS||10000);
const pogingen=Number(process.env.SMOKE_ATTEMPTS||36);
const requestTimeoutMs=Number(process.env.SMOKE_REQUEST_TIMEOUT_MS||10000);
const retryDelayMs=Number(process.env.SMOKE_RETRY_DELAY_MS||300);

if(!/^[0-9a-f]{7,40}$/i.test(verwacht))throw new Error("EXPECTED_SHA ontbreekt of is ongeldig voor production-smoke.");
if(!Number.isFinite(requestTimeoutMs)||requestTimeoutMs<1000||requestTimeoutMs>30000)throw new Error("SMOKE_REQUEST_TIMEOUT_MS moet tussen 1000 en 30000 ms liggen.");
const slaap=ms=>new Promise(r=>setTimeout(r,ms));

async function haal(url,opt={}){
  const maxPogingen=opt.retry===false?1:2;
  const timeoutMs=Number(opt.timeoutMs||requestTimeoutMs);
  let laatsteFout=null;
  for(let poging=1;poging<=maxPogingen;poging++){
    try{
      const response=await fetch(url,{
        redirect:opt.redirect||"follow",
        headers:{"user-agent":"WeatherNow-production-smoke/1.0","cache-control":"no-cache","accept":opt.accept||"*/*"},
        signal:AbortSignal.timeout(timeoutMs)
      });
      const text=await response.text();
      const transient=response.status===429||response.status>=500;
      if(transient&&poging<maxPogingen){
        console.log(`Tijdelijke HTTP ${response.status} voor ${url}; één retry.`);
        await slaap(retryDelayMs);
        continue;
      }
      return {response,text};
    }catch(e){
      laatsteFout=e;
      if(poging>=maxPogingen)throw e;
      console.log(`Tijdelijke fetchfout voor ${url}: ${e.message}; één retry.`);
      await slaap(retryDelayMs);
    }
  }
  throw laatsteFout||new Error(`Request naar ${url} mislukte.`);
}
function buildSha(html){return /<meta name="weather-build-sha" content="([^"]+)">/.exec(html)?.[1]||null;}
function geenNoindex(response,label){
  const robots=response.headers.get("x-robots-tag")||"";
  assert(!/noindex/i.test(robots),`${label}: productie mag geen x-robots-tag noindex hebben (${robots})`);
}
function leesJson(resultaat,label){
  try{return JSON.parse(resultaat.text);}
  catch(e){throw new Error(`${label}: response is geen geldige JSON (${e.message})`);}
}
function controleerCloudflare(response,label,opt={}){
  const hsts=opt.hsts!==false;
  assert.equal((response.headers.get("server")||"").toLowerCase(),"cloudflare",`${label}: response loopt niet aantoonbaar via Cloudflare`);
  assert(response.headers.get("cf-ray"),`${label}: Cloudflare CF-Ray ontbreekt`);
  if(hsts)assert.equal(response.headers.get("strict-transport-security"),"max-age=31536000",`${label}: HSTS-contract ontbreekt of wijkt af`);
}

async function wachtOpExacteDeployment(){
  let laatst=null,lastStatus=null,lastError=null;
  for(let i=1;i<=pogingen;i++){
    try{
      const {response,text}=await haal(ROOT+"/",{retry:false,timeoutMs:Math.min(requestTimeoutMs,4000)});
      lastStatus=response.status;laatst=buildSha(text);lastError=null;
      if(response.ok&&laatst===verwacht){
        console.log(`Production deployment zichtbaar na poging ${i}: ${verwacht}.`);
        return {response,text};
      }
      console.log(`Wacht op production ${verwacht}: poging ${i}/${pogingen}, status=${response.status}, zichtbaar=${laatst||"geen"}.`);
    }catch(e){lastError=e;console.log(`Wacht op production ${verwacht}: poging ${i}/${pogingen}, fetchfout=${e.message}.`);}
    if(i<pogingen)await slaap(wachtMs);
  }
  throw new Error(`Production bereikte verwachte SHA niet: verwacht=${verwacht}, zichtbaar=${laatst}, status=${lastStatus}, fout=${lastError&&lastError.message}`);
}

(async()=>{
  const root=await wachtOpExacteDeployment();
  assert(root.response.ok,"homepage is niet 2xx");
  controleerCloudflare(root.response,"homepage");
  geenNoindex(root.response,"homepage");
  assert(root.text.includes('<link rel="canonical" href="https://watishetweer.nl/">'),"homepage canonical ontbreekt");
  assert(root.text.includes('href="/weer/"'),"homepage mist crawlbare plaatsindex-link");
  assert(root.text.includes('href="/weer/almere/"'),"homepage mist crawlbare Almere-link");

  const robots=await haal(ROOT+"/robots.txt");
  assert(robots.response.ok,"robots.txt is niet 2xx");
  // robots.txt kan door Cloudflare op de edge worden behandeld buiten de normale
  // Pages asset-headerlaag. Bewaak hier Cloudflare-provenance en inhoud; HSTS wordt
  // hieronder streng gecontroleerd op meerdere gewone statische Pages-responses.
  controleerCloudflare(robots.response,"robots.txt",{hsts:false});
  geenNoindex(robots.response,"robots.txt");
  assert(/^User-agent: \*$/m.test(robots.text)&&/^Allow: \/$/m.test(robots.text),"robots.txt staat crawling niet correct toe");
  assert(robots.text.includes("Sitemap: https://watishetweer.nl/sitemap.xml"),"robots.txt mist canonieke sitemap");

  const sitemap=await haal(ROOT+"/sitemap.xml");
  assert(sitemap.response.ok,"sitemap.xml is niet 2xx");
  controleerCloudflare(sitemap.response,"sitemap.xml");
  geenNoindex(sitemap.response,"sitemap.xml");
  const sitemapLocs=[...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  assert(sitemapLocs.length>=32,"sitemap bevat onverwacht weinig indexeerbare URLs");
  for(const u of [ROOT+"/",ROOT+"/weer/",ROOT+"/weer/almere/",ROOT+"/weer/amsterdam/",ROOT+"/weer/rotterdam/"]){assert(sitemapLocs.includes(u),`sitemap mist ${u}`);}
  assert(!sitemap.text.includes("www.watishetweer.nl")&&!/[?](?:lat|lon)=/.test(sitemap.text),"sitemap bevat duplicaat-/share-URLs");

  const hub=await haal(ROOT+"/weer/");
  assert(hub.response.ok,"/weer/ is niet 2xx");
  controleerCloudflare(hub.response,"/weer/");
  geenNoindex(hub.response,"/weer/");
  assert(hub.text.includes('<link rel="canonical" href="https://watishetweer.nl/weer/">'),"plaatsindex canonical ontbreekt");
  assert(hub.text.includes('href="/weer/almere/"')&&hub.text.includes("Weer per plaats"),"plaatsindex mist crawlbare inhoud");
  assert.equal(buildSha(hub.text),verwacht,"plaatsindex komt uit andere deployment dan homepage");

  const almere=await haal(ROOT+"/weer/almere/");
  assert(almere.response.ok,"Almere-route is niet 2xx");
  controleerCloudflare(almere.response,"/weer/almere/");
  geenNoindex(almere.response,"/weer/almere/");
  assert.equal(buildSha(almere.text),verwacht,"Almere-route komt uit andere deployment dan homepage");
  assert(almere.text.includes("<title>Weer Almere vandaag | Wat is het weer?</title>"),"Almere-route mist unieke title");
  assert(almere.text.includes('<link rel="canonical" href="https://watishetweer.nl/weer/almere/">'),"Almere-route mist unieke canonical");
  assert(almere.text.includes('<base href="/">'),"Almere-route mist veilige root-base voor assets");
  assert(almere.text.includes("WEATHER NOW PLAATSROUTE")&&almere.text.includes('"slug":"almere"'),"Almere-route mist routebootstrap");
  assert(almere.text.includes("Weer in Almere"),"Almere-route mist zichtbare prerendercontext");

  const wwwRedirect=await haal(WWW+"/",{redirect:"manual"});
  assert([301,302,307,308].includes(wwwRedirect.response.status),`www-homepage moet redirecten naar canonieke host, status=${wwwRedirect.response.status}`);
  const locatie=wwwRedirect.response.headers.get("location");
  assert(locatie,"www-homepage redirect mist Location-header");
  const doel=new URL(locatie,WWW+"/");
  assert.equal(doel.origin+doel.pathname,ROOT+"/","www-homepage redirect niet naar canonieke root");

  const www=await haal(WWW+"/");
  assert(www.response.ok,"www-homepage is niet 2xx na redirects");
  controleerCloudflare(www.response,"www-homepage");
  geenNoindex(www.response,"www-homepage");
  assert(www.text.includes('<link rel="canonical" href="https://watishetweer.nl/">'),"www-homepage canonicaliseert niet naar root");
  assert.equal(buildSha(www.text),verwacht,"www-homepage komt uit andere deployment");

  const share=await haal(ROOT+"/?lat=52.3508&lon=5.2647&plaats=Almere&land=NL");
  assert(share.response.ok,"share-URL is niet 2xx");
  assert(share.text.includes('<link rel="canonical" href="https://watishetweer.nl/">'),"share-URL mag geen aparte canonical krijgen");

  const zonderSlash=await haal(ROOT+"/weer/almere");
  assert(zonderSlash.response.ok,"clean URL voor Almere is niet bereikbaar");
  assert(zonderSlash.text.includes('<link rel="canonical" href="https://watishetweer.nl/weer/almere/">'),"clean URL canonicaliseert niet naar trailing-slash route");

  const onbekend=await haal(ROOT+"/weer/dit-bestaat-niet/");
  assert.equal(onbekend.response.status,404,"onbekende plaatsroute moet echte 404 zijn en geen thin page");

  const plaatsnaam=await haal(ROOT+"/api/plaatsnaam?lat=52.3508&lon=5.2647",{accept:"application/json"});
  assert.equal(plaatsnaam.response.status,200,"plaatsnaam-API moet voor geldige coordinaten 200 teruggeven");
  controleerCloudflare(plaatsnaam.response,"plaatsnaam-API");
  const plaats=leesJson(plaatsnaam,"plaatsnaam-API");
  assert(plaats&&typeof plaats==="object"&&!Array.isArray(plaats),"plaatsnaam-API moet een JSON-object teruggeven");
  assert(Object.prototype.hasOwnProperty.call(plaats,"naam")&&Object.prototype.hasOwnProperty.call(plaats,"land"),"plaatsnaam-API mist naam/land-contract");
  assert(plaats.naam===null||typeof plaats.naam==="string","plaatsnaam-API naam moet string of null zijn");
  assert(plaats.land===null||typeof plaats.land==="string","plaatsnaam-API land moet string of null zijn");

  const neerslag=await haal(ROOT+"/api/neerslag?lat=52.3508&lon=5.2647&land=NL",{accept:"application/json"});
  assert.equal(neerslag.response.status,200,"neerslag-API moet voor geldige coordinaten binnen KNMI-dekking 200 teruggeven");
  controleerCloudflare(neerslag.response,"neerslag-API");
  const regen=leesJson(neerslag,"neerslag-API");
  assert(regen&&typeof regen==="object"&&!Array.isArray(regen),"neerslag-API moet een JSON-object teruggeven");
  assert.equal(typeof regen.beschikbaar,"boolean","neerslag-API beschikbaar moet boolean zijn");
  assert.equal(regen.provider,"knmi","neerslag-API moet binnen KNMI-dekking de KNMI-provider selecteren");
  if(regen.beschikbaar){
    assert(regen.actueel&&typeof regen.actueel==="object","beschikbare neerslag-API mist actuele KNMI-puntwaarde");
    assert.equal(regen.bron,"KNMI","beschikbare neerslag-API moet KNMI als bron noemen");
  }else{
    assert.equal(regen.reden,"KNMI-neerslag tijdelijk niet beschikbaar","gedegradeerde neerslag-API mag geen intern providerdetail publiceren");
  }

  const waarschuwingen=await haal(ROOT+"/api/waarschuwingen?lat=52.3508&lon=5.2647&land=NL",{accept:"application/json"});
  assert.equal(waarschuwingen.response.status,200,"waarschuwingen-API moet voor geldige coordinaten 200 teruggeven");
  controleerCloudflare(waarschuwingen.response,"waarschuwingen-API");
  const waarschuwing=leesJson(waarschuwingen,"waarschuwingen-API");
  assert(waarschuwing&&typeof waarschuwing==="object"&&!Array.isArray(waarschuwing),"waarschuwingen-API moet een JSON-object teruggeven");
  assert.equal(waarschuwing.land,"NL","waarschuwingen-API moet de expliciete landcode behouden");
  assert.equal(typeof waarschuwing.dekking,"boolean","waarschuwingen-API dekking moet boolean zijn");
  assert(Array.isArray(waarschuwing.lijst),"waarschuwingen-API lijst moet een array zijn");
  assert(waarschuwing.lijst.every(item=>item&&item.plaatsSpecifiek===true),"waarschuwingen-API mag alleen plaatsgebonden waarschuwingen publiceren");

  console.log(`PRODUCTION-SMOKE GESLAAGD: ${verwacht}; exacte Cloudflare-build, HSTS op statische/API-routes, homepage/www-redirect, robots, sitemap, kernroutes, share-canonical, 404 en alle drie API-contracten zijn publiek coherent.`);
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});