"use strict";

/* Build-provenance voor alle publieke HTML-pagina's: de markering staat precies één keer op de weerpagina's
   én op de informatiepagina's (Over, privacy, seizoenspagina's, Nachtzicht met parken, Maan), en de
   verifier faalt als een sitemap-pagina buiten de gestempelde artifacts valt. */

const fs=require("fs");
const os=require("os");
const path=require("path");
const assert=require("assert");
const {bepaalSha,stampHtml,htmlPaden,bestandVoorUrl,controleerProvenance}=require("./apply-build-provenance.js");
const {LOCATIES}=require("./seo-locations.config.js");

const SHA="d823f0a832ad22a0dc8a15b1745f5ecc937cbcd9";
const NIEUW="0123456789abcdef0123456789abcdef01234567";
const PAGINA="<!DOCTYPE html>\n<html><head>\n<meta charset=\"utf-8\">\n<title>x</title></head><body></body></html>";

function schrijf(out,rel,html=PAGINA){
  const p=path.join(out,rel);
  fs.mkdirSync(path.dirname(p),{recursive:true});
  fs.writeFileSync(p,html,"utf8");
}
/* Een compleet nepartifact met alle paginatypen. */
function artifact(){
  const out=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-provenance-"));
  const paginas=["index.html","weer/index.html",...LOCATIES.map(l=>`weer/${l.slug}/index.html`),
    "over/index.html","privacy.html","herfstvakantie/index.html","witte-kerst/index.html",
    "nachtzicht/index.html","nachtzicht/alde-feanen/index.html","maan/index.html"];
  for(const rel of paginas)schrijf(out,rel);
  schrijf(out,"admin/seo/index.html");
  const url=rel=>"https://watishetweer.nl/"+rel.replace(/index\.html$/,"").replace(/\.html$/,"");
  fs.writeFileSync(path.join(out,"sitemap.xml"),`<urlset>${paginas.map(r=>`<url><loc>${url(r)}</loc></url>`).join("")}</urlset>`);
  return {out,paginas};
}
function stempelAlles(out,sha){
  for(const p of htmlPaden(out))fs.writeFileSync(p,stampHtml(fs.readFileSync(p,"utf8"),sha),"utf8");
}

/* stampHtml: één keer, idempotent, vervangbaar; dubbel of zonder anker is een fout. */
{
  const eenmaal=stampHtml(PAGINA,SHA);
  assert.equal([...eenmaal.matchAll(/weather-build-sha/g)].length,1);
  assert.equal(stampHtml(eenmaal,SHA),eenmaal,"opnieuw stempelen met dezelfde SHA verandert niets");
  const vervangen=stampHtml(eenmaal,NIEUW);
  assert.equal([...vervangen.matchAll(/weather-build-sha/g)].length,1,"een nieuwe SHA vervangt de oude, zonder tweede meta");
  assert(vervangen.includes(`content="${NIEUW}"`));
  assert.throws(()=>stampHtml(eenmaal.replace("<title>",`<meta name="weather-build-sha" content="${SHA}"><title>`),SHA),/dubbel/);
  assert.throws(()=>stampHtml("<html><head></head></html>",SHA),/utf-8/);
  assert.equal(bepaalSha({WEATHER_BUILD_SHA:SHA}),SHA);
  assert.throws(()=>bepaalSha({WEATHER_BUILD_SHA:"geen-sha!"}),/Ongeldige/);
}

/* htmlPaden: alle publieke pagina's, niet het privé beheerdashboard. */
{
  const {out,paginas}=artifact();
  try{
    const paden=htmlPaden(out).map(p=>path.relative(out,p).split(path.sep).join("/"));
    for(const rel of paginas)assert(paden.includes(rel),`${rel} hoort een gestempelde pagina te zijn`);
    assert(!paden.some(p=>p.startsWith("admin/")),"het beheerdashboard hoort niet bij de publieke pagina's");
    assert.equal(new Set(paden).size,paden.length,"geen dubbele paden");
    for(const [url,verwacht] of [["https://watishetweer.nl/","index.html"],["https://watishetweer.nl/over/","over/index.html"],["https://watishetweer.nl/privacy","privacy.html"],["https://watishetweer.nl/nachtzicht/alde-feanen/","nachtzicht/alde-feanen/index.html"]])
      assert.equal(path.relative(out,bestandVoorUrl(url,out)).split(path.sep).join("/"),verwacht,url);
    assert.equal(bestandVoorUrl("https://watishetweer.nl/bestaat-niet/",out),null);
  }finally{fs.rmSync(out,{recursive:true,force:true});}
}

/* controleerProvenance: slaagt op een volledig gestempeld artifact en faalt op elke afwijking. */
{
  const {out,paginas}=artifact();
  try{
    stempelAlles(out,SHA);
    stempelAlles(out,SHA);/* tweede ronde (herbouw): nog steeds precies één keer */
    const uit=controleerProvenance(out,SHA);
    assert.equal(uit.paginas,paginas.length);
    assert.equal(uit.sitemap,paginas.length);

    assert.throws(()=>controleerProvenance(out,NIEUW),/wijkt af/);

    const info=path.join(out,"nachtzicht","alde-feanen","index.html");
    const gestempeld=fs.readFileSync(info,"utf8");
    fs.writeFileSync(info,gestempeld.replace(/<meta name="weather-build-sha" content="[^"]+">\n?/,""));
    assert.throws(()=>controleerProvenance(out,SHA),/gevonden 0/,"een informatiepagina zonder markering faalt");
    fs.writeFileSync(info,gestempeld.replace("<title>",`<meta name="weather-build-sha" content="${SHA}"><title>`));
    assert.throws(()=>controleerProvenance(out,SHA),/gevonden 2/,"een dubbele markering faalt");
    fs.writeFileSync(info,gestempeld);

    /* Een sitemap-pagina zonder bestand en een zonder markering vallen beide op. */
    fs.appendFileSync(path.join(out,"sitemap.xml"),"<url><loc>https://watishetweer.nl/nieuw-type/</loc></url>");
    assert.throws(()=>controleerProvenance(out,SHA),/geen HTML-artifact/);
  }finally{fs.rmSync(out,{recursive:true,force:true});}
}

console.log("Build-provenance: alle publieke HTML-paginatypen (weer, plaatsen, Over, privacy, seizoen, Nachtzicht, parken, Maan) exact één keer gestempeld en door de verifier bewaakt; dubbel, ontbrekend en afwijkend falen.");
