"use strict";

const SEO=require("./seo-foundation.config.js");
const MARKER="<!-- WEATHER NOW SEO FOUNDATION -->";
const BRAND_LINK_MARKER="<!-- WEATHER NOW BRAND LINK -->";
const SHARE_IMAGE="https://watishetweer.nl/icon-512.png";

function attr(v){return String(v).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

function maakBrandStructuredData(){
  return [
    {
      "@context":"https://schema.org",
      "@type":"Organization",
      "@id":SEO.organizationId,
      name:SEO.siteName,
      alternateName:[...SEO.alternateNames],
      url:SEO.canonical,
      logo:{"@type":"ImageObject",url:SEO.logo,width:512,height:512},
      description:SEO.brandDescription
    },
    {
      "@context":"https://schema.org",
      "@type":"WebSite",
      "@id":SEO.websiteId,
      name:SEO.siteName,
      alternateName:[...SEO.alternateNames],
      url:SEO.canonical,
      publisher:{"@id":SEO.organizationId}
    }
  ];
}

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

  /* Eén canonieke merkidentiteit op de homepage: watishetweer.nl is de vaste
     sitenaam; "Wat is het weer?" blijft de zichtbare productnaam en staat als
     alternateName in dezelfde graph. Organization en WebSite delen stabiele
     @id's, zodat crawlers publisher en website niet als losse entiteiten hoeven
     te raden. We voegen bewust geen sameAs-profielen toe zolang er geen echte,
     door het project beheerde externe merkprofielen zijn. */
  const websiteJson=JSON.stringify(maakBrandStructuredData());
  const blok=[
    MARKER,
    `<link rel="canonical" href="${attr(SEO.canonical)}">`,
    `<link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png">`,
    `<meta name="google-site-verification" content="${attr(SEO.googleVerification)}">`,
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
  bron=bron.replace(nieuweDescription,nieuweDescription+"\n"+blok);

  /* De zichtbare productkop blijft bewust "Wat is het weer?". Een kleine,
     crawlbare merkverwijzing in de bestaande footer koppelt die interface aan
     de vaste domeinnaam en aan de transparante Over-pagina, zonder de hero of
     de zoekintentie van de weerpagina te veranderen. */
  const footerMatches=[...bron.matchAll(/<footer>/g)];
  if(footerMatches.length!==1)throw new Error("SEO verwacht exact één footer voor de merkverwijzing; gevonden: "+footerMatches.length);
  const brandLink=`${BRAND_LINK_MARKER}\n      <span class="bron"><a href="/over/"><b>${attr(SEO.siteName)}</b> · Over deze site</a></span>`;
  bron=bron.replace("<footer>","<footer>\n      "+brandLink);

  return bron;
}

module.exports={MARKER,BRAND_LINK_MARKER,SHARE_IMAGE,maakBrandStructuredData,pasSeoFoundationToe};
