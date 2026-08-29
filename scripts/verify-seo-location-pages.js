"use strict";

const fs=require("fs");
const path=require("path");
const SEO=require("./seo-foundation.config.js");
const {LOCATIES,POPULAIR,BASIS_URL,plaatsUrl,plaatsTitel,plaatsBeschrijving}=require("./seo-locations.config.js");
const {MARKER_NAV,MARKER_ROUTE,gerelateerdePlaatsen}=require("./generate-seo-location-pages.js");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const tel=(tekst,zoek)=>String(tekst).split(zoek).length-1;
const rootPath=path.join(OUT,"index.html"),hubPath=path.join(OUT,"weer","index.html"),sitemapPath=path.join(OUT,"sitemap.xml");
for(const p of [rootPath,hubPath,sitemapPath])if(!fs.existsSync(p))throw new Error("SEO-plaatsartifact ontbreekt: "+p);

const root=fs.readFileSync(rootPath,"utf8");
if(tel(root,'<div class="sheet" data-nosnippet>')!==1)throw new Error("Homepage moet de dynamische weerinterface exact één keer uit zoeksnippets houden.");
if(tel(root,MARKER_NAV)!==1)throw new Error("Homepage moet exact één crawlbare plaatsnavigatie bevatten.");
if(!root.includes('href="/weer/"'))throw new Error("Homepage linkt niet naar de volledige plaatsindex.");
if(!root.includes('href="/over/"><b>watishetweer.nl</b> · Over deze site</a>'))throw new Error("Homepage mist de crawlbare vaste merkverwijzing naar de Over-pagina.");
for(const loc of POPULAIR){
  if(tel(root,`href="/weer/${loc.slug}/"`)!==1)throw new Error(`Homepage moet populaire plaats ${loc.slug} exact één keer linken.`);
}

const hub=fs.readFileSync(hubPath,"utf8");
if(!hub.includes(`<link rel="canonical" href="${BASIS_URL}/weer/">`))throw new Error("Plaatsindex mist eigen canonical.");
if(!hub.includes("<h1>Weer per plaats</h1>"))throw new Error("Plaatsindex mist zichtbare hoofdkop.");
if(!hub.includes(`property="og:site_name" content="${SEO.siteName}"`))throw new Error("Plaatsindex gebruikt niet de vaste technische sitenaam.");
for(const loc of LOCATIES){if(tel(hub,`href="/weer/${loc.slug}/"`)!==1)throw new Error(`Plaatsindex mist unieke crawlbare link naar ${loc.slug}.`);}

const sitemap=fs.readFileSync(sitemapPath,"utf8");
const locs=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
const verwacht=[`${BASIS_URL}/`,`${BASIS_URL}/weer/`,...LOCATIES.map(plaatsUrl)];
if(locs.length!==verwacht.length)throw new Error(`Sitemap bevat ${locs.length} URLs; verwacht ${verwacht.length}.`);
if(new Set(locs).size!==locs.length)throw new Error("Sitemap bevat dubbele URLs.");
if(JSON.stringify(locs)!==JSON.stringify(verwacht))throw new Error("Sitemapvolgorde/inhoud wijkt af van de bewezen locatieconfig.");
if(/\?lat=|\?lon=|www\.watishetweer\.nl/.test(sitemap))throw new Error("Sitemap bevat query- of www-duplicaten.");

