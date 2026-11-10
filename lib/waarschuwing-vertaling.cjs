"use strict";

/* Opt-in vertaling: nooit de officiële brontekst wijzigen of een dubieuze
   vertaling tonen. Zonder sleutel is dit een zuivere no-op. */
const ENDPOINT="https://api-free.deepl.com/v2/translate";
const MAX_TEKENS=1200,MAX_PER_ANTWOORD=3,TIMEOUT_MS=1600;
const TAAL_CODE=/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;
function brontaal(w,bron){
  const code=String(w&&w.taal||"").trim();
  return TAAL_CODE.test(code)?code.split("-")[0].toUpperCase():bron==="National Weather Service"?"EN":null;
}
function getallen(s){return (String(s).match(/\d+(?:[.,]\d+)*/g)||[]).map(x=>x.replace(/,/g,"."));}
function eenheden(s){
  return [...String(s).matchAll(/(\d+(?:[.,]\d+)?)\s*(km\/h|km\/u|mph|mm|cm|hpa|°c|°f)\b/gi)]
    .map(x=>x[1].replace(/,/g,".")+" "+x[2].toLowerCase().replace("km/u","km/h"));
}
function veilig(bron,vertaald){
  const a=String(bron||"").trim(),b=String(vertaald||"").trim();
  if(!a||!b||a===b||b.length>Math.max(400,a.length*4)||/[<>]/.test(b))return false;
  const gelijk=(x,y)=>x.length===y.length&&x.every((v,i)=>v===y[i]);
  return gelijk(getallen(a),getallen(b))&&gelijk(eenheden(a),eenheden(b));
}
async function cacheSleutel(taal,bron,cryptoApi){
  if(!cryptoApi||!cryptoApi.subtle)return null;
  const bytes=new TextEncoder().encode("waarsch-vertaling-v1|"+taal+"|"+bron);
  const hash=await cryptoApi.subtle.digest("SHA-256",bytes);
  const hex=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("");
  return new Request("https://watishetweer.nl/__wiw-interne-waarschuwingsvertaling/"+hex);
}
async function vertaalEen(bron,taal,key,fetcher,cache,cryptoApi){
  let sleutel=null;
  if(cache)try{
    sleutel=await cacheSleutel(taal,bron,cryptoApi);
    if(sleutel){
      const r=await cache.match(sleutel);
      if(r&&r.ok){const t=await r.text();if(veilig(bron,t))return t;}
    }
  }catch(_){sleutel=null;}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const res=await fetcher(ENDPOINT,{
      method:"POST",
      headers:{"Authorization":"DeepL-Auth-Key "+key,"Content-Type":"application/json"},
      body:JSON.stringify({text:[bron],target_lang:"NL",source_lang:taal,preserve_formatting:true}),
      signal:controller.signal
    });
    if(!res||!res.ok)return null;
    const data=await res.json(),t=data&&Array.isArray(data.translations)?data.translations[0]:null;
    if(!t||!veilig(bron,t.text))return null;
    const detected=String(t.detected_source_language||"").toUpperCase();
    if(detected&&detected!==taal)return null;
    const tekst=t.text.trim();
    if(cache&&sleutel)try{
      await cache.put(sleutel,new Response(tekst,{headers:{"Cache-Control":"public, max-age=86400"}}));
    }catch(_){}
    return tekst;
  }catch(_){return null;}finally{clearTimeout(timer);}
}
async function vertaalWaarschuwingen(data,env,opts={}){
  if(!data||data.dekking!==true||!Array.isArray(data.lijst)||!data.lijst.length)return data;
  if(opts.taal==="en"||!env||env.DEEPL_TRANSLATE_ENABLED!=="1"||!String(env.DEEPL_API_KEY||"").trim())return data;
  const bron=String(data.bron||"");
  if(!/^MeteoAlarm\b/i.test(bron)&&bron!=="National Weather Service")return data;
  const kandidaten=[];
  for(let i=0;i<data.lijst.length&&kandidaten.length<MAX_PER_ANTWOORD;i++){
    const w=data.lijst[i],taal=brontaal(w,bron),tekst=String(w&&w.tekst||"").trim();
    if(!w||!taal||taal==="NL"||!tekst||tekst.length>MAX_TEKENS||/…$/.test(tekst))continue;
    kandidaten.push({i,taal,tekst});
  }
  if(!kandidaten.length)return data;
  const fetcher=opts.fetcher||globalThis.fetch;
  if(typeof fetcher!=="function")return data;
  const cache=opts.cache!==undefined?opts.cache:(globalThis.caches&&globalThis.caches.default);
  const cryptoApi=opts.cryptoApi!==undefined?opts.cryptoApi:globalThis.crypto;
  const hergebruik=new Map();
  const translated=await Promise.all(kandidaten.map(k=>{
    const id=k.taal+"|"+k.tekst;
    if(!hergebruik.has(id))hergebruik.set(id,vertaalEen(k.tekst,k.taal,env.DEEPL_API_KEY,fetcher,cache,cryptoApi));
    return hergebruik.get(id);
  }));
  if(!translated.some(Boolean))return data;
  const lijst=data.lijst.slice();
  kandidaten.forEach((k,i)=>{
    if(translated[i])lijst[k.i]={...lijst[k.i],vertaling:{tekst:translated[i],methode:"deepl",automatisch:true}};
  });
  return {...data,lijst};
}
module.exports={ENDPOINT,MAX_TEKENS,MAX_PER_ANTWOORD,brontaal,getallen,eenheden,veilig,vertaalWaarschuwingen};