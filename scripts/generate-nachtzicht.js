"use strict";

/* Bouwt de Nachtzicht-pagina's als losse subpagina's in de stijl van /over/:
   - /nachtzicht/: de Nationale Parken op een rij, de donkerste eerst, met de
     indicatie voor vannacht;
   - /nachtzicht/<park>/: per park de komende nachten, bewolking per uur en maan;
   - /maan/: maanfase, op- en ondergang en de komende hoofdfasen.
   De statische HTML bevat alles wat niet per nacht verandert (lichtvervuiling,
   uitleg, bronnen); de runtime vult de verwachting bij ieder bezoek in. */

const fs = require("fs");
const path = require("path");
const SEO = require("./seo-foundation.config.js");
const { SHARE_IMAGE } = require("./seo-foundation.js");
const { THEMA_SCRIPT, STIJL } = require("./generate-seizoenspaginas.js");
const { PARKEN, BASIS, MAAN, MAAN_REFERENTIE, TIJDZONE, parkUrl } = require("./nachtzicht.config.js");
const { kernBron, laadKern } = require("./nachtzicht-bron.js");
const { vernieuwServiceworkerCache } = require("./postbuild-cache.js");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "public");
const LICHT = JSON.parse(fs.readFileSync(path.join(ROOT, "lichtvervuiling-nl.json"), "utf8"));
const RUNTIME_BRON = fs.readFileSync(path.join(__dirname, "nachtzicht-runtime.js"), "utf8");

const esc = v => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jsonInHtml = v => JSON.stringify(v).replace(/</g, "\\u003c");

/* Dezelfde klassen en teksten als de regel Lichtvervuiling in Nachtzicht op de plaatspagina's. */
const LICHT_KLASSEN = [null,
  { naam: "laag", tekst: "Weinig kunstlicht: de Melkweg is goed te zien.", volgorde: 1 },
  { naam: "matig", tekst: "De Melkweg is zwak of niet te zien.", volgorde: 3 },
  { naam: "hoog", tekst: "Veel kunstlicht: vooral heldere sterren en planeten zijn te zien.", volgorde: 5 },
  { naam: "laag tot matig", tekst: "De Melkweg is zwak tot goed te zien.", volgorde: 2 },
  { naam: "matig tot hoog", tekst: "De Melkweg is waarschijnlijk niet te zien; heldere sterren wel.", volgorde: 4 }];
const lichtBytes = Buffer.from(LICHT.klassen, "base64");
function lichtCode(lat, lon) {
  const R = LICHT.raster, r = Math.floor((lat - R.lat0) / R.dlat), k = Math.floor((lon - R.lon0) / R.dlon);
  if (r < 0 || k < 0 || r >= R.rijen || k >= R.kolommen) return 0;
  const i = r * R.kolommen + k, c = (lichtBytes[i >> 1] >> ((i & 1) * 4)) & 15;
  return c >= 1 && c <= 5 ? c : 0;
}
/* Een park telt alleen mee als de kaart het vak én alle acht buurvakken dekt.
   Aan de landsgrens ontbreekt licht uit het buitenland in de RIVM-kaart, en zou
   de schatting te donker uitvallen. */
function lichtVoorPark(p) {
  const R = LICHT.raster;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (!lichtCode(p.lat + a * R.dlat, p.lon + b * R.dlon)) return null;
  return LICHT_KLASSEN[lichtCode(p.lat, p.lon)];
}
function parkenMetLicht() {
  return PARKEN.map(p => ({ ...p, licht: lichtVoorPark(p) })).filter(p => p.licht)
    .sort((a, b) => a.licht.volgorde - b.licht.volgorde || a.kort.localeCompare(b.kort, "nl"));
}

