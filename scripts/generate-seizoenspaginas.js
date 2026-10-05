"use strict";

/* Bouwt de seizoenspagina's (zie seizoenspagina.config.js) als losse
   subpagina's in de stijl van /over/ en zet ze in de sitemap. De statische
   HTML bevat de toestand op de builddatum; de runtime werkt jaar, aftelling en
   verwachting bij op de dag van het bezoek. */

const fs=require("fs");
const path=require("path");
const SEO=require("./seo-foundation.config.js");
const {SHARE_IMAGE}=require("./seo-foundation.js");
const {SEIZOENSPAGINAS,seizoenUrl}=require("./seizoenspagina.config.js");
const runtime=require("./seizoenspagina-runtime.js");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const RUNTIME_BRON=fs.readFileSync(path.join(__dirname,"seizoenspagina-runtime.js"),"utf8");

function esc(v){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function jsonInHtml(v){return JSON.stringify(v).replace(/</g,"\\u003c");}

/* Hetzelfde themacontract als /over/ en /privacy.html. */
const THEMA_SCRIPT=`<script>
(()=>{try{
  const lees=(opslag,sleutel)=>{try{const raw=opslag.getItem(sleutel);return raw==null?null:JSON.parse(raw);}catch(e){return null;}};
  const sessie=lees(sessionStorage,"weerbriefing.thema.sessie"),opgeslagen=lees(localStorage,"weerbriefing.thema");
  const keuze=["auto","licht","donker"].includes(sessie)?sessie:["licht","donker"].includes(opgeslagen)?opgeslagen:"auto";
  const systeem=typeof matchMedia==="function"?matchMedia("(prefers-color-scheme: dark)"):null;
  const pas=()=>{
    const donker=keuze==="donker"||(keuze==="auto"&&!!(systeem&&systeem.matches));
    if(keuze!=="auto"||donker)document.documentElement.setAttribute("data-thema",donker?"donker":"licht");
    else document.documentElement.removeAttribute("data-thema");
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content",donker?"#0B120F":"#F4F5F3");
  };
  pas();
  if(keuze==="auto"&&systeem){if(typeof systeem.addEventListener==="function")systeem.addEventListener("change",pas);else if(typeof systeem.addListener==="function")systeem.addListener(pas);}
}catch(e){}})();
</script>`;

const STIJL=`<style>
@font-face{font-family:"Instrument Sans";src:url(/instrument-sans-latin-400-normal.woff2) format("woff2");font-weight:400;font-display:swap}@font-face{font-family:"Instrument Sans";src:url(/instrument-sans-latin-500-normal.woff2) format("woff2");font-weight:500 700;font-display:swap}@font-face{font-family:"Bodoni Moda";src:url(/bodoni-moda-latin-400-normal.woff2) format("woff2");font-weight:400;font-display:swap}
:root{--paper:#f4f5f3;--sheet:#fff;--ink:#12211c;--ink-70:#41514b;--muted:#65716c;--rule:#dce1de}
html[data-thema="donker"]{--paper:#0a0a0a;--sheet:#141414;--ink:#ededed;--ink-70:#b8b8b8;--muted:#999;--rule:#2a2a2a}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 "Instrument Sans",system-ui,-apple-system,sans-serif;padding:32px 20px}.kaart{max-width:760px;margin:auto;background:var(--sheet);border:1px solid var(--rule);padding:32px}h1{font:400 36px/1.15 "Bodoni Moda",Georgia,serif;margin:0 0 18px}h2{font-size:17px;margin:30px 0 8px}p{margin:10px 0;color:var(--ink-70)}a{color:inherit}.klein{color:var(--muted);font-size:14px}
.seizoen-status{margin:22px 0 0;padding:18px 0 4px;border-top:1px solid var(--rule)}
.seizoen-aftellen{font:400 24px/1.25 "Bodoni Moda",Georgia,serif;color:var(--ink);margin:0 0 6px}
.seizoen-samenvatting{color:var(--ink);font-weight:500}
.seizoen-dag{margin:22px 0 0}
.seizoen-dag h3{font-size:15px;font-weight:500;margin:0 0 6px;color:var(--ink)}
.seizoen-dag h3 span{font-weight:400;color:var(--muted);white-space:nowrap}
.seizoen-dag .sub{color:var(--muted)}
.seizoen-dag table{width:100%;border-collapse:collapse;font-size:15px}
.seizoen-dag th,.seizoen-dag td{text-align:left;padding:9px 10px 9px 0;border-bottom:1px solid var(--rule);vertical-align:top}
.seizoen-dag thead th{font-size:12px;font-weight:500;color:var(--muted);padding-top:0}
.seizoen-dag tbody th{font-weight:500;color:var(--ink)}
.seizoen-dag td{color:var(--ink-70)}
.seizoen-dag .temp{white-space:nowrap;text-align:right;padding-right:0;font-variant-numeric:tabular-nums}
.seizoen-dag thead th:last-child{text-align:right;padding-right:0;white-space:nowrap}
.seizoen-dag .officieel{display:block;font-size:12px;font-weight:400;color:var(--muted)}
.seizoen-dag a{text-decoration:none;border-bottom:1px solid var(--rule)}
.seizoen-dag a:hover,.seizoen-dag a:focus-visible{border-bottom-color:var(--ink)}
@media(max-width:600px){body{padding:14px}.kaart{padding:26px 22px}h1{font-size:32px}.seizoen-dag table{font-size:14px}.seizoen-dag .sep{display:none}.seizoen-dag .sub{display:block;font-size:13px}}
</style>`;

function pagina(cfg,buildDag){
  const t=runtime.toestand(buildDag,cfg);
  const canonical=seizoenUrl(cfg);
  const titel=runtime.vul(cfg.titel,{jaar:t.jaar});
  const description=runtime.vul(cfg.beschrijving,{jaar:t.jaar,datum:runtime.datumTekst(t.vanaf,false)});
  const structured=[
    {"@context":"https://schema.org","@type":"WebSite",name:SEO.siteName,url:SEO.canonical},
    {"@context":"https://schema.org","@type":"WebPage",name:titel,url:canonical,isPartOf:{"@type":"WebSite",name:SEO.siteName,url:SEO.canonical}}
  ];
  const {slug,beschrijving,intro,uitleg:_uitleg,...runtimeCfg}=cfg;
  const uitleg=cfg.uitleg.alineas.map(a=>`<p>${esc(a)}</p>`).join("\n");
  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)} | watishetweer.nl</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SEO.siteName)}">