for(const loc of LOCATIES){
  const p=path.join(OUT,"weer",loc.slug,"index.html");
  if(!fs.existsSync(p))throw new Error(`${loc.slug}: gegenereerde route ontbreekt.`);
  const html=fs.readFileSync(p,"utf8"),canonical=plaatsUrl(loc),titel=plaatsTitel(loc),desc=plaatsBeschrijving(loc);
  if(tel(html,'<div class="sheet" data-nosnippet>')!==1)throw new Error(`${loc.slug}: dynamische weerinterface mist data-nosnippet.`);
  if(tel(html,MARKER_ROUTE)!==1)throw new Error(`${loc.slug}: route-marker ontbreekt of is dubbel.`);
  if(tel(html,MARKER_NAV)!==1)throw new Error(`${loc.slug}: plaatsnavigatie ontbreekt of is dubbel.`);
  if(tel(html,`<link rel="canonical" href="${canonical}">`)!==1)throw new Error(`${loc.slug}: canonical ontbreekt of is dubbel.`);
  if(!html.includes(`<title>${titel}</title>`))throw new Error(`${loc.slug}: unieke title ontbreekt.`);
  if(!html.includes(`property="og:site_name" content="${SEO.siteName}"`))throw new Error(`${loc.slug}: og:site_name wijkt af van de vaste merknaam.`);
  const escaped=desc.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  if(!html.includes(`name="description" content="${escaped}"`))throw new Error(`${loc.slug}: unieke description ontbreekt.`);
  if(tel(html,'<base href="/">')!==1)throw new Error(`${loc.slug}: root-base ontbreekt of is dubbel.`);
  if(!html.includes("base-uri 'self'" )||html.includes("base-uri 'none'"))throw new Error(`${loc.slug}: CSP staat root-base niet veilig toe.`);
  if(!html.includes(`\"slug\":\"${loc.slug}\"`)||!html.includes(`\"name\":\"${loc.naam.replace(/"/g,'\\"')}\"`))throw new Error(`${loc.slug}: routebootstrap bevat niet de bewezen plaatsidentiteit.`);
  if(!html.includes("load(route.lat,route.lon,route.name,false,false,normLand(route.country));"))throw new Error(`${loc.slug}: runtime start niet via de bestaande load-keten.`);
  if(!html.includes(`<h2 id="seo-route-title">Weer in ${loc.naam}</h2>`))throw new Error(`${loc.slug}: zichtbare prerendercontext ontbreekt.`);
  if(/<link rel="canonical" href="https:\/\/watishetweer\.nl\/">/.test(html))throw new Error(`${loc.slug}: homepage-canonical lekt naar plaatsroute.`);

  const breadcrumb=/<nav class="seo-breadcrumb" aria-label="Broodkruimelnavigatie">([\s\S]*?)<\/nav>/.exec(html);
  if(!breadcrumb)throw new Error(`${loc.slug}: zichtbare breadcrumb ontbreekt.`);
  if(!breadcrumb[1].includes('href="/"')||!breadcrumb[1].includes(`>${SEO.siteName}</a>`)||!breadcrumb[1].includes('href="/weer/"')||!breadcrumb[1].includes(`aria-current="page">${loc.naam}</span>`))throw new Error(`${loc.slug}: zichtbare breadcrumb wijkt af van merk > plaatsindex > plaats.`);

  const nearby=/<div class="seo-route-nearby-links">([\s\S]*?)<\/div>/.exec(html);
  if(!nearby)throw new Error(`${loc.slug}: blok met nabijgelegen plaatsen ontbreekt.`);
  const nearbyLinks=[...nearby[1].matchAll(/href="(\/weer\/[^"?#]+\/)"/g)].map(m=>m[1]);
  const expectedNearby=gerelateerdePlaatsen(loc).map(x=>`/weer/${x.slug}/`);
  if(JSON.stringify(nearbyLinks)!==JSON.stringify(expectedNearby))throw new Error(`${loc.slug}: nabijgelegen links wijken af: ${nearbyLinks.join(", ")} versus ${expectedNearby.join(", ")}.`);
  if(nearbyLinks.includes(`/weer/${loc.slug}/`))throw new Error(`${loc.slug}: nabijgelegen links mogen niet naar zichzelf verwijzen.`);

  const ld=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if(ld.length!==1)throw new Error(`${loc.slug}: verwacht exact één JSON-LD-blok.`);
  let data;try{data=JSON.parse(ld[0][1]);}catch(e){throw new Error(`${loc.slug}: ongeldige JSON-LD: ${e.message}`);}
  if(!Array.isArray(data)||data.length!==3||data[0]?.["@type"]!=="WebSite"||data[0]?.name!==SEO.siteName||data[0]?.url!==SEO.canonical||data[1]?.["@type"]!=="WebPage"||data[1]?.url!==canonical)throw new Error(`${loc.slug}: WebSite/WebPage structured data wijkt af van de vaste merk- of routeconfiguratie.`);
  const crumbs=data[2];
  const items=crumbs?.itemListElement;
  if(crumbs?.["@type"]!=="BreadcrumbList"||!Array.isArray(items)||items.length!==3)throw new Error(`${loc.slug}: BreadcrumbList structured data ontbreekt of heeft verkeerde lengte.`);
  const verwachteCrumbs=[
    {positie:1,naam:SEO.siteName,url:`${BASIS_URL}/`},
    {positie:2,naam:"Weer per plaats",url:`${BASIS_URL}/weer/`},
    {positie:3,naam:loc.naam,url:canonical}
  ];
  for(let i=0;i<verwachteCrumbs.length;i++){
    const verwachtItem=verwachteCrumbs[i],item=items[i];
    if(item?.["@type"]!=="ListItem"||item.position!==verwachtItem.positie||item.name!==verwachtItem.naam||item.item!==verwachtItem.url)throw new Error(`${loc.slug}: breadcrumb-item ${i+1} wijkt af van de zichtbare routehiërarchie.`);
  }
}

const cache=verifieerServiceworkerCache(OUT,"seo-location-pages-verifier");
console.log(`SEO-plaatsarchitectuur geverifieerd: ${LOCATIES.length} indexeerbare routes met vaste merknaam, hub, breadcrumbs, vier nabijgelegen links per route, sitemap, routecontext en cache ${cache}.`);
