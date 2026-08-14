"use strict";

const fs=require("fs");
const path=require("path");
const SEO=require("./seo-foundation.config.js");
const {LOCATIES,POPULAIR,BASIS_URL,plaatsUrl,plaatsTitel,plaatsBeschrijving}=require("./seo-locations.config.js");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const ROOT_HTML=path.join(OUT,"index.html");
const MARKER_NAV="<!-- WEATHER NOW INDEXEERBARE PLAATSEN -->";
const MARKER_ROUTE="<!-- WEATHER NOW PLAATSROUTE -->";
const START_HAAK="(function(){\n  const p=new URLSearchParams(location.search);\n";

function escHtml(v){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function escXml(v){return escHtml(v).replace(/'/g,"&apos;");}
function tel(tekst,zoek){return String(tekst).split(zoek).length-1;}

function navHtml(){
  const links=POPULAIR.map(loc=>`<a href="/weer/${loc.slug}/">${escHtml(loc.naam)}</a>`).join("\n      ");
  return `${MARKER_NAV}\n<nav class="seo-plaatsnav" aria-label="Weer per plaats">\n  <div class="seo-plaatsnav-inner">\n    <div>\n      <div class="seo-plaatsnav-kop">Weer per plaats</div>\n      <p>Bekijk direct het actuele weer en de verwachting voor veelgekozen plaatsen.</p>\n    </div>\n    <div class="seo-plaatsnav-links">\n      ${links}\n      <a class="seo-plaatsnav-alles" href="/weer/">Alle plaatsen</a>\n    </div>\n  </div>\n</nav>`;
}

function voegPlaatsNavigatieToe(html){
  let bron=String(html||"");
  if(bron.includes(MARKER_NAV))return bron;
  if(tel(bron,"</style>")!==1||tel(bron,"</body>")!==1)throw new Error("Plaatsnavigatie verwacht exact één style- en body-einde.");
  const css=`\n/* ===== INDEXEERBARE PLAATSNAVIGATIE ===== */\n.seo-plaatsnav,.seo-route-context{max-width:min(1180px,100%);margin:18px auto 0;color:var(--ink-70)}\n.seo-plaatsnav{border-top:1px solid var(--rule);padding-top:18px}\n.seo-plaatsnav-inner{display:grid;grid-template-columns:minmax(180px,.8fr) minmax(0,2.2fr);gap:24px;align-items:start}\n.seo-plaatsnav-kop,.seo-route-context h2{font-family:var(--serif);font-size:18px;font-weight:400;color:var(--ink);margin:0}\n.seo-plaatsnav p,.seo-route-context p{font-size:13px;line-height:1.55;margin:4px 0 0;max-width:58ch}\n.seo-plaatsnav-links{display:flex;flex-wrap:wrap;gap:8px 14px}\n.seo-plaatsnav a{font-size:13px;color:var(--ink-70);text-decoration:none;border-bottom:1px solid transparent}\n.seo-plaatsnav a:hover,.seo-plaatsnav a:focus-visible{color:var(--ink);border-bottom-color:var(--ink)}\n.seo-plaatsnav-alles{font-weight:500}\n.seo-route-context{padding:18px 0 0;border-top:1px solid var(--rule)}\n.seo-route-context a{color:inherit}\n@media(max-width:700px){.seo-plaatsnav-inner{grid-template-columns:1fr;gap:12px}.seo-plaatsnav-links{gap:8px 12px}}\n/* ===== EINDE INDEXEERBARE PLAATSNAVIGATIE ===== */\n`;
  bron=bron.replace("</style>",css+"</style>");
  return bron.replace("</body>",navHtml()+"\n</body>");
}

function vervangMeta(html,loc){
  let bron=String(html||"");
  const canonical=plaatsUrl(loc),titel=plaatsTitel(loc),description=plaatsBeschrijving(loc);
  const vervangExact=(regex,waarde,label)=>{
    const matches=[...bron.matchAll(regex)];
    if(matches.length!==1)throw new Error(`${loc.slug}: ${label} verwacht exact één match, gevonden ${matches.length}.`);
    bron=bron.replace(matches[0][0],waarde);
  };
  vervangExact(/<title>[^<]*<\/title>/g,`<title>${escHtml(titel)}</title>`,"title");
  vervangExact(/<meta name="description" content="[^"]*">/g,`<meta name="description" content="${escHtml(description)}">`,"description");
  vervangExact(/<link rel="canonical" href="[^"]+">/g,`<link rel="canonical" href="${canonical}">`,"canonical");
  vervangExact(/<meta property="og:title" content="[^"]*">/g,`<meta property="og:title" content="${escHtml(titel)}">`,"og:title");
  vervangExact(/<meta property="og:description" content="[^"]*">/g,`<meta property="og:description" content="${escHtml(description)}">`,"og:description");
  vervangExact(/<meta property="og:url" content="[^"]+">/g,`<meta property="og:url" content="${canonical}">`,"og:url");

  const ld=[...bron.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if(ld.length!==1)throw new Error(`${loc.slug}: verwacht exact één JSON-LD-blok.`);
  const structured=[
    {"@context":"https://schema.org","@type":"WebSite",name:SEO.siteName,url:SEO.canonical},
    {"@context":"https://schema.org","@type":"WebPage",name:titel,url:canonical,isPartOf:{"@type":"WebSite",name:SEO.siteName,url:SEO.canonical},about:{"@type":"Place",name:loc.naam,address:{"@type":"PostalAddress",addressRegion:loc.provincie,addressCountry:"NL"}}}
  ];
  bron=bron.replace(ld[0][0],`<script type="application/ld+json">${JSON.stringify(structured)}</script>`);
  return bron;
}

function voegBaseToe(html,slug){
  let bron=String(html||"");
  if(bron.includes('<base href="/">'))return bron;
  const re=/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/g;
  const matches=[...bron.matchAll(re)];
  if(matches.length!==1)throw new Error(`${slug}: CSP-meta ontbreekt of is dubbel.`);
  const csp=matches[0][1];
  if(!csp.includes("base-uri 'none'"))throw new Error(`${slug}: verwachte base-uri 'none' ontbreekt.`);
  const nieuw=`<meta http-equiv="Content-Security-Policy" content="${csp.replace("base-uri 'none'","base-uri 'self'")}">\n<base href="/">`;
  return bron.replace(matches[0][0],nieuw);
}

function voegRouteToe(html,loc){
  let bron=String(html||"");
  if(tel(bron,START_HAAK)!==1)throw new Error(`${loc.slug}: start-haak ontbreekt of is dubbel.`);
  const route={slug:loc.slug,name:loc.naam,lat:loc.lat,lon:loc.lon,country:loc.land};
  const bootstrap=`${MARKER_ROUTE}\n<script>window.__WEATHERNOW_ROUTE_LOCATION__=Object.freeze(${JSON.stringify(route)});</script>`;
  if(tel(bron,"</head>")!==1)throw new Error(`${loc.slug}: head-einde ontbreekt of is dubbel.`);
  bron=bron.replace("</head>",bootstrap+"\n</head>");
  const routeStart=`(function(){\n  const route=window.__WEATHERNOW_ROUTE_LOCATION__;\n  if(route&&Number.isFinite(route.lat)&&Number.isFinite(route.lon)&&route.name){\n    q.value=route.name;\n    load(route.lat,route.lon,route.name,false,false,normLand(route.country));\n    return;\n  }\n  const p=new URLSearchParams(location.search);\n`;
  return bron.replace(START_HAAK,routeStart);
}

function voegRouteContextToe(html,loc){
  const blok=`<section class="seo-route-context" aria-labelledby="seo-route-title">\n  <h2 id="seo-route-title">Weer in ${escHtml(loc.naam)}</h2>\n  <p>Bekijk het actuele weer in ${escHtml(loc.naam)}, ${escHtml(loc.provincie)}, met neerslag voor de komende uren en de 7-daagse verwachting. Alle tijden volgen de lokale tijd van de gekozen plaats.</p>\n</section>`;
  if(tel(html,"</body>")!==1)throw new Error(`${loc.slug}: body-einde ontbreekt of is dubbel.`);
  return html.replace(navHtml(),blok+"\n"+navHtml());
}

function maakPlaatsPagina(rootHtml,loc){
  let html=vervangMeta(rootHtml,loc);
  html=voegBaseToe(html,loc.slug);
  html=voegRouteToe(html,loc);
  html=voegRouteContextToe(html,loc);
  return html;
}

function maakPlaatsIndex(){
  const links=LOCATIES.map(loc=>`<li><a href="/weer/${loc.slug}/">${escHtml(loc.naam)}</a><span>${escHtml(loc.provincie)}</span></li>`).join("\n");
  const canonical=`${BASIS_URL}/weer/`;
  const titel="Weer per plaats in Nederland | Wat is het weer?";
  const description="Bekijk het actuele weer en de 7-daagse verwachting voor grote plaatsen in Nederland. Kies een plaats voor neerslag, lokale tijden, luchtkwaliteit en nachtzicht.";
  const structured=JSON.stringify([
    {"@context":"https://schema.org","@type":"WebSite",name:SEO.siteName,url:SEO.canonical},
    {"@context":"https://schema.org","@type":"CollectionPage",name:titel,url:canonical,isPartOf:{"@type":"WebSite",name:SEO.siteName,url:SEO.canonical}}
  ]);
  return `<!doctype html>\n<html lang="nl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${escHtml(titel)}</title>\n<meta name="description" content="${escHtml(description)}">\n<meta name="robots" content="index,follow,max-image-preview:large">\n<link rel="canonical" href="${canonical}">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="${escHtml(SEO.siteName)}">\n<meta property="og:title" content="${escHtml(titel)}">\n<meta property="og:description" content="${escHtml(description)}">\n<meta property="og:url" content="${canonical}">\n<meta name="twitter:card" content="summary">\n<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'none'; frame-ancestors 'none'">\n<base href="/">\n<script type="application/ld+json">${structured}</script>\n<style>\n@font-face{font-family:'Bodoni Moda';src:url('/bodoni-moda-latin-400-normal.woff2') format('woff2');font-weight:400;font-display:swap}\n@font-face{font-family:'Instrument Sans';src:url('/instrument-sans-latin-400-normal.woff2') format('woff2');font-weight:400;font-display:swap}\n:root{--paper:#F4F5F3;--sheet:#fff;--ink:#12211C;--muted:#65716C;--rule:#DCE1DE;--serif:'Bodoni Moda',Georgia,serif;--sans:'Instrument Sans',system-ui,sans-serif}\n*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);padding:32px 22px;line-height:1.55}.wrap{max-width:900px;margin:auto;background:var(--sheet);border:1px solid var(--rule);padding:40px 48px}a{color:inherit}.brand{font-family:var(--serif);font-size:15px;color:var(--muted);text-decoration:none}h1{font-family:var(--serif);font-size:42px;font-weight:400;line-height:1.08;margin:28px 0 8px}p{color:var(--muted);max-width:62ch}.plaatsen{list-style:none;padding:0;margin:30px 0 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--rule)}.plaatsen li{padding:13px 10px 13px 0;border-bottom:1px solid var(--rule);display:flex;flex-direction:column}.plaatsen a{text-decoration:none;font-size:15px}.plaatsen a:hover{text-decoration:underline}.plaatsen span{font-size:12px;color:var(--muted)}.terug{display:inline-block;margin-top:28px;font-size:13px}@media(max-width:700px){body{padding:14px}.wrap{padding:28px 22px}.plaatsen{grid-template-columns:repeat(2,minmax(0,1fr))}h1{font-size:34px}}\n</style>\n</head>\n<body>\n<main class="wrap">\n<a class="brand" href="/">Wat is het weer?</a>\n<h1>Weer per plaats</h1>\n<p>Kies een plaats voor het actuele weer, neerslag in de komende uren en de 7-daagse verwachting. De plaatspagina's gebruiken dezelfde WeatherNow-weerkern als de homepage.</p>\n<ul class="plaatsen">${links}</ul>\n<a class="terug" href="/">← Terug naar het actuele weer</a>\n</main>\n</body>\n</html>\n`;
}

function maakSitemap(){
  const urls=[`${BASIS_URL}/`,`${BASIS_URL}/weer/`,...LOCATIES.map(plaatsUrl)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url=>`  <url>\n    <loc>${escXml(url)}</loc>\n  </url>`).join("\n")}\n</urlset>\n`;
}

function main(){
  if(!fs.existsSync(ROOT_HTML))throw new Error("public/index.html ontbreekt; voer eerst de basisbuild en SEO-fundering uit.");
  let root=fs.readFileSync(ROOT_HTML,"utf8");
  root=voegPlaatsNavigatieToe(root);
  fs.writeFileSync(ROOT_HTML,root,"utf8");

  const weerDir=path.join(OUT,"weer");
  fs.rmSync(weerDir,{recursive:true,force:true});
  fs.mkdirSync(weerDir,{recursive:true});
  fs.writeFileSync(path.join(weerDir,"index.html"),maakPlaatsIndex(),"utf8");
  for(const loc of LOCATIES){
    const dir=path.join(weerDir,loc.slug);
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,"index.html"),maakPlaatsPagina(root,loc),"utf8");
  }
  fs.writeFileSync(path.join(OUT,"sitemap.xml"),maakSitemap(),"utf8");
  const versie=vernieuwServiceworkerCache(OUT,"seo-location-pages");
  console.log(`SEO-plaatsarchitectuur gegenereerd: ${LOCATIES.length} plaatsroutes + /weer/ + crawlbare rootlinks; cache ${versie}.`);
}

if(require.main===module)main();
module.exports={MARKER_NAV,MARKER_ROUTE,voegPlaatsNavigatieToe,maakPlaatsPagina,maakPlaatsIndex,maakSitemap};
