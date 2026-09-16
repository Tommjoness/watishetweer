"use strict";

(()=>{
  const ENDPOINT="https://eu.i.posthog.com/i/v0/e/";
  const PROJECT_TOKEN="phc_CbwHFnRAdTUsCJjwXfhGspfbMopbKRPpsN5tqyQAXYvZ";
  const PRODUCTIE_HOSTS=new Set(["watishetweer.nl","www.watishetweer.nl"]);
  const GA4_MEASUREMENT_ID="G-H498VPZ9Z1";
  const GA4_CONSENT_KEY="weerbriefing.ga4.consent.v1";

  /* Analytics draait uitsluitend op de echte publieke site. Preview-, test- en
     lokale omgevingen sturen dus nooit per ongeluk ontwikkelverkeer naar analytics. */
  if(location.protocol!=="https:"||!PRODUCTIE_HOSTS.has(String(location.hostname||"").toLowerCase()))return;

  /* Respecteer expliciete browser-privacyseinen. Bij GPC/DNT start noch PostHog
     noch Google Analytics en wordt ook geen analytics-toestemming gevraagd. */
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

  /* Plaatsnamen, coördinaten, querystrings en hashes mogen nooit PostHog-data
     worden. Weerroutes worden daarom bewust tot één generieke route samengevat. */
  function veiligPad(pad){
    const p=String(pad||"/");
    if(/^\/weer(?:\/|$)/i.test(p))return "/weer/:location";
    if(p==="/"||p==="/index.html")return "/";
    if(p==="/privacy"||p==="/privacy.html")return "/privacy";
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

  /* Google Analytics draait in basic consent mode: de Google-tag wordt pas na
     expliciete toestemming geladen. Voor toestemming gaat er dus geen request,
     cookieless ping of consentstatus naar Google. Advertentiesignalen blijven
     ook na analytics-toestemming uitgeschakeld. */
  function leesGa4Keuze(){
    try{
      const keuze=localStorage.getItem(GA4_CONSENT_KEY);
      return keuze==="granted"||keuze==="denied"?keuze:null;
    }catch(e){return null;}
  }

  function bewaarGa4Keuze(keuze){
    try{localStorage.setItem(GA4_CONSENT_KEY,keuze);}catch(e){}
  }

  function wisGa4Cookies(){
    try{
      const namen=document.cookie.split(";").map(x=>x.split("=")[0].trim()).filter(x=>/^_ga(?:_|$)|^_gid$|^_gat/.test(x));
      const hosts=[location.hostname,"."+location.hostname.replace(/^www\./,"")];
      for(const naam of namen){
        document.cookie=`${naam}=; Max-Age=0; Path=/; SameSite=Lax`;
        for(const domain of hosts)document.cookie=`${naam}=; Max-Age=0; Path=/; Domain=${domain}; SameSite=Lax`;
      }
    }catch(e){}
  }

  function gtag(){
    window.dataLayer=window.dataLayer||[];
    window.dataLayer.push(arguments);
  }

  function startGa4(){
    if(window.__weatherNowGa4Started||/^\/admin(?:\/|$)/i.test(location.pathname))return;
    window.__weatherNowGa4Started=true;
    window.dataLayer=window.dataLayer||[];
    window.gtag=gtag;
    gtag("consent","default",{
      analytics_storage:"denied",
      ad_storage:"denied",
      ad_user_data:"denied",
      ad_personalization:"denied"
    });
    gtag("consent","update",{
      analytics_storage:"granted",
      ad_storage:"denied",
      ad_user_data:"denied",
      ad_personalization:"denied"
    });
    gtag("js",new Date());
    const pad=String(location.pathname||"/");
    gtag("config",GA4_MEASUREMENT_ID,{
      page_location:location.origin+pad,
      page_path:pad,
      page_title:document.title,
      allow_google_signals:false,
      allow_ad_personalization_signals:false
    });
    const script=document.createElement("script");
    script.async=true;
    script.src="https://www.googletagmanager.com/gtag/js?id="+encodeURIComponent(GA4_MEASUREMENT_ID);
    script.referrerPolicy="no-referrer";
    script.dataset.analytics="ga4";
    document.head.appendChild(script);
  }

  function verwijderBanner(){
    const bestaand=document.getElementById("analytics-toestemming");
    if(bestaand)bestaand.remove();
  }

  function zetPrivacyBediening(){
    const knop=document.querySelector("[data-ga4-consent-toggle]");
    const status=document.querySelector("[data-ga4-consent-status]");
    if(!knop&&!status)return;
    const keuze=leesGa4Keuze();
    if(knop){
      knop.textContent=keuze==="granted"?"Google Analytics uitschakelen":"Google Analytics toestaan";
      knop.onclick=()=>{
        if(leesGa4Keuze()==="granted"){
          bewaarGa4Keuze("denied");
          wisGa4Cookies();
          location.reload();
        }else{
          bewaarGa4Keuze("granted");
          startGa4();
          zetPrivacyBediening();
        }
      };
    }
    if(status)status.textContent=keuze==="granted"?" Google Analytics is toegestaan.":keuze==="denied"?" Google Analytics is uitgeschakeld.":" Er is nog geen keuze opgeslagen.";
  }

  function toonBanner(){
    if(document.getElementById("analytics-toestemming")||/^\/admin(?:\/|$)/i.test(location.pathname))return;
    const style=document.createElement("style");
    style.id="analytics-toestemming-stijl";
    style.textContent="#analytics-toestemming{position:fixed;z-index:2147483000;left:50%;bottom:18px;transform:translateX(-50%);width:min(680px,calc(100% - 28px));box-sizing:border-box;padding:16px 18px;border:1px solid color-mix(in srgb,CanvasText 22%,transparent);border-radius:14px;background:Canvas;color:CanvasText;box-shadow:0 12px 34px rgba(0,0,0,.18);font:15px/1.45 system-ui,-apple-system,sans-serif}#analytics-toestemming p{margin:0 0 12px}#analytics-toestemming a{color:inherit;text-underline-offset:2px}#analytics-toestemming .analytics-acties{display:flex;gap:10px;flex-wrap:wrap}#analytics-toestemming button{appearance:none;border:1px solid color-mix(in srgb,CanvasText 35%,transparent);border-radius:9px;background:Canvas;color:CanvasText;padding:9px 13px;font:600 14px/1.2 system-ui,-apple-system,sans-serif;cursor:pointer}#analytics-toestemming button:focus-visible{outline:2px solid Highlight;outline-offset:2px}@media(max-width:520px){#analytics-toestemming{bottom:10px;padding:14px}.analytics-acties button{flex:1}}";
    document.head.appendChild(style);
    const banner=document.createElement("aside");
    banner.id="analytics-toestemming";
    banner.setAttribute("role","dialog");
    banner.setAttribute("aria-label","Toestemming voor Google Analytics");
    banner.innerHTML='<p><b>Bezoekstatistieken</b><br>Mag Google Analytics meten hoe de site wordt gebruikt? De Google-tag wordt pas geladen nadat je toestemming geeft. <a href="/privacy.html">Lees meer</a>.</p><div class="analytics-acties"><button type="button" data-keuze="denied">Weigeren</button><button type="button" data-keuze="granted">Toestaan</button></div>';
    banner.addEventListener("click",event=>{
      const knop=event.target&&event.target.closest&&event.target.closest("button[data-keuze]");
      if(!knop)return;
      const keuze=knop.getAttribute("data-keuze")==="granted"?"granted":"denied";
      bewaarGa4Keuze(keuze);
      verwijderBanner();
      if(keuze==="granted")startGa4();
      else wisGa4Cookies();
      zetPrivacyBediening();
    });
    document.body.appendChild(banner);
  }

  window.WeatherNowGA4Consent=Object.freeze({
    status:leesGa4Keuze,
    allow(){bewaarGa4Keuze("granted");verwijderBanner();startGa4();zetPrivacyBediening();},
    deny(){bewaarGa4Keuze("denied");verwijderBanner();wisGa4Cookies();zetPrivacyBediening();}
  });

  const ga4Keuze=leesGa4Keuze();
  if(ga4Keuze==="granted")startGa4();
  else if(ga4Keuze===null)toonBanner();
  zetPrivacyBediening();
})();
