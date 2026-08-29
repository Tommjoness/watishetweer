"use strict";

const assert=require("assert");
const {LOCATIES,BASIS_URL,plaatsUrl}=require("./seo-locations.config.js");

const ROOT=BASIS_URL;
const VERWACHTE_URLS=Object.freeze([
  `${ROOT}/`,
  `${ROOT}/weer/`,
  `${ROOT}/over/`,
  ...LOCATIES.map(plaatsUrl)
]);

function leesLocs(xml){
  return [...String(xml||"").matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
}

function controleerSitemap(xml){
  const locs=leesLocs(xml);
  assert.equal(locs.length,VERWACHTE_URLS.length,`live sitemap moet exact ${VERWACHTE_URLS.length} canonieke URLs bevatten; gevonden ${locs.length}`);
  assert.equal(new Set(locs).size,locs.length,"live sitemap bevat dubbele URLs");
  assert.deepEqual([...locs].sort(),[...VERWACHTE_URLS].sort(),"live sitemap wijkt af van de canonieke URL-set uit de productiebron");
  assert(locs.includes(`${ROOT}/over/`),"live sitemap mist /over/");
  assert(!locs.some(url=>url.startsWith("https://www.watishetweer.nl")||/[?](?:lat|lon)=/.test(url)),"live sitemap bevat een www- of share-URL");
  return locs;
}

async function haalSitemap(){
  let laatsteFout=null;
  for(let poging=1;poging<=2;poging++){
    try{
      const response=await fetch(`${ROOT}/sitemap.xml`,{
        headers:{"user-agent":"WeatherNow-production-sitemap-contract/1.0","cache-control":"no-cache","accept":"application/xml,text/xml;q=0.9,*/*;q=0.8"},
        signal:AbortSignal.timeout(10000)
      });
      if((response.status===429||response.status>=500)&&poging<2){
        await new Promise(resolve=>setTimeout(resolve,300));
        continue;
      }
      assert(response.ok,`live sitemap is niet 2xx (HTTP ${response.status})`);
      assert.equal((response.headers.get("server")||"").toLowerCase(),"cloudflare","live sitemap loopt niet aantoonbaar via Cloudflare");
      assert(response.headers.get("cf-ray"),"live sitemap mist Cloudflare CF-Ray");
      const xml=await response.text();
      controleerSitemap(xml);
      return VERWACHTE_URLS.length;
    }catch(error){
      laatsteFout=error;
      if(poging<2)await new Promise(resolve=>setTimeout(resolve,300));
    }
  }
  throw laatsteFout||new Error("live sitemap kon niet worden gecontroleerd");
}

async function main(){
  const aantal=await haalSitemap();
  console.log(`LIVE-SITEMAP-CONTRACT GESLAAGD: exact ${aantal} unieke canonieke URLs, inclusief /over/.`);
}

if(require.main===module){
  main().catch(error=>{console.error(error&&error.stack||error);process.exit(1);});
}

module.exports={VERWACHTE_URLS,leesLocs,controleerSitemap,haalSitemap};
