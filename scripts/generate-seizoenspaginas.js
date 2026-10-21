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
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 "Instrument Sans",system-ui,-apple-system,sans-serif;padding:32px 20px}.kaart{max-width:760px;margin:auto;background:var(--sheet);border:1px solid var(--rule);padding:32px}h1{font:400 36px/1.15 "Bodoni Moda",Georgia,serif;margin:0 0 18px}h2{font-size:17px;margin:30px 0 8px}p{margin:10px 0;color:var(--ink-70)}a{color:inherit}.seizoen-aftel-kop{margin:0 0 6px;font-size:21px;line-height:1.25;font-weight:600}h2{font-size:18px;line-height:1.3}main .seizoen-dag h3{font-size:17px;line-height:1.35;font-weight:600}main .seizoen-dag thead th{font-size:13px}.seizoen-later{font-size:14px;color:var(--muted)}.seizoen-aftellen.tekst{font:inherit;color:var(--ink-70);margin:0 0 6px}.seizoen-fout-blok .seizoen-fout{margin-bottom:0}.seizoen-opnieuw{display:block;margin-top:8px;min-height:44px;padding:8px 16px;font:inherit;color:var(--ink);background:transparent;border:1px solid var(--ink);cursor:pointer}.klein{color:var(--muted);font-size:14px}
.seizoen-status{margin:22px 0 0;padding:18px 0 4px;border-top:1px solid var(--rule)}
.seizoen-aftellen{font:400 24px/1.25 "Bodoni Moda",Georgia,serif;color:var(--ink);margin:0 0 6px}
.seizoen-aftellen.groot{display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 14px}
.seizoen-aftellen .aftel-getal{font:400 76px/1 "Bodoni Moda",Georgia,serif;letter-spacing:-.02em}
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
.seizoen-zieook span{color:var(--muted);margin-right:6px}
.seizoen-dag{scroll-margin-top:16px}
.seizoen-dagnav{margin:14px 0 0;line-height:1.9}
.seizoen-dag a:hover,.seizoen-dag a:focus-visible{border-bottom-color:var(--ink)}
.seizoen-perioden td{text-align:right;padding-right:0;white-space:nowrap}.seizoen-perioden td.jaargrens{white-space:normal;text-wrap:balance}
.seizoen-vakantie{table-layout:fixed}.seizoen-vakantie thead th:first-child{width:34%}.seizoen-vakantie thead th:last-child{width:24%}
/* Temperatuurbalkje: op een telefoon onder de cijfers, op desktop in een eigen kolom. */
.seizoen-dag .tbalkcel,.seizoen-dag .tbalkkop{display:none}
.seizoen-dag .tbalk{display:block;position:relative;width:72px;height:4px;margin:6px 0 2px auto;border-radius:2px;background:var(--rule)}
.seizoen-dag .tbalk i{position:absolute;top:0;bottom:0;border-radius:2px;background:var(--licht)}
html[data-thema=donker] .seizoen-dag .tbalk i{background:var(--donker)}
/* Desktop (akkoord eigenaar, 14 oktober): de eerste kolom blijft links, de andere
   kolommen staan met kop en inhoud gecentreerd op dezelfde as. */
@media(min-width:601px){
.seizoen-dag thead th:not(:first-child),.seizoen-dag td,.seizoen-perioden td{text-align:center;padding-left:6px;padding-right:6px}
.seizoen-dag thead th:last-child,.seizoen-dag td:last-child{padding-left:0;padding-right:0}
.seizoen-dag td.tbalkcel,.seizoen-dag td.tbalkkop{display:table-cell;width:120px}
.seizoen-dag td.tbalkcel .tbalk{display:inline-block;width:96px;margin:0;vertical-align:middle}
.seizoen-dag td.temp .tbalk{display:none}
.seizoen-dag td.temp{width:110px;text-align:center}
.seizoen-vakantie thead th:first-child{width:28%}.seizoen-vakantie thead th:last-child{width:110px}
}
@media(max-width:600px){body{padding:14px}.kaart{padding:26px 22px}h1{font-size:32px}.seizoen-dag table{font-size:14px}.seizoen-dag .sep{display:none}.seizoen-dag .sub{display:block;font-size:13px}}
/* Zichtbare focus op alle bedienbare onderdelen, in dezelfde inktkleur als de hoofdpagina (ook in donker). */
a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
/* Informatiepagina's met tabellen (class "breed"): lopende tekst houdt een prettige regellengte,
   tabellen en overzichten krijgen de volle kaartbreedte. Pagina's zonder zo'n overzicht blijven smal. */
.kaart.breed{max-width:1080px;padding:36px clamp(22px,4.5vw,48px)}
.breed p,.breed h2,.breed .seizoen-perioden{max-width:46rem}
.breed .seizoen-dag .officieel{font-size:13px}
.breed .seizoen-later,.breed .klein{font-size:14px;line-height:1.55}
.breed .seizoen-dag thead th{letter-spacing:.02em}
/* Vakantiepagina's: vanaf een brede kaart staan de dagen in twee kolommen naast elkaar (het balkje
   blijft in zijn eigen kolom, afspraak eigenaar 14 oktober). Andere pagina's tonen de dagen onder elkaar. */
