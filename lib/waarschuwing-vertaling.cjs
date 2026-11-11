"use strict";

/* Opt-in vertaling: nooit de officiële brontekst wijzigen of een dubieuze
   vertaling tonen. Zonder sleutel is dit een zuivere no-op. */
const ENDPOINT="https://api-free.deepl.com/v2/translate";
const MAX_TEKENS=1200,MAX_PER_ANTWOORD=3,TIMEOUT_MS=1600;
/* Deze brontalen hebben een aanvullende, conservatieve tekstveiligheidstest.
   Andere talen blijven bij een opt-in voorlopig in de officiële brontaal. */
const GETOETSTE_TALEN=new Set(["EN","FR","DE","ES","IT"]);
/* Deze woordlijsten vangen herkenbare ontkenningen en verboden op, niet de
   volledige betekenis van een veiligheidsinstructie. Alleen behoud van
   expliciete negatie-aantallen kan automatisch worden gecontroleerd. */
const ONTKENNINGEN={
  EN:/\b(?:no|not|never|without|avoid|avoiding|prohibited|forbidden|cannot|can't|don't|mustn't|shouldn't)\b/g,
  FR:/\b(?:pas|jamais|aucun(?:e|s|es)?|sans|interdit(?:e|s|es)?|evitez|eviter)\b/g,
  DE:/\b(?:nicht|kein(?:e|en|em|er|es)?|niemals|ohne|verboten|vermeiden|vermeide)\b/g,
  ES:/\b(?:no|nunca|jamas|sin|ningun(?:a|o)?|prohibid[oa]s?|evitar|evite|eviten)\b/g,
  IT:/\b(?:non|mai|senza|nessun(?:a|o)?|vietat[oa]s?|evitare|evita|evitate)\b/g,
  NL:/\b(?:niet|geen|nooit|zonder|vermijd(?:en)?|verboden|verbied(?:en)?|mijd(?:en)?)\b/g
};
const MIN_LENGTEVERHOUDING=0.42;
function aantalOntkenningen(tekst,taal){
  const patroon=ONTKENNINGEN[taal];
  if(!patroon)return 0;
  const zonderAccenten=String(tekst||"").normalize("NFD").replace(/\p{M}/gu,"").toLowerCase();
  return (zonderAccenten.match(patroon)||[]).length;
}
function tijdzones(s){
  return (String(s).match(/\b(?:UTC|GMT|CET|CEST|EST|EDT|PST|PDT)\b/gi)||[]).map(x=>x.toUpperCase());
}
const TAAL_CODE=/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;
function brontaal(w,bron){
  const code=String(w&&w.taal||"").trim();
  return TAAL_CODE.test(code)?code.split("-")[0].toUpperCase():bron==="National Weather Service"?"EN":null;
}
function getallen(s){
  const r=String(s).replace(/(\d)\s*[-–—]\s*(?=\d)/g,"$1 tot ");
  return (r.match(/[+−-]?\d+(?:[.,]\d+)*/g)||[]).map(x=>x.replace(/−/g,"-").replace(/,/g,"."));
}
function eenheden(s){
  return [...String(s).matchAll(/(\d+(?:[.,]\d+)?)\s*(km\/h|km\/u|m\/s|mph|knots?|kts?|bft|mm|cm|hpa|°\s*[cf]|%)(?![\p{L}\p{N}])/giu)]
    .map(x=>{
      const unit=x[2].toLowerCase().replace(/\s+/g,"");
      const gelijk={ "km/u":"km/h",kts:"kt",knot:"kt",knots:"kt" };
      return x[1].replace(/,/g,".")+" "+(gelijk[unit]||unit);
    });
}
function gelijk(x,y){
  return x.length===y.length&&x.every((v,i)=>v===y[i]);
}
/* Alleen deterministische, conservatieve signalen. Deze validatie bewijst
   NIET dat een vertaling van veiligheidsinstructies semantisch correct is. */
function veilig(bron,vertaald,taal){
  const a=String(bron||"").trim(),b=String(vertaald||"").trim();
  const lang=String(taal||"").toUpperCase();
  if(!a||!b||a===b||b.length>Math.max(400,a.length*4)||/[<>]/.test(b))return false;
  if(lang&&!GETOETSTE_TALEN.has(lang))return false;
  if(a.length>=100&&b.length<a.length*MIN_LENGTEVERHOUDING)return false;
  if(/(?:\.{3,}|…)\s*$/.test(b))return false;
  /* Apart CAP/NWS-instructieveld: door de server als aparte regel bewaard.
     Een verdwenen instructieregel wordt nooit stilzwijgend geaccepteerd. */
  const regels=s=>s.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const bronRegels=regels(a),vertaaldeRegels=regels(b);
  if(bronRegels.length!==vertaaldeRegels.length)return false;
  if(!gelijk(getallen(a),getallen(b))||!gelijk(eenheden(a),eenheden(b)))return false;
  if(!gelijk(tijdzones(a),tijdzones(b)))return false;
  if(lang&&bronRegels.some((regel,i)=>
    aantalOntkenningen(regel,lang)!==aantalOntkenningen(vertaaldeRegels[i],"NL")))return false;
  return true;
}
async function cacheSleutel(taal,bron,cryptoApi){
  if(!cryptoApi||!cryptoApi.subtle)return null;
  const bytes=new TextEncoder().encode("waarsch-vertaling-v2|"+taal+"|"+bron);
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
      if(r&&r.ok){const t=await r.text();if(veilig(bron,t,taal))return t;}
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
    if(!t||!veilig(bron,t.text,taal))return null;
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
    if(!w||!taal||taal==="NL"||!GETOETSTE_TALEN.has(taal)||!tekst||w.tekstIngekort===true||tekst.length>MAX_TEKENS||/(?:…|\.{3,})$/.test(tekst))continue;
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
module.exports={ENDPOINT,MAX_TEKENS,MAX_PER_ANTWOORD,GETOETSTE_TALEN,brontaal,getallen,eenheden,veilig,vertaalWaarschuwingen};