"use strict";

(()=>{
  const ENDPOINT="https://plausible.io/api/event";
  const DOMAIN="watishetweer.nl";
  const CANONIEKE_ORIGIN="https://watishetweer.nl";
  const PRODUCTIE_HOSTS=new Set(["watishetweer.nl","www.watishetweer.nl"]);

  /* Alleen echte publieke productiebezoeken. Preview-, lokale en niet-HTTPS
     omgevingen mogen nooit in het bezoekersdashboard terechtkomen. */
  if(location.protocol!=="https:"||!PRODUCTIE_HOSTS.has(String(location.hostname||"").toLowerCase()))return;

  /* Browserautomatisering vormt een groot deel van onze QA. Playwright zet
     navigator.webdriver; de extra UA-signalen vangen gangbare headless runners.
     Plausible past daarnaast zelf bot-, datacenter- en patroonfilters toe. */
  const ua=String(navigator.userAgent||"");
  if(navigator.webdriver===true||/(?:HeadlessChrome|Playwright|Puppeteer|Lighthouse)/i.test(ua))return;

  /* Respecteer expliciete browser-privacyseinen, gelijk aan de bestaande
     PostHog-laag. */
  if(navigator.globalPrivacyControl===true||navigator.doNotTrack==="1"||window.doNotTrack==="1")return;

  /* Plaatsnamen, coördinaten, querystrings en hashes horen niet in analytics.
     Weerroutes worden daarom vóór verzending samengevat tot één generiek pad. */
  function veiligPad(pad){
    const p=String(pad||"/");
    if(/^\/weer(?:\/|$)/i.test(p))return "/weer/:location";
    if(p==="/"||p==="/index.html")return "/";
    if(p==="/privacy"||p==="/privacy.html")return "/privacy";
    if(p==="/over"||p==="/over/")return "/over/";
    return "/_other";
  }

  const payload={
    name:"pageview",
    url:CANONIEKE_ORIGIN+veiligPad(location.pathname),
    domain:DOMAIN
  };

  /* De browser stuurt zijn normale User-Agent en netwerkadres rechtstreeks naar
     Plausible. Die twee signalen gebruikt Plausible voor unieke bezoekers en
     botfiltering. We zetten bewust geen X-Forwarded-For en sturen geen Referer. */
  try{
    fetch(ENDPOINT,{
      method:"POST",
      mode:"cors",
      credentials:"omit",
      referrerPolicy:"no-referrer",
      keepalive:true,
      headers:{"Content-Type":"text/plain"},
      body:JSON.stringify(payload)
    }).catch(()=>{});
  }catch(e){}
})();