const EXTRA_STIJL = `
.nz-terug{margin-top:0}
.nz-licht{margin:18px 0 0;padding:14px 16px;border:1px solid var(--rule);background:var(--paper)}
.nz-licht b{color:var(--ink)}
#nz-vannacht{margin:22px 0 0;padding:18px 0 0;border-top:1px solid var(--rule)}
.nz-score{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
.nz-cijfer{font:500 44px/1 "Instrument Sans",system-ui,sans-serif;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--ink)}
.nz-oordeel{display:grid;gap:2px}.nz-oordeel b{font-size:18px;font-weight:600;color:var(--ink)}.nz-oordeel span{color:var(--ink-70)}
.nz-feiten{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:10px;margin:18px 0 0}
.nz-feiten div{border:1px solid var(--rule);padding:10px 12px}
.nz-feiten dt{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.nz-feiten dd{margin:2px 0 0;color:var(--ink);font-variant-numeric:tabular-nums}
.nz-grafiek{margin:20px 0 0}
.nz-grafiek figcaption{display:flex;justify-content:space-between;gap:8px 14px;flex-wrap:wrap;font-size:13px;color:var(--muted);margin-bottom:6px}
.nz-legenda{display:flex;gap:12px;flex-wrap:wrap}.nz-legenda i{display:inline-block;width:10px;height:10px;margin-right:5px;vertical-align:-1px;background:var(--rule)}
.nz-legenda i.goed{background:var(--ink)}.nz-legenda i.maan{height:3px;vertical-align:2px;background:var(--muted)}
.nz-staven,.nz-maanrij,.nz-tijden{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:3px}
.nz-staven{height:96px;align-items:end;border-bottom:1px solid var(--rule)}
.nz-uur{height:var(--h);background:var(--rule)}.nz-uur.goed{background:var(--ink)}
.nz-maanrij{margin-top:4px}.nz-maanrij i{height:3px}.nz-maanrij i.op{background:var(--muted)}
.nz-tijden{margin-top:4px;font-size:11px;color:var(--muted);text-align:center;font-variant-numeric:tabular-nums}
.nz-tabel table,#nz-nachten table{width:100%;border-collapse:collapse;font-size:15px}
.nz-tabel th,.nz-tabel td,#nz-nachten th,#nz-nachten td{text-align:left;padding:9px 10px 9px 0;border-bottom:1px solid var(--rule);vertical-align:top}
.nz-tabel thead th,#nz-nachten thead th{font-size:12px;font-weight:500;color:var(--muted);padding-top:0}
.nz-tabel tbody th,#nz-nachten tbody th{font-weight:500;color:var(--ink)}
.nz-tabel td,#nz-nachten td{color:var(--ink-70)}
.nz-licht-mob{display:none;font-size:13px;font-weight:400;color:var(--muted)}
.nz-n{white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--ink)!important}.nz-n span{color:var(--muted)}
.nz-tabel a{text-decoration:none;border-bottom:1px solid var(--rule)}.nz-tabel a:hover,.nz-tabel a:focus-visible{border-bottom-color:var(--ink)}
#nz-nachten{margin-top:22px}
.nz-maan{display:flex;gap:20px;align-items:center;margin:22px 0 0;padding:18px 0 0;border-top:1px solid var(--rule)}
.nz-maan svg{width:72px;height:72px;flex:none}.nz-maan-rand{fill:var(--paper);stroke:var(--rule)}.nz-maan-licht{fill:var(--ink-70)}
.nz-maan p{margin:4px 0}.nz-maan .groot{font:400 24px/1.25 "Bodoni Moda",Georgia,serif;color:var(--ink);margin:0 0 4px}
#nz-maan-fasen{margin:10px 0 0;padding-left:20px;color:var(--ink-70)}#nz-maan-fasen b{color:var(--ink);font-weight:500}
@media(max-width:600px){#nz-nachten thead{display:none}#nz-nachten tr{display:grid;grid-template-columns:auto 1fr;column-gap:12px;padding:9px 0;border-bottom:1px solid var(--rule)}#nz-nachten th,#nz-nachten td{border:0;padding:0}#nz-nachten td.nz-zin{grid-column:1/-1;margin-top:3px}.nz-tabel table{font-size:14px}.nz-tabel .nz-licht-kol{display:none}.nz-licht-mob{display:block}.nz-cijfer{font-size:38px}.nz-tijden span:nth-child(even){visibility:hidden}}
`;

