"use strict";

const SEO=require("./seo-foundation.config.js");
const MARKER="<!-- WEATHER NOW SEO FOUNDATION -->";
const SHARE_IMAGE="https://watishetweer.nl/icon-512.png";
const CLOUDFLARE_INSIGHTS="https://static.cloudflareinsights.com";
const META_CSP_BRON=`<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://api.open-meteo.com https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com https://api.bigdatacloud.net; base-uri 'none'; form-action 'none'">`;
const META_CSP_PRODUCTIE=`<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' ${CLOUDFLARE_INSIGHTS}; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://api.open-meteo.com https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com https://api.bigdatacloud.net; base-uri 'none'; form-action 'none'">`;

function attr(v){return String(v).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

function pasCloudflareInsightsCspToe(html){
  const bron=String(html||"");
  const oud=bron.split(META_CSP_BRON).length-1;
  const nieuw=bron.split(META_CSP_PRODUCTIE).length-1;
  if(nieuw===1&&oud===0)return bron;
  if(oud!==1||nieuw!==0)throw new Error("Cloudflare Insights meta-CSP ontbreekt, is dubbel of al ambigu: bron="+oud+", productie="+nieuw);
  return bron.replace(META_CSP_BRON,META_CSP_PRODUCTIE);
}

function pasSeoFoundationToe(html){
  let bron=String(html||"");
  if(bron.includes(MARKER))return bron;
  bron=pasCloudflareInsightsCspToe(bron);

  const titles=[...bron.matchAll(/<title>[^<]*<\/title>/g)];
  if(titles.length!==1)throw new Error("SEO verwacht exact één title-element; gevonden: "+titles.length);
  const descriptions=[...bron.matchAll(/<meta name="description" content="[^"]*">/g)];
  if(descriptions.length!==1)throw new Error("SEO verwacht exact één meta-description; gevonden: "+descriptions.length);

  bron=bron.replace(titles[0][0],`<title>${SEO.title}</title>`);
  const nieuweDescription=`<meta name="description" content="${attr(SEO.description)}">`;
  bron=bron.replace(descriptions[0][0],nieuweDescription);

  /* Google ondersteunt meerdere JSON-LD-items expliciet als een top-level array.
     Met één WebSite-item blijft de semantiek identiek, terwijl het blok ook een
     geldige, onschadelijke JavaScript-expressie is voor de bestaande testloader. */
  const websiteJson=JSON.stringify([{
    "@context":"https://schema.org",
    "@type":"WebSite",
    name:SEO.siteName,
    url:SEO.canonical
  }]);
  const blok=[
    MARKER,
    `<link rel="canonical" href="${attr(SEO.canonical)}">`,
    `<meta name="msvalidate.01" content="${attr(SEO.bingVerification)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${attr(SEO.siteName)}">`,
    `<meta property="og:title" content="${attr(SEO.title)}">`,
    `<meta property="og:description" content="${attr(SEO.description)}">`,
    `<meta property="og:url" content="${attr(SEO.canonical)}">`,
    `<meta property="og:image" content="${SHARE_IMAGE}">`,
    `<meta property="og:image:width" content="512">`,
    `<meta property="og:image:height" content="512">`,
    `<meta property="og:image:alt" content="${attr(SEO.siteName)}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${attr(SEO.title)}">`,
    `<meta name="twitter:description" content="${attr(SEO.description)}">`,
    `<meta name="twitter:image" content="${SHARE_IMAGE}">`,
    `<meta name="twitter:image:alt" content="${attr(SEO.siteName)}">`,
    `<script type="application/ld+json">${websiteJson}</script>`
  ].join("\n");

  return bron.replace(nieuweDescription,nieuweDescription+"\n"+blok);
}

module.exports={MARKER,SHARE_IMAGE,CLOUDFLARE_INSIGHTS,META_CSP_BRON,META_CSP_PRODUCTIE,pasCloudflareInsightsCspToe,pasSeoFoundationToe};
