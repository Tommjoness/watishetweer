"use strict";

const SEO=require("./seo-foundation.config.js");
const MARKER="<!-- WEATHER NOW SEO FOUNDATION -->";

function attr(v){return String(v).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

function pasSeoFoundationToe(html){
  let bron=String(html||"");
  if(bron.includes(MARKER))return bron;

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
    `<meta name="twitter:card" content="summary">`,
    `<script type="application/ld+json">${websiteJson}</script>`
  ].join("\n");

  return bron.replace(nieuweDescription,nieuweDescription+"\n"+blok);
}

module.exports={MARKER,pasSeoFoundationToe};