@media(min-width:1180px){
.breed #seizoen-verwachting:has(.seizoen-dag+.seizoen-dag table.seizoen-vakantie)>.seizoen-dagnav{display:none}
.breed #seizoen-verwachting:has(.seizoen-dag+.seizoen-dag table.seizoen-vakantie){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 44px;align-items:start}
.breed #seizoen-verwachting:has(.seizoen-dag+.seizoen-dag table.seizoen-vakantie)>:not(.seizoen-dag){grid-column:1/-1}
.breed #seizoen-verwachting:has(.seizoen-dag+.seizoen-dag table.seizoen-vakantie) .seizoen-dag td.tbalkcel,.breed #seizoen-verwachting:has(.seizoen-dag+.seizoen-dag table.seizoen-vakantie) .seizoen-dag td.tbalkkop{width:72px}
.breed #seizoen-verwachting:has(.seizoen-dag+.seizoen-dag table.seizoen-vakantie) .seizoen-dag td.tbalkcel .tbalk{width:56px}
.breed #seizoen-verwachting:has(.seizoen-dag+.seizoen-dag table.seizoen-vakantie) .seizoen-dag td.temp{width:88px}
.breed #seizoen-verwachting:has(.seizoen-dag+.seizoen-dag table.seizoen-vakantie) .seizoen-vakantie thead th:first-child{width:26%}
.breed #seizoen-verwachting:has(.seizoen-dag+.seizoen-dag table.seizoen-vakantie) .seizoen-vakantie thead th:last-child{width:88px}
.breed #seizoen-verwachting:has(.seizoen-dag+.seizoen-dag table.seizoen-vakantie) .seizoen-vakantie td:nth-child(2){white-space:nowrap}
}
</style>`;

/* Vakantiepagina's: de data per regio staan vast in de HTML, voor ieder jaar
   waarvan de vakantie nog niet voorbij is. */
/* Valt de vakantie in alle regio's op dezelfde data (zoals de kerstvakantie),
   dan één regel "Alle regio's" in plaats van drie gelijke. */
function rijen(lijst){
  const gelijk=lijst.every(p=>p.van===lijst[0].van&&p.tot===lijst[0].tot);
  const regels=gelijk?[{kop:"Alle regio's",p:lijst[0]}]:lijst.map(p=>({kop:"Regio "+p.regio,p}));
  /* Een periode over de jaargrens is lang (met jaartallen) en mag op een smal
     scherm over twee regels. */
  return regels.map(({kop,p})=>`<tr><th scope="row">${esc(kop)}</th><td${p.van.slice(0,4)!==p.tot.slice(0,4)?' class="jaargrens"':""}>${esc(runtime.periodeTekst(p.van,p.tot))}</td></tr>`).join("\n");
}
function periodenHtml(cfg,buildDag){
  if(!cfg.perioden)return "";
  const jaren=Object.keys(cfg.perioden).map(Number).sort((a,b)=>a-b).filter(j=>cfg.perioden[j].some(p=>p.tot>=buildDag));
  return jaren.map(j=>`
<div class="seizoen-dag seizoen-perioden" data-jaar="${j}">
<h3>${esc(cfg.naam)} ${j}</h3>
<table><thead><tr><th scope="col">Regio</th><th scope="col">Vakantie</th></tr></thead><tbody>
${rijen(cfg.perioden[j])}
</tbody></table>
</div>`).join("");
}

/* Verwante seizoenspagina's voor dezelfde weken, als korte verwijzing onder de
   uitleg. Een slug die niet (meer) bestaat, breekt de build. */
function zieOokHtml(cfg){
  if(!cfg.zieOok||!cfg.zieOok.length)return "";
  const links=cfg.zieOok.map(slug=>{
    const doel=SEIZOENSPAGINAS.find(p=>p.slug===slug);
    if(!doel)throw new Error(`${cfg.slug}: zieOok verwijst naar onbekende seizoenspagina ${slug}`);
    return `<a href="/${esc(doel.slug)}/">${esc(doel.naam)}</a>`;
  });
  return `<p class="seizoen-zieook"><span>Zie ook</span> ${links.join(" · ")}</p>\n`;
}
function pagina(cfg,buildDag){
  const t=runtime.toestand(buildDag,cfg);
  const canonical=seizoenUrl(cfg);
  const titel=runtime.vul(cfg.titel,{jaar:t.jaar});
  const description=runtime.vul(cfg.beschrijving,{jaar:t.jaar,datum:t.vanaf?runtime.datumTekst(t.vanaf,false):""});
  const structured=[
    {"@context":"https://schema.org","@type":"WebSite",name:SEO.siteName,url:SEO.canonical},
    {"@context":"https://schema.org","@type":"WebPage",name:titel,url:canonical,isPartOf:{"@type":"WebSite",name:SEO.siteName,url:SEO.canonical}}
  ];
  const {slug,beschrijving,intro,uitleg:_uitleg,...runtimeCfg}=cfg;
  const uitleg=cfg.uitleg.alineas.map(a=>`<p>${esc(a)}</p>`).join("\n")+periodenHtml(cfg,buildDag);
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
<body><main class="kaart breed">
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
${cfg.uitleg.bron?`<p class="klein">Bron: <a href="${esc(cfg.uitleg.bron.url)}" rel="noopener">${esc(cfg.uitleg.bron.naam)}</a></p>\n`:""}${zieOokHtml(cfg)}<h2>Het weer voor jouw plaats</h2>
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
module.exports={pagina,voegToeAanSitemap,THEMA_SCRIPT,STIJL};
