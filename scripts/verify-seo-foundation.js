"use strict";

const fs=require("fs");
const path=require("path");
const SEO=require("./seo-foundation.config.js");
const {MARKER,BRAND_LINK_MARKER,SHARE_IMAGE,BRON_H1,MERK_H1,BRON_APP_TITLE,MERK_APP_TITLE,maakBrandStructuredData}=require("./seo-foundation.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPath=path.join(OUT,"index.html");
const aboutPath=path.join(OUT,"over","index.html");
const privacyPath=path.join(OUT,"privacy.html");
const robotsPath=path.join(OUT,"robots.txt");
const sitemapPath=path.join(OUT,"sitemap.xml");
const ownerPath=path.join(__dirname,"seo-foundation.js");
const oudeApplyPath=path.join(__dirname,"apply-seo-foundation.js");
const buildPath=path.join(ROOT,"build-weather.js");
for(const p of [htmlPath,aboutPath,privacyPath,robotsPath,sitemapPath,ownerPath,buildPath])if(!fs.existsSync(p))throw new Error("SEO-artifact of owner ontbreekt: "+path.basename(p));
if(fs.existsSync(oudeApplyPath))throw new Error("Late SEO-mutator bestaat nog; SEO-fundering hoort bij de base-build.");

const html=fs.readFileSync(htmlPath,"utf8");
const about=fs.readFileSync(aboutPath,"utf8");
const privacy=fs.readFileSync(privacyPath,"utf8");
const robots=fs.readFileSync(robotsPath,"utf8");
const sitemap=fs.readFileSync(sitemapPath,"utf8");
const owner=fs.readFileSync(ownerPath,"utf8");
const build=fs.readFileSync(buildPath,"utf8");
const tel=(tekst,zoek)=>tekst.split(zoek).length-1;

if(!build.includes('require("./scripts/seo-foundation.js")')||!build.includes("html=pasSeoFoundationToe(html);"))throw new Error("Base-build bezit de SEO-fundering niet aantoonbaar.");
if(!owner.includes('require("./seo-foundation.config.js")')||!owner.includes("function pasSeoFoundationToe(html)")||!owner.includes("function maakBrandStructuredData()"))throw new Error("Pure SEO-owner gebruikt de canonieke merkconfiguratie niet aantoonbaar.");
for(const verboden of ["public/index.html","writeFileSync","vernieuwServiceworkerCache"]){
  if(owner.includes(verboden))throw new Error("Pure SEO-owner bevat nog late artifactmutatie-infrastructuur: "+verboden);
}

if(SEO.siteName!=="watishetweer.nl")throw new Error("De vaste merk- en sitenaam moet watishetweer.nl zijn.");
if(Object.prototype.hasOwnProperty.call(SEO,"productName"))throw new Error("De generieke vraag mag niet meer als tweede officiële product-/merknaam worden geconfigureerd.");
if(JSON.stringify(SEO.alternateNames)!==JSON.stringify(["watishetweer"]))throw new Error("Alleen de schrijfwijze zonder .nl mag als alternatieve merknaam worden gepubliceerd.");
if(tel(html,MARKER)!==1)throw new Error("SEO-marker moet exact één keer aanwezig zijn.");
if(tel(html,BRAND_LINK_MARKER)!==1)throw new Error("Zichtbare merkverwijzing moet exact één keer aanwezig zijn.");
if(!html.includes(`<a href="/over/"><b>${SEO.siteName}</b> · Over deze site</a>`))throw new Error("Homepage koppelt de vaste merknaam niet zichtbaar aan de Over-pagina.");
if(tel(html,MERK_H1)!==1||html.includes(BRON_H1))throw new Error("Homepage-H1 publiceert niet eenduidig de vaste merknaam.");
if(tel(html,MERK_APP_TITLE)!==1||html.includes(BRON_APP_TITLE))throw new Error("Apple-webappmetadata publiceert niet eenduidig de vaste merknaam.");
if(tel(html,`<link rel="canonical" href="${SEO.canonical}">`)!==1)throw new Error("Canonical ontbreekt of is dubbel.");
if(tel(html,'<link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png">')!==1)throw new Error("Expliciet 192px favicon ontbreekt of is dubbel.");
if(tel(html,`<meta name="google-site-verification" content="${SEO.googleVerification}">`)!==1)throw new Error("Google Search Console-verificatiemeta ontbreekt of is dubbel.");
if(tel(html,`<meta name="msvalidate.01" content="${SEO.bingVerification}">`)!==1)throw new Error("Bing-verificatiemeta ontbreekt of is dubbel.");
if(!html.includes(`<title>${SEO.title}</title>`))throw new Error("SEO-title ontbreekt in definitief artifact.");
if(!html.includes(`name="description" content="${SEO.description.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}"`))throw new Error("SEO-description ontbreekt in definitief artifact.");
if(tel(html,`property="og:url" content="${SEO.canonical}"`)!==1)throw new Error("og:url ontbreekt of is dubbel.");
if(!html.includes(`property="og:site_name" content="${SEO.siteName}"`))throw new Error("og:site_name ontbreekt.");
for(const tag of [
  `<meta property="og:image" content="${SHARE_IMAGE}">`,
  '<meta property="og:image:width" content="512">',
  '<meta property="og:image:height" content="512">',
  `<meta property="og:image:alt" content="${SEO.siteName}">`,
  '<meta name="twitter:card" content="summary">',
  `<meta name="twitter:title" content="${SEO.title}">`,
  `<meta name="twitter:description" content="${SEO.description.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}">`,
  `<meta name="twitter:image" content="${SHARE_IMAGE}">`,
  `<meta name="twitter:image:alt" content="${SEO.siteName}">`
])if(!html.includes(tag))throw new Error("Share-metadata ontbreekt: "+tag);

const ld=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
if(ld.length!==1)throw new Error("Definitief artifact moet exact één JSON-LD-blok bevatten; gevonden: "+ld.length);
let data;
try{data=JSON.parse(ld[0][1]);}catch(e){throw new Error("JSON-LD is ongeldig JSON: "+e.message);}
const verwachtMerk=maakBrandStructuredData();
if(JSON.stringify(data)!==JSON.stringify(verwachtMerk))throw new Error("Homepage Organization/WebSite graph wijkt af van de canonieke merkconfiguratie.");
const organisatie=data[0],website=data[1];
if(organisatie["@type"]!=="Organization"||organisatie["@id"]!==SEO.organizationId||organisatie.name!==SEO.siteName||organisatie.url!==SEO.canonical)throw new Error("Organization structured data wijkt af.");
if(organisatie.sameAs!==undefined)throw new Error("Organization mag geen onbewezen sameAs-profielen publiceren.");
if(JSON.stringify(organisatie.alternateName)!==JSON.stringify(SEO.alternateNames))throw new Error("Organization alternateName wijkt af van de vaste merkvariant.");
if(organisatie.logo?.url!==SEO.logo||organisatie.logo?.width!==512||organisatie.logo?.height!==512)throw new Error("Organization-logo wijkt af van de vaste 512px merkasset.");
if(website["@type"]!=="WebSite"||website["@id"]!==SEO.websiteId||website.name!==SEO.siteName||website.url!==SEO.canonical||website.publisher?.["@id"]!==SEO.organizationId)throw new Error("WebSite structured data wijkt af van de merkconfiguratie.");
if(JSON.stringify(website.alternateName)!==JSON.stringify(SEO.alternateNames))throw new Error("WebSite alternateName mist de vaste merkvariant.");

if(!about.includes("<title>Over watishetweer.nl</title>")||!about.includes(`<link rel="canonical" href="${SEO.aboutUrl}">`)||!about.includes("<h1>Over watishetweer.nl</h1>"))throw new Error("Over-pagina mist title, canonical of zichtbare merk-H1.");
if(!about.includes('<link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png">'))throw new Error("Over-pagina mist expliciet favicon.");
if(!about.includes("watishetweer.nl</span> is de vaste merk- en sitenaam")||!about.includes('href="/privacy.html"'))throw new Error("Over-pagina mist eenduidige merkduiding of privacyverbinding.");
if(about.includes("Productnaam in de interface"))throw new Error("Over-pagina publiceert de generieke vraag nog als tweede officiële productnaam.");
const aboutLd=[...about.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
if(aboutLd.length!==1)throw new Error("Over-pagina moet exact één JSON-LD-blok bevatten.");
let aboutData;try{aboutData=JSON.parse(aboutLd[0][1]);}catch(e){throw new Error("Over-pagina bevat ongeldige JSON-LD: "+e.message);}
if(!Array.isArray(aboutData)||aboutData.length!==3||JSON.stringify(aboutData.slice(0,2))!==JSON.stringify(verwachtMerk))throw new Error("Over-pagina hergebruikt de canonieke Organization/WebSite-identiteit niet exact.");
if(aboutData[2]?.["@type"]!=="AboutPage"||aboutData[2]?.url!==SEO.aboutUrl||aboutData[2]?.isPartOf?.["@id"]!==SEO.websiteId||aboutData[2]?.about?.["@id"]!==SEO.organizationId)throw new Error("AboutPage structured data koppelt niet correct aan website en organisatie.");

if(!privacy.includes("<title>Privacy & gegevens | watishetweer.nl</title>")||!privacy.includes('<link rel="canonical" href="https://watishetweer.nl/privacy.html">')||!privacy.includes('href="/over/">Over watishetweer.nl</a>'))throw new Error("Privacy-pagina is niet consequent aan de merkidentiteit gekoppeld.");

if(!/^User-agent: \*$/m.test(robots)||!/^Allow: \/$/m.test(robots))throw new Error("robots.txt staat algemene crawling niet expliciet toe.");
if(!robots.includes(`Sitemap: ${SEO.canonical}sitemap.xml`))throw new Error("robots.txt verwijst niet naar de canonieke sitemap.");
if(!sitemap.includes(`<loc>${SEO.canonical}</loc>`))throw new Error("Sitemap bevat de canonieke homepage niet.");
if((sitemap.match(/<loc>/g)||[]).length!==1)throw new Error("SEO-fundering publiceert vóór de plaatsgenerator alleen de bewezen canonieke homepage in de sitemap.");
if(/\?lat=|\?lon=|www\.watishetweer\.nl/.test(sitemap))throw new Error("Sitemap mag geen gedeelde query-URLs of www-duplicaat bevatten.");

console.log("SEO-fundering geverifieerd: één vaste merknaam, Organization/WebSite graph, Over-pagina, favicon, canonical, share-metadata, robots.txt en root-sitemap zijn coherent.");
