"use strict";

const ROUTES=Object.freeze([
  Object.freeze({naam:"plaatsnaam",pad:"/api/plaatsnaam?lat=52.3508&lon=5.2647"}),
  Object.freeze({naam:"neerslag",pad:"/api/neerslag?lat=52.3508&lon=5.2647&land=NL"}),
  Object.freeze({naam:"luchtkwaliteit",pad:"/api/luchtkwaliteit?lat=50.8503&lon=4.3517&land=BE"}),
  Object.freeze({naam:"waarschuwingen",pad:"/api/waarschuwingen?lat=52.3508&lon=5.2647&land=NL"})
]);
const intervalMs=3000;
const requestTimeoutMs=15000;
const readinessTimeoutMs=90000;
const vereisteOpeenvolgendeSuccessen=3;

function geldigeRoot(waarde){
  const root=String(waarde||"").replace(/\/$/,"");
  if(!/^https:\/\/[a-z0-9-]+\.watishetweer\.pages\.dev$/i.test(root)){
    throw new Error("CLOUDFLARE_ROOT ontbreekt of is geen watishetweer.pages.dev-deployment.");
  }
  return root;
}
function wacht(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function geldigeJson(text){
  if(!text)return false;
  try{JSON.parse(text);return true;}catch{return false;}
}
function routeIsGereed(status,text){return Number(status)!==404&&geldigeJson(text);}

async function controleerRoute(root,route,fetchImpl=fetch){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),requestTimeoutMs);
  try{
    const r=await fetchImpl(root+route.pad,{redirect:"manual",cache:"no-store",signal:controller.signal});
    const text=await r.text();
    return {naam:route.naam,status:r.status,json:geldigeJson(text),gereed:routeIsGereed(r.status,text)};
  }catch(error){
    return {naam:route.naam,status:null,json:false,gereed:false,fout:error&&error.name||"fout"};
  }finally{
    clearTimeout(timer);
  }
}

async function probeer(root,poging,fetchImpl=fetch){
  const resultaten=await Promise.all(ROUTES.map(route=>controleerRoute(root,route,fetchImpl)));
  const nietGereed=resultaten.filter(x=>!x.gereed);
  if(!nietGereed.length){
    console.log(`Alle Cloudflare Functions-routes zijn actief bij poging ${poging}: ${resultaten.map(x=>`${x.naam}=HTTP ${x.status}`).join(", ")}.`);
    return true;
  }
  console.log(`Cloudflare Functions nog niet volledig gereed, poging ${poging}: ${resultaten.map(x=>`${x.naam}=HTTP ${x.status===null?x.fout:x.status}, JSON=${x.json}`).join("; ")}.`);
  return false;
}

async function wachtTotGereed(root,fetchImpl=fetch,nu=Date.now,wachtImpl=wacht){
  const deadline=nu()+readinessTimeoutMs;
  let poging=0;
  let opeenvolgendeSuccessen=0;
  while(nu()<deadline){
    poging+=1;
    if(await probeer(root,poging,fetchImpl)){
      opeenvolgendeSuccessen+=1;
      if(opeenvolgendeSuccessen>=vereisteOpeenvolgendeSuccessen){
        console.log(`Cloudflare Functions zijn stabiel gereed na ${vereisteOpeenvolgendeSuccessen} opeenvolgende succesvolle controles.`);
        return;
      }
    }else{
      opeenvolgendeSuccessen=0;
    }
    await wachtImpl(intervalMs);
  }
  throw new Error(`Cloudflare Pages Functions zijn na 90 seconden niet stabiel alle vier gereed op ${root}.`);
}

if(require.main===module){
  const root=geldigeRoot(process.env.CLOUDFLARE_ROOT);
  wachtTotGereed(root).catch(error=>{
    console.error(error&&error.stack||error);
    process.exit(1);
  });
}

module.exports={ROUTES,geldigeRoot,geldigeJson,routeIsGereed,controleerRoute,probeer,wachtTotGereed,readinessTimeoutMs,vereisteOpeenvolgendeSuccessen};
