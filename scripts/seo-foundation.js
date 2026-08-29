"use strict";

const SEO=require("./seo-foundation.config.js");
const MARKER="<!-- WEATHER NOW SEO FOUNDATION -->";
const BRAND_LINK_MARKER="<!-- WEATHER NOW BRAND LINK -->";
const SHARE_IMAGE="https://watishetweer.nl/icon-512.png";
const BRON_H1="<h1>Wat is het weer?</h1>";
const MERK_H1=`<h1>${SEO.siteName}</h1>`;
const BRON_APP_TITLE='<meta name="apple-mobile-web-app-title" content="Wat is het weer?">';
const MERK_APP_TITLE=`<meta name="apple-mobile-web-app-title" content="${SEO.siteName}">`;

function attr(v){return String(v).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function tel(tekst,zoek){return String(tekst).split(zoek).length-1;}

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
  if(tel(bron,BRON_H1)!==1)throw new Error("SEO verwacht exact één generieke bron-H1 voor de merknaam.");
  if(tel(bron,BRON_APP_TITLE)!==1)throw new Error("SEO verwacht exact één generieke Apple-appnaam voor de merknaam.");

  bron=bron.replace(titles[0][0],`<title>${SEO.title}</title>`);
  const nieuweDescription=`<meta name="description" content="${attr(SEO.description)}">`;
  bron=bron.replace(descriptions[0][0],nieuweDescription);
  bron=bron.replace(BRON_H1,MERK_H1);
  bron=bron.replace(BRON_APP_TITLE,MERK_APP_TITLE);

  /* Eén canonieke merkidentiteit op de homepage: watishetweer.nl is de vaste
     sitenaam én zichtbare merknaam. De schrijfwijze zonder .nl blijft alleen
     als alternateName voor de merkzoekopdracht bestaan. De generieke vraag
     "Wat is het weer?" wordt bewust niet als alternatieve merknaam gepubliceerd.
     Organization en WebSite delen stabiele @id's. We voegen geen sameAs-profielen
     toe zolang er geen echte, door het project beheerde externe merkprofielen zijn. */
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

  /* De footer herhaalt de vaste merknaam en koppelt die aan een transparante
     Over-pagina. De bestaande bronpresentatie heeft daarnaast een runtime-owner
     die de eerste providerregel met class .bron omzet naar zelfstandige items.
     Plaats de merkregel daarom bewust ná de providerregel en vóór Privacy, zodat
     merk-SEO en bronattributie onafhankelijk van elkaar blijven functioneren. */
  const footerMatches=[...bron.matchAll(/<footer>/g)];
  if(footerMatches.length!==1)throw new Error("SEO verwacht exact één footer voor de merkverwijzing; gevonden: "+footerMatches.length);
  const privacyAnker='<span class="bron"><a href="privacy.html">Privacy &amp; gegevens</a></span>';
  if(tel(bron,privacyAnker)!==1)throw new Error("SEO verwacht exact één privacyregel als veilig footeranker voor de merkverwijzing.");
  const brandLink=`${BRAND_LINK_MARKER}\n      <span class="bron"><a href="/over/"><b>${attr(SEO.siteName)}</b> · Over deze site</a></span>`;
  bron=bron.replace(privacyAnker,brandLink+"\n      "+privacyAnker);

  return bron;
}

module.exports={MARKER,BRAND_LINK_MARKER,SHARE_IMAGE,BRON_H1,MERK_H1,BRON_APP_TITLE,MERK_APP_TITLE,maakBrandStructuredData,pasSeoFoundationToe};