function kop({ titel, beschrijving, canonical, extra = "" }) {
  const structured = [
    { "@context": "https://schema.org", "@type": "WebSite", name: SEO.siteName, url: SEO.canonical },
    { "@context": "https://schema.org", "@type": "WebPage", name: titel, url: canonical, isPartOf: { "@type": "WebSite", name: SEO.siteName, url: SEO.canonical } }
  ];
  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)} | watishetweer.nl</title>
<meta name="description" content="${esc(beschrijving)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SEO.siteName)}">
<meta property="og:title" content="${esc(titel)}">
<meta property="og:description" content="${esc(beschrijving)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SHARE_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F4F5F3">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.open-meteo.com; img-src 'self' data:; base-uri 'none'; form-action 'none'">
<script type="application/ld+json">${jsonInHtml(structured)}</script>
${THEMA_SCRIPT}
${STIJL.replace("</style>", EXTRA_STIJL + "</style>")}
${extra}</head>
<body><main class="kaart">
`;
}
function staart(config, kern) {
  return `</main>
<script type="application/json" id="nz-config">${jsonInHtml(config)}</script>
<script>
${kern}
${RUNTIME_BRON}
</script>
</body>
</html>
`;
}

const BRONNEN = `<p class="klein">Bronnen: de verwachting komt van het weermodel via <a href="https://open-meteo.com" rel="noopener">Open-Meteo</a>; de lichtvervuiling is geschat uit de RIVM-kaart "Berekende hemelhelderheid in de nacht, zonder bewolking" (2015); de ligging van de parken komt uit <a href="https://www.wikidata.org" rel="noopener">Wikidata</a>. Meer over de schatting staat op <a href="/over/#lichtvervuiling">Over deze site</a>.</p>`;
const SCORE_UITLEG = `<h2>Hoe de indicatie werkt</h2>
<p>De indicatie van 0 tot 10 is precies die van het blok Nachtzicht op watishetweer.nl, voor de rest van de nacht vanaf nu. Ze telt vooral de bewolking, en trekt er punten af voor slecht zicht, mist, neerslag, hoge luchtvochtigheid, kans op dauw, harde windstoten en maanlicht. Hoe hoger de maan staat en hoe voller hij is, hoe meer hij meetelt.</p>
<p>Het kijkvenster is het langste aaneengesloten stuk van minstens twee uur met weinig bewolking (minder dan 35%), goed zicht, geen neerslag of mist en weinig maanlicht. Voor nachten verder vooruit staat er een dagdeel in plaats van kloktijden, omdat die verwachting nog onzeker is. Lichtvervuiling zit niet in de indicatie, want die verandert niet per nacht.</p>`;

function parkPagina(p, kern) {
  const canonical = parkUrl(p);
  const titel = `Sterren kijken in ${p.naam}`;
  const beschrijving = `Kun je vannacht sterren zien in ${p.naam}? Indicatie per nacht met de beste periode, bewolking per uur, de maan en de lichtvervuiling.`;
  const weerUrl = "/?" + new URLSearchParams({ lat: p.lat.toFixed(3), lon: p.lon.toFixed(3), plaats: p.kort, land: "NL" }).toString();
  return kop({ titel, beschrijving, canonical }) + `<p class="nz-terug"><a href="${BASIS}">← Alle Nationale Parken</a></p>
