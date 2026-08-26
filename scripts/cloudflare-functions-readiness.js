"use strict";

const ROOT=String(process.env.CLOUDFLARE_ROOT||"").replace(/\/$/,"");
if(!/^https:\/\/[a-z0-9-]+\.watishetweer\.pages\.dev$/i.test(ROOT)){
  throw new Error("CLOUDFLARE_ROOT ontbreekt of is geen watishetweer.pages.dev-deployment.");
}

const route="/api/plaatsnaam?lat=52.3508&lon=5.2647";
const deadline=Date.now()+90000;
const intervalMs=3000;
const requestTimeoutMs=15000;
let poging=0;

function wacht(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

async function probeer(){
  poging+=1;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),requestTimeoutMs);
  try{
    const r=await fetch(ROOT+route,{redirect:"manual",cache:"no-store",signal:controller.signal});
    const text=await r.text();
    let json=false;
    try{if(text)JSON.parse(text),json=true;}catch{}

    if(r.status!==404&&json){
      console.log(`Cloudflare Functions-route is actief na poging ${poging}: HTTP ${r.status}.`);
      return true;
    }

    console.log(`Cloudflare Functions nog niet gereed, poging ${poging}: HTTP ${r.status}, JSON=${json}.`);
    return false;
  }catch(error){
    console.log(`Cloudflare Functions nog niet bereikbaar, poging ${poging}: ${error&&error.name||"fout"}.`);
    return false;
  }finally{
    clearTimeout(timer);
  }
}

(async()=>{
  while(Date.now()<deadline){
    if(await probeer())return;
    await wacht(intervalMs);
  }
  throw new Error(`Cloudflare Pages Functions zijn na 90 seconden nog niet gereed op ${ROOT}.`);
})().catch(error=>{
  console.error(error&&error.stack||error);
  process.exit(1);
});