<meta property="og:title" content="${esc(titel)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SHARE_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F4F5F3">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.open-meteo.com; base-uri 'none'; form-action 'none'">
<script type="application/ld+json">${jsonInHtml(structured)}</script>
${THEMA_SCRIPT}
${STIJL}
</head>
<body><main class="kaart">
<p><a href="/">← Terug naar het weer</a></p>
<h1 id="seizoen-kop">${esc(cfg.naam)} ${t.jaar}</h1>
<p>${esc(cfg.intro)}</p>
<section class="seizoen-status" aria-labelledby="seizoen-kop" aria-live="polite">
<p class="seizoen-aftellen" id="seizoen-aftellen" hidden></p>
<p id="seizoen-melding"${runtime.meldingTekst(t,cfg)?"":" hidden"}>${esc(runtime.meldingTekst(t,cfg))}</p>
<div id="seizoen-verwachting"></div>
</section>
<h2>${esc(cfg.uitleg.kop)}</h2>
${uitleg}
${cfg.uitleg.bron?`<p class="klein">Bron: <a href="${esc(cfg.uitleg.bron.url)}" rel="noopener">${esc(cfg.uitleg.bron.naam)}</a></p>\n`:""}<h2>Het weer voor jouw plaats</h2>
<p>Bekijk het actuele weer en de 7-daagse verwachting voor <a href="/">jouw plaats</a>, of kies een plaats bij <a href="/weer/">Weer per plaats</a>.</p>
</main>
<script type="application/json" id="seizoen-config">${jsonInHtml(runtimeCfg)}</script>
<script>
${RUNTIME_BRON}
</script>
</body>
</html>
`;
}

function voegToeAanSitemap(){
  const pad=path.join(OUT,"sitemap.xml");
  let xml=fs.readFileSync(pad,"utf8");
  for(const cfg of SEIZOENSPAGINAS){
    const loc=`<loc>${seizoenUrl(cfg)}</loc>`;
    if(xml.includes(loc))throw new Error(`Sitemap bevat ${seizoenUrl(cfg)} al.`);
    if(xml.split("</urlset>").length!==2)throw new Error("Sitemap verwacht exact één </urlset>.");
    xml=xml.replace("</urlset>",`  <url>\n    ${loc}\n  </url>\n</urlset>`);
  }
  fs.writeFileSync(pad,xml,"utf8");
}

function main(){
  if(!fs.existsSync(path.join(OUT,"sitemap.xml")))throw new Error("public/sitemap.xml ontbreekt; draai eerst de plaatsgenerator.");
  const buildDag=runtime.vandaagIn("Europe/Amsterdam",new Date());
  for(const cfg of SEIZOENSPAGINAS){
    const dir=path.join(OUT,cfg.slug);
    if(fs.existsSync(dir))throw new Error(`public/${cfg.slug} bestaat al; seizoenspagina botst met een bestaande route.`);
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,"index.html"),pagina(cfg,buildDag),"utf8");
  }
  voegToeAanSitemap();
  const versie=vernieuwServiceworkerCache(OUT,"seizoenspaginas");
  console.log(`Seizoenspagina's gegenereerd: ${SEIZOENSPAGINAS.map(c=>"/"+c.slug+"/").join(", ")} (builddag ${buildDag}); sitemap bijgewerkt; cache ${versie}.`);
}

if(require.main===module)main();
module.exports={pagina,voegToeAanSitemap};
