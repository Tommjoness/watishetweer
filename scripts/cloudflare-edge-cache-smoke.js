"use strict";

const roots=String(process.env.CACHE_ROOTS||"").split(",").map(x=>x.trim().replace(/\/$/,"")).filter(Boolean);
const probeId=String(process.env.CACHE_PROBE_ID||process.env.EXPECTED_SHA||Date.now());
const timeoutMs=20000;

function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function offset(seed,schaal){return ((seed%2001)-1000)*schaal;}
function vaste(n,d){return Number(n).toFixed(d);}
function wacht(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

function routesVoorProbe(id){
  const h=hash(id);
  const plaatsLat=52.3508+offset(h,0.000001);
  const plaatsLon=5.2647+offset(h>>>5,0.000001);
  const jpLat=35.6812+offset(h>>>9,0.000001);
  const jpLon=139.7671+offset(h>>>13,0.000001);
  return [
    {
      naam:"plaatsnaam",
      pad:`/api/plaatsnaam?lat=${vaste(plaatsLat,4)}&lon=${vaste(plaatsLon,4)}`,
      cachebaar:b=>Boolean(b&&b.bron==="viaNominatim"&&!b.reden),
      tijdelijk:b=>Boolean(b&&String(b.reden||"").includes("plaatsnaambron tijdelijk"))
    },
    {
      naam:"neerslag",
      pad:`/api/neerslag?lat=${vaste(jpLat,5)}&lon=${vaste(jpLon,5)}&land=JP`,
      cachebaar:b=>Boolean(b&&(b.beschikbaar===true||(b.beschikbaar===false&&b.provider==null&&b.reden==="geen actuele neerslagprovider voor deze locatie")))
    },
    {
      naam:"waarschuwingen",
      pad:`/api/waarschuwingen?lat=${vaste(jpLat,6)}&lon=${vaste(jpLon,6)}&land=JP`,
      cachebaar:b=>Boolean(b&&(b.dekking===true||(b.dekking===false&&b.bron==null&&String(b.reden||"").startsWith("geen waarschuwingsbron voor "))))
    }
  ];
}

async function haal(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const r=await fetch(url,{redirect:"follow",headers:{"User-Agent":"watishetweer.nl production cache smoke"},signal:controller.signal});
    const tekst=await r.text();
    let body=null;try{body=tekst?JSON.parse(tekst):null;}catch{}
    return {
      status:r.status,
      finalUrl:r.url,
      wiw:r.headers.get("x-wiw-edge-cache")||"-",
      cf:r.headers.get("cf-cache-status")||"-",
      age:r.headers.get("age")||"-",
      body
    };
  }finally{clearTimeout(timer);}
}

function variant(root,pad){
  const u=new URL(root+pad);
  const entries=[...u.searchParams.entries()].reverse();
  u.search="";
  for(const [k,v] of entries) u.searchParams.append(k,v);
  u.searchParams.append("cache_smoke_noise","genegeerd");
  if(u.searchParams.has("lat"))u.searchParams.set("lat",String(Number(u.searchParams.get("lat"))));
  if(u.searchParams.has("lon"))u.searchParams.set("lon",String(Number(u.searchParams.get("lon"))));
  return u.toString();
}

async function controleer(root,route){
  const eerste=await haal(root+route.pad);
  if(eerste.status!==200)throw new Error(`${route.naam} ${root}: eerste request HTTP ${eerste.status}`);
  if(!route.cachebaar(eerste.body)){
    if(route.tijdelijk&&route.tijdelijk(eerste.body)){
      console.warn(`${route.naam} ${root}: tijdelijke upstreamdegradatie, live cacheprobe overgeslagen (${eerste.wiw}).`);
      return {overgeslagen:true};
    }
    throw new Error(`${route.naam} ${root}: response is niet veilig cachebaar: ${JSON.stringify(eerste.body)}`);
  }
  if(!["MISS","HIT"].includes(eerste.wiw))throw new Error(`${route.naam} ${root}: verwacht MISS/HIT, kreeg ${eerste.wiw}`);

  let laatste=eerste;
  for(let poging=1;poging<=6&&laatste.wiw!=="HIT";poging++){
    await wacht(250*poging);
    laatste=await haal(variant(root,route.pad));
  }
  if(laatste.wiw!=="HIT")throw new Error(`${route.naam} ${root}: geen echte caches.default HIT na ${eerste.wiw}; laatste=${laatste.wiw}`);
  console.log(`${route.naam} ${root}: WIW ${eerste.wiw}->${laatste.wiw}; CF ${eerste.cf}->${laatste.cf}; Age ${eerste.age}->${laatste.age}; final=${laatste.finalUrl}`);
  return {overgeslagen:false,eerste,laatste};
}

async function main(){
  if(!roots.length)throw new Error("CACHE_ROOTS ontbreekt");
  const routes=routesVoorProbe(probeId);
  let gecontroleerd=0,overgeslagen=0;
  for(const root of roots){
    for(const route of routes){
      const r=await controleer(root,route);
      if(r.overgeslagen)overgeslagen+=1;else gecontroleerd+=1;
    }
  }
  if(gecontroleerd<roots.length*2)throw new Error(`te weinig live cacheroutes bewezen: ${gecontroleerd}, overgeslagen=${overgeslagen}`);
  console.log(`Cloudflare edge-cache live: ${gecontroleerd} route/domein-combinaties bewezen, ${overgeslagen} tijdelijk overgeslagen.`);
}

if(require.main===module){
  main().catch(error=>{console.error(error&&error.stack||error);process.exit(1);});
}

module.exports={hash,offset,routesVoorProbe,variant,controleer};
