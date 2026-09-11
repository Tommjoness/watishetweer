"use strict";

(()=>{
  const ENDPOINT="https://eu.i.posthog.com/i/v0/e/";
  const PROJECT_TOKEN="phc_CbwHFnRAdTUsCJjwXfhGspfbMopbKRPpsN5tqyQAXYvZ";
  const PRODUCTIE_HOSTS=new Set(["watishetweer.nl","www.watishetweer.nl"]);

  /* Analytics draait uitsluitend op de echte publieke site. Preview-, test- en
     lokale omgevingen sturen dus nooit per ongeluk ontwikkelverkeer naar PostHog. */
  if(location.protocol!=="https:"||!PRODUCTIE_HOSTS.has(String(location.hostname||"").toLowerCase()))return;

  /* Respecteer expliciete browser-privacyseinen. Dit is aanvullend op het feit
     dat deze integratie zelf geen cookies/localStorage/sessionStorage gebruikt. */
  if(navigator.globalPrivacyControl===true||navigator.doNotTrack==="1"||window.doNotTrack==="1")return;

  function tijdelijkId(){
    try{
      if(globalThis.crypto&&typeof globalThis.crypto.randomUUID==="function")return "anon_"+globalThis.crypto.randomUUID();
      if(globalThis.crypto&&typeof globalThis.crypto.getRandomValues==="function"){
        const delen=new Uint32Array(4);globalThis.crypto.getRandomValues(delen);
        return "anon_"+Array.from(delen,n=>n.toString(16).padStart(8,"0")).join("");
      }
    }catch(e){}
    return "anon_"+Date.now().toString(36)+Math.random().toString(36).slice(2);
  }

  /* Plaatsnamen, coördinaten, querystrings en hashes mogen nooit analyticsdata
     worden. Weerroutes worden daarom bewust tot één generieke route samengevat. */
  function veiligPad(pad){
    const p=String(pad||"/");
    if(/^\/weer(?:\/|$)/i.test(p))return "/weer/:location";
    if(p==="/"||p==="/index.html")return "/";
    if(p==="/privacy.html")return "/privacy.html";
    if(p==="/over"||p==="/over/")return "/over/";
    return "/_other";
  }

  function schermgroep(){
    const breedte=Math.max(0,Number(window.innerWidth)||0);
    return breedte<768?"mobile":breedte<1100?"tablet":"desktop";
  }

  const distinctId=tijdelijkId();

  function stuur(event,extra){
    const pathname=veiligPad(location.pathname);
    const properties=Object.assign({
      "$geoip_disable":true,
      "$process_person_profile":false,
      "$current_url":location.origin+pathname,
      "$host":location.hostname,
      "$pathname":pathname,
      "viewport_group":schermgroep(),
      "analytics_contract":"privacy-safe-v1"
    },extra||{});
    const payload={api_key:PROJECT_TOKEN,event,distinct_id:distinctId,properties};

    /* Geen credentials en geen Referer-header naar PostHog. Een geblokkeerde of
       mislukte analyticscall mag nooit invloed hebben op de weerervaring. */
    try{
      fetch(ENDPOINT,{
        method:"POST",
        mode:"cors",
        credentials:"omit",
        referrerPolicy:"no-referrer",
        keepalive:true,
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      }).catch(()=>{});
    }catch(e){}
  }

  stuur("$pageview");

  /* Alleen betekenisvolle, generieke interacties. De ingetypte of gekozen
     plaats zelf wordt uitdrukkelijk niet als eventproperty meegestuurd. */
  const q=document.getElementById("q");
  if(q){
    let zoekenGemeld=false;
    q.addEventListener("input",()=>{
      if(zoekenGemeld||!String(q.value||"").trim())return;
      zoekenGemeld=true;stuur("weather_search_started");
    },{passive:true});
  }
  const res=document.getElementById("res");
  if(res)res.addEventListener("click",()=>stuur("weather_search_result_selected"),{passive:true});
  const here=document.getElementById("here");
  if(here)here.addEventListener("click",()=>stuur("current_location_requested"),{passive:true});
  const ververs=document.getElementById("ververs");
  if(ververs)ververs.addEventListener("click",()=>stuur("weather_refresh_requested"),{passive:true});
  const thema=document.getElementById("thema");
  if(thema)thema.addEventListener("click",()=>stuur("theme_control_used"),{passive:true});
})();