<h1>${esc(titel)}</h1>
<p>Kun je vannacht sterren zien in ${esc(p.naam)}? Hieronder staat per nacht hoe goed het zicht op de sterrenhemel naar verwachting is, met de beste periode om te kijken.</p>
<p class="nz-licht">Lichtvervuiling: <b>${esc(p.licht.naam)}</b> (geschat). ${esc(p.licht.tekst)} <span class="klein">Voor een heldere, maanloze nacht, rond het midden van het park; waar je precies staat maakt uit.</span></p>
<section id="nz-vannacht" aria-live="polite" hidden></section>
<p id="nz-status" class="klein">De verwachting wordt geladen.</p>
<section id="nz-nachten" aria-label="Komende nachten" hidden></section>
<p><a href="${esc(weerUrl)}">Het weer per uur voor deze plek</a></p>
${SCORE_UITLEG}
${BRONNEN}
` + staart({ soort: "park", tz: TIJDZONE, park: { slug: p.slug, lat: p.lat, lon: p.lon } }, kern);
}

function overzichtPagina(parken, kern) {
  const canonical = `https://watishetweer.nl${BASIS}`;
  const titel = "Sterren kijken in Nederland: de donkerste plekken";
  const beschrijving = "De Nationale Parken van Nederland op een rij, de donkerste eerst: lichtvervuiling per park en de kans op een heldere sterrenhemel vannacht.";
  const rijen = parken.map(p => `<tr data-park="${p.slug}"><th scope="row"><a href="${BASIS}${p.slug}/">${esc(p.kort)}</a><span class="nz-licht-mob">Lichtvervuiling ${esc(p.licht.naam)}</span></th><td class="nz-licht-kol">${esc(p.licht.naam)}</td><td class="nz-n">…</td><td class="nz-venster">…</td></tr>`).join("\n");
  return kop({ titel, beschrijving, canonical }) + `<p class="nz-terug"><a href="/">← Terug naar het weer</a></p>
<h1>Sterren kijken in Nederland</h1>
<p>De Nationale Parken behoren tot de donkerste plekken van Nederland. Hieronder staan ze op een rij, de donkerste eerst, met de indicatie voor vannacht. Kies een park voor de komende nachten en de bewolking per uur.</p>
<p id="nz-status" class="klein">De verwachting voor vannacht wordt geladen.</p>
<div class="nz-tabel"><table>
<thead><tr><th scope="col">Park</th><th scope="col" class="nz-licht-kol">Lichtvervuiling</th><th scope="col">Vannacht</th><th scope="col">Beste periode</th></tr></thead>
<tbody>
${rijen}
</tbody></table></div>
<p>De maan bepaalt mee hoeveel sterren je ziet. Fase, op- en ondergang en de volgende volle maan staan op <a href="${MAAN}">De maan vandaag</a>.</p>
<h2>Hoe donker is het?</h2>
<p>De lichtvervuiling is een grove schatting voor een heldere, maanloze nacht, uit de RIVM-kaart van de hemelhelderheid. <b>Laag</b>: weinig kunstlicht, de Melkweg is goed te zien. <b>Matig</b>: de Melkweg is zwak of niet te zien. Bij twijfel tussen twee klassen staan ze allebei genoemd. Parken aan de landsgrens ontbreken in dit overzicht: de kaart kent het licht uit het buitenland niet, waardoor de schatting daar te donker zou uitvallen.</p>
${SCORE_UITLEG}
${BRONNEN}
` + staart({ soort: "overzicht", tz: TIJDZONE, parken: parken.map(p => ({ slug: p.slug, lat: p.lat, lon: p.lon })) }, kern);
}

