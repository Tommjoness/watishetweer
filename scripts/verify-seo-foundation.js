"use strict";

const fs=require("fs");
const path=require("path");
const SEO=require("./seo-foundation.config.js");
const {MARKER,SHARE_IMAGE}=require("./seo-foundation.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPath=path.join(OUT,"index.html");
const robotsPath=path.join(OUT,"robots.txt");
const sitemapPath=path.join(OUT,"sitemap.xml");
const ownerPath=path.join(__dirname,"seo-foundation.js");
const oudeApplyPath=path.join(__dirname,"apply-seo-foundation.js");
const buildPath=path.join(ROOT,"build-weather.js");
for(const p of [htmlPath,robotsPath,sitemapPath,ownerPath,buildPath])if(!fs.existsSync(p))throw new Error("SEO-artifact of owner ontbreekt: "+path.basename(p));
if(fs.existsSync(oudeApplyPath))throw new Error("Late SEO-mutator bestaat nog; SEO-fundering hoort bij de base-build.");

const html=fs.readFileSync(htmlPath,"utf8");
const robots=fs.readFileSync(robotsPath,"utf8");
const sitemap=fs.readFileSync(sitemapPath,"utf8");
const owner=fs.readFileSync(ownerPath,"utf8");
const build=fs.readFileSync(buildPath,"utf8");
const tel=(tekst,zoek)=>tekst.split(zoek).length-1;

if(!build.includes('require("./scripts/seo-foundation.js")')||!build.includes("html=pasSeoFoundationToe(html);"))throw new Error("Base-build bezit de SEO-fundering niet aantoonbaar.");
if(!owner.includes('require("./seo-foundation.config.js")')||!owner.includes("function pasSeoFoundationToe(html)"))throw new Error("Pure SEO-owner gebruikt de canonieke SEO-configuratie niet aantoonbaar.");
for(const verboden of ["public/index.html","writeFileSync","vernieuwServiceworkerCache"]){
  if(owner.includes(verboden))throw new Error("Pure SEO-owner bevat nog late artifactmutatie-infrastructuur: "+verboden);
}

if(tel(html,MARKER)!==1)throw new Error("SEO-marker moet exact één keer aanwezig zijn.");
if(tel(html,`<link rel="canonical" href="${SEO.canonical}">`)!==1)throw new Error("Canonical ontbreekt of is dubbel.");
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
if(!Array.isArray(data)||data.length!==1)throw new Error("JSON-LD moet exact één WebSite-item in de top-level array bevatten.");
const website=data[0];
if(!website||website["@context"]!=="https://schema.org"||website["@type"]!=="WebSite"||website.name!==SEO.siteName||website.url!==SEO.canonical)throw new Error("WebSite structured data wijkt af van de SEO-configuratie.");

if(!/^User-agent: \*$/m.test(robots)||!/^Allow: \/$/m.test(robots))throw new Error("robots.txt staat algemene crawling niet expliciet toe.");
if(!robots.includes(`Sitemap: ${SEO.canonical}sitemap.xml`))throw new Error("robots.txt verwijst niet naar de canonieke sitemap.");
if(!sitemap.includes(`<loc>${SEO.canonical}</loc>`))throw new Error("Sitemap bevat de canonieke homepage niet.");
if((sitemap.match(/<loc>/g)||[]).length!==1)throw new Error("SEO-fundering publiceert voorlopig alleen de bewezen canonieke homepage in de sitemap.");
if(/\?lat=|\?lon=|www\.watishetweer\.nl/.test(sitemap))throw new Error("Sitemap mag geen gedeelde query-URLs of www-duplicaat bevatten.");

console.log("SEO-fundering geverifieerd: canonical, share-image/Twitter metadata, structured data, robots.txt en root-sitemap zijn coherent.");
