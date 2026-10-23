"use strict";

const fs=require("fs");
const path=require("path");
const {LOCATIES}=require("./seo-locations.config.js");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const META_RE=/<meta name="weather-build-sha" content="[^"]+">/g;

function bepaalSha(env=process.env){
  const raw=env.WEATHER_BUILD_SHA||env.VERCEL_GIT_COMMIT_SHA||env.GITHUB_SHA||"local";
  const sha=String(raw).trim();
  if(sha!=="local"&&!/^[0-9a-f]{7,40}$/i.test(sha))throw new Error("Ongeldige build-SHA voor provenance: "+sha);
  return sha;
}
function stampHtml(html,sha){
  let bron=String(html||"");
  const bestaand=[...bron.matchAll(META_RE)];
  if(bestaand.length>1)throw new Error("Build-provenance meta staat dubbel in HTML.");
  const meta=`<meta name="weather-build-sha" content="${sha}">`;
  if(bestaand.length===1)return bron.replace(bestaand[0][0],meta);
  if(!bron.includes("<meta charset=\"utf-8\">"))throw new Error("Build-provenance verwacht utf-8 meta als stabiele invoeganker.");
  return bron.replace("<meta charset=\"utf-8\">","<meta charset=\"utf-8\">\n"+meta);
}
/* Alle publieke HTML-pagina's dragen de markering, ook de informatiepagina's (Over, privacy, de
   seizoenspagina's, Nachtzicht met parken en Maan), niet alleen de weerpagina's. De lijst wordt
   daarom uit het artifact zelf opgebouwd en niet uit één paginatype: een nieuw type dat in public/
   verschijnt krijgt de markering vanzelf en de verifier faalt als er een ontbreekt. Het privé
   beheerdashboard staat achter Cloudflare Access en is geen publieke pagina. */
const NIET_PUBLIEK=Object.freeze(["admin"]);
function gevondenHtml(map,rel=""){
  const uit=[];
  for(const ent of fs.readdirSync(path.join(map,rel),{withFileTypes:true})){
    const sub=rel?rel+"/"+ent.name:ent.name;
    if(ent.isDirectory()){
      if(!rel&&NIET_PUBLIEK.includes(ent.name))continue;
      uit.push(...gevondenHtml(map,sub));
    }else if(ent.isFile()&&ent.name.endsWith(".html"))uit.push(path.join(map,sub));
  }
  return uit;
}
function htmlPaden(out=OUT){
  /* Wat er altijd moet zijn (ook als een generator stil niets schreef) plus alles wat er verder staat. */
  const verplicht=[
    path.join(out,"index.html"),
    path.join(out,"weer","index.html"),
    ...LOCATIES.map(loc=>path.join(out,"weer",loc.slug,"index.html"))
  ];
  const gevonden=fs.existsSync(out)?gevondenHtml(out):[];
  return [...new Set([...verplicht,...gevonden])].sort();
}
/* Een sitemap-URL naar het HTML-bestand dat die pagina serveert (/x/ → x/index.html, /privacy → privacy.html). */
function bestandVoorUrl(url,out=OUT){
  const pad=decodeURI(new URL(url).pathname);
  const rel=pad.replace(/^\/+/,"");
  const kandidaten=pad.endsWith("/")?[path.join(out,rel,"index.html")]:[path.join(out,rel+".html"),path.join(out,rel,"index.html")];
  return kandidaten.find(k=>fs.existsSync(k))||null;
}
/* De bewaking voor de verifier: elke publieke pagina draagt de verwachte SHA, precies één keer, en elke
   pagina uit de sitemap hoort daar ook bij. Gooit bij de eerste afwijking. */
function controleerProvenance(out,verwacht){
  const paden=htmlPaden(out);
  for(const p of paden){
    if(!fs.existsSync(p))throw new Error("Build-provenance verifier mist artifact: "+p);
    const html=fs.readFileSync(p,"utf8");
    const matches=[...html.matchAll(/<meta name="weather-build-sha" content="([^"]+)">/g)];
    if(matches.length!==1)throw new Error(`${p}: build-SHA meta moet exact één keer voorkomen; gevonden ${matches.length}.`);
    if(matches[0][1]!==verwacht)throw new Error(`${p}: build-SHA ${matches[0][1]} wijkt af van verwacht ${verwacht}.`);
  }
  const sitemap=path.join(out,"sitemap.xml");
  if(!fs.existsSync(sitemap))throw new Error("Build-provenance verifier mist sitemap.xml om de paginadekking te controleren.");
  const gestempeld=new Set(paden);
  const locs=[...fs.readFileSync(sitemap,"utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  if(!locs.length)throw new Error("Build-provenance verifier vond geen sitemap-pagina's.");
  for(const loc of locs){
    const bestand=bestandVoorUrl(loc,out);
    if(!bestand)throw new Error(`Sitemap-pagina ${loc} heeft geen HTML-artifact.`);
    if(!gestempeld.has(bestand))throw new Error(`Sitemap-pagina ${loc} (${bestand}) valt buiten de gestempelde HTML-artifacts.`);
  }
  return {paginas:paden.length,sitemap:locs.length};
}
function main(){
  const sha=bepaalSha();
  const paden=htmlPaden();
  for(const p of paden){
    if(!fs.existsSync(p))throw new Error("Build-provenance mist HTML-artifact: "+p);
    fs.writeFileSync(p,stampHtml(fs.readFileSync(p,"utf8"),sha),"utf8");
  }
  const cache=vernieuwServiceworkerCache(OUT,"build-provenance");
  console.log(`Build-provenance toegepast op ${paden.length} HTML-artifacts: ${sha}; cache ${cache}.`);
}
if(require.main===module)main();
module.exports={bepaalSha,stampHtml,htmlPaden,bestandVoorUrl,controleerProvenance};