function maanPagina(kern, nuMs) {
  const canonical = `https://watishetweer.nl${MAAN}`;
  const titel = "De maan vandaag: fase, opkomst en ondergang";
  const beschrijving = "Welke maanfase is het vandaag, hoeveel procent is de maan verlicht en wanneer komt hij op en gaat hij onder? Met de datums van de volgende nieuwe en volle maan.";
  const K = laadKern();
  const m = K.maanOverzicht(nuMs, MAAN_REFERENTIE.lat, MAAN_REFERENTIE.lon, TIJDZONE);
  const naam = m.naam.charAt(0).toUpperCase() + m.naam.slice(1) + ", " + Math.round(m.ill * 100) + "% verlicht";
  return kop({ titel, beschrijving, canonical }) + `<p class="nz-terug"><a href="/">← Terug naar het weer</a></p>
<h1>De maan vandaag</h1>
<p>Hoe vol de maan is en hoe hoog hij staat, bepaalt hoeveel sterren je ziet. Bij een volle maan verdwijnt de Melkweg; rond nieuwe maan is de hemel het donkerst.</p>
<div class="nz-maan" aria-live="polite"><span id="nz-maan-schijf" aria-hidden="true"></span><div>
<p class="groot" id="nz-maan-naam">${esc(naam)}</p>
<p id="nz-maan-tijden">De op- en ondergangstijden worden geladen.</p>
</div></div>
<h2>De komende fasen</h2>
<ul id="nz-maan-fasen"></ul>
<p class="klein">Tijden in Nederlandse tijd. Op- en ondergang gelden voor ${esc(MAAN_REFERENTIE.naam)}; elders in Nederland scheelt het hooguit enkele minuten. De momenten van de fasen zijn berekend volgens Meeus (Astronomical Algorithms).</p>
<h2>Sterren kijken</h2>
<p>Waar het donker is en hoe de komende nachten worden, staat op <a href="${BASIS}">Sterren kijken in Nederland</a>.</p>
` + staart({ soort: "maan", tz: TIJDZONE, referentie: MAAN_REFERENTIE }, kern);
}

function voegToeAanSitemap(urls) {
  const pad = path.join(OUT, "sitemap.xml");
  let xml = fs.readFileSync(pad, "utf8");
  if (xml.split("</urlset>").length !== 2) throw new Error("Sitemap verwacht exact één </urlset>.");
  for (const url of urls) {
    const loc = `<loc>${url}</loc>`;
    if (xml.includes(loc)) throw new Error(`Sitemap bevat ${url} al.`);
    xml = xml.replace("</urlset>", `  <url>\n    ${loc}\n  </url>\n</urlset>`);
  }
  fs.writeFileSync(pad, xml, "utf8");
}

function schrijf(rel, html) {
  const dir = path.join(OUT, rel);
  if (fs.existsSync(path.join(dir, "index.html"))) throw new Error(`public/${rel}/index.html bestaat al; Nachtzicht botst met een bestaande route.`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
}

function main() {
  if (!fs.existsSync(path.join(OUT, "sitemap.xml"))) throw new Error("public/sitemap.xml ontbreekt; draai eerst de plaatsgenerator.");
  const kern = kernBron();
  const parken = parkenMetLicht();
  if (parken.length < 10) throw new Error(`Nachtzicht: te weinig parken met een volledige lichtkaart (${parken.length}).`);
  schrijf(BASIS.slice(1, -1), overzichtPagina(parken, kern));
  for (const p of parken) schrijf(BASIS.slice(1) + p.slug, parkPagina(p, kern));
  schrijf(MAAN.slice(1, -1), maanPagina(kern, Date.now()));
  voegToeAanSitemap([`https://watishetweer.nl${BASIS}`, ...parken.map(parkUrl), `https://watishetweer.nl${MAAN}`]);
  const versie = vernieuwServiceworkerCache(OUT, "nachtzicht");
  console.log(`Nachtzicht-pagina's gegenereerd: ${BASIS}, ${parken.length} parken (${PARKEN.length - parken.length} overgeslagen aan de landsgrens), ${MAAN}; sitemap bijgewerkt; cache ${versie}.`);
}

if (require.main === module) main();
module.exports = { parkenMetLicht, lichtVoorPark, parkPagina, overzichtPagina, maanPagina, LICHT_KLASSEN };
