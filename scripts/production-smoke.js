"use strict";

const assert=require("assert");

const ROOT="https://watishetweer.nl";
const WWW="https://www.watishetweer.nl";
const verwacht=String(process.env.EXPECTED_SHA||process.argv[2]||"").trim();
const wachtMs=Number(process.env.SMOKE_POLL_MS||10000);
const pogingen=Number(process.env.SMOKE_ATTEMPTS||36);

if(!/^[0-9a-f]{7,40}$/i.test(verwacht))throw new Error("EXPECTED_SHA ontbreekt of is ongeldig voor production-smoke.");
const slaap=ms=>new Promise(r=>setTimeout(r,ms));

async function haal(url,opt={}){
  const response=await fetch(url,{redirect:opt.redirect||"follow",headers:{"user-agent":"WeatherNow-production-smoke/1.0","cache-control":"no-cache"}});
  const text=await response.text();
  return {response,text};
}
function buildSha(html){return /<meta name="weather-build-sha" content="([^"]+)">/.exec(html)?.[1]||null;}
function geenNoindex(response,label){
  const robots=response.headers.get("x-robots-tag")||"";
  assert(!/noindex/i.test(robots),`${label}: productie mag geen x-robots-tag noindex hebben (${robots})`);
}

async function wachtOpExacteDeployment(){
  let laatst=null,lastStatus=null,lastError=null;
  for(let i=1;i<=pogingen;i++){
    try{
      const {response,text}=await haal(ROOT+"/");
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
  geenNoindex(root.response,"homepage");
  assert(root.text.includes('<link rel="canonical" href="https://watishetweer.nl/">'),"homepage canonical ontbreekt");
  assert(root.text.includes('href="/weer/"'),"homepage mist crawlbare plaatsindex-link");
  assert(root.text.includes('href="/weer/almere/"'),"homepage mist crawlbare Almere-link");

  const robots=await haal(ROOT+"/robots.txt");
  assert(robots.response.ok,"robots.txt is niet 2xx");
  geenNoindex(robots.response,"robots.txt");
  assert(/^User-agent: \*$/m.test(robots.text)&&/^Allow: \/$/m.test(robots.text),"robots.txt staat crawling niet correct toe");
  assert(robots.text.includes("Sitemap: https://watishetweer.nl/sitemap.xml"),"robots.txt mist canonieke sitemap");

  const sitemap=await haal(ROOT+"/sitemap.xml");
  assert(sitemap.response.ok,"sitemap.xml is niet 2xx");
  geenNoindex(sitemap.response,"sitemap.xml");
  const sitemapLocs=[...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  assert(sitemapLocs.length>=32,"sitemap bevat onverwacht weinig indexeerbare URLs");
  for(const u of [ROOT+"/",ROOT+"/weer/",ROOT+"/weer/almere/",ROOT+"/weer/amsterdam/",ROOT+"/weer/rotterdam/"]){assert(sitemapLocs.includes(u),`sitemap mist ${u}`);}
  assert(!sitemap.text.includes("www.watishetweer.nl")&&!/[?](?:lat|lon)=/.test(sitemap.text),"sitemap bevat duplicaat-/share-URLs");

  const hub=await haal(ROOT+"/weer/");
  assert(hub.response.ok,"/weer/ is niet 2xx");
  geenNoindex(hub.response,"/weer/");
  assert(hub.text.includes('<link rel="canonical" href="https://watishetweer.nl/weer/">'),"plaatsindex canonical ontbreekt");
  assert(hub.text.includes('href="/weer/almere/"')&&hub.text.includes("Weer per plaats"),"plaatsindex mist crawlbare inhoud");
  assert.equal(buildSha(hub.text),verwacht,"plaatsindex komt uit andere deployment dan homepage");

  const almere=await haal(ROOT+"/weer/almere/");
  assert(almere.response.ok,"Almere-route is niet 2xx");
  geenNoindex(almere.response,"/weer/almere/");
  assert.equal(buildSha(almere.text),verwacht,"Almere-route komt uit andere deployment dan homepage");
  assert(almere.text.includes("<title>Weer Almere vandaag | Wat is het weer?</title>"),"Almere-route mist unieke title");
  assert(almere.text.includes('<link rel="canonical" href="https://watishetweer.nl/weer/almere/">'),"Almere-route mist unieke canonical");
  assert(almere.text.includes('<base href="/">'),"Almere-route mist veilige root-base voor assets");
  assert(almere.text.includes("WEATHER NOW PLAATSROUTE")&&almere.text.includes('"slug":"almere"'),"Almere-route mist routebootstrap");
  assert(almere.text.includes("Weer in Almere"),"Almere-route mist zichtbare prerendercontext");

  const www=await haal(WWW+"/");
  assert(www.response.ok,"www-homepage is niet 2xx na redirects");
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

  console.log(`PRODUCTION-SMOKE GESLAAGD: ${verwacht}; homepage/www, robots, sitemap, /weer/, Almere-route, share-canonical en 404-semantiek zijn publiek coherent.`);
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
