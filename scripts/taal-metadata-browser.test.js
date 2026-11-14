"use strict";

/*
 * Engelse metadata in de browser (description, og:title, og:description,
 * twitter:title en twitter:description), gemeten op het definitieve artifact.
 *
 * Wat dit bewaakt:
 *   A. iedere metadatatekst van iedere indexeerbare pagina heeft een volledige
 *      Engelse vertaling (zonder browser, over alle gegenereerde HTML);
 *   B. in de browser: Nederlands blijft exact de gegenereerde HTML; Engels
 *      vertaalt alleen die vijf tags; canonical, og:url, JSON-LD en de overige
 *      tags blijven gelijk aan het Nederlands; Nederlandse metadata die de app
 *      later terugzet (zoals herstelRouteSeo op locatiepagina's) wordt opnieuw
 *      vertaald; de taalwissel NL > EN > NL werkt; geen paginafouten.
 *
 * Let op: dit gaat over weergave in de browser. De HTML die de server levert
 * blijft Nederlands; zoekmachines en deelpreviews zien dus geen Engelse tekst.
 */

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");
const { stub } = require("./taal-catalogus-browser.js");
const { SCENARIOS } = require("./taal-scenarios.js");
const kern = require("../taal/vertaalkern.js");
const woordenboek = require("../taal/en.js");

const PUBLIC = path.join(__dirname, "..", "public");
const vertaler = kern.maakVertaler(woordenboek);
const META = ['meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:description"]', 'meta[name="twitter:title"]', 'meta[name="twitter:description"]'];
const ontsnap = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/* ---------- A. Volledigheid over alle gegenereerde HTML ---------- */
function htmlBestanden(map) {
  const uit = [];
  for (const naam of fs.readdirSync(map)) {
    const pad = path.join(map, naam);
    if (fs.statSync(pad).isDirectory()) { if (!["admin", "api", "taal"].includes(naam)) uit.push(...htmlBestanden(pad)); }
    else if (naam.endsWith(".html")) uit.push(pad);
  }
  return uit;
}
function metaUitHtml(html) {
  const uit = {};
  for (const m of html.matchAll(/<meta (name|property)="(description|og:title|og:description|twitter:title|twitter:description)" content="([^"]*)"/g)) uit[m[2]] = ontsnap(m[3]);
  return uit;
}
let paginas = 0, teksten = 0;
const ontbrekend = [];
for (const bestand of htmlBestanden(PUBLIC)) {
  const html = fs.readFileSync(bestand, "utf8");
  if (/<meta name="robots" content="[^"]*noindex/.test(html)) continue;
  paginas++;
  for (const [tag, tekst] of Object.entries(metaUitHtml(html))) {
    teksten++;
    const en = vertaler.vertaal(tekst);
    if (en == null || vertaler.onvertaald(tekst).length) ontbrekend.push(`${path.relative(PUBLIC, bestand)} ${tag}: ${tekst}`);
    else assert.notEqual(en, tekst, `${path.relative(PUBLIC, bestand)} ${tag}: vertaling is gelijk aan het Nederlands`);
  }
}
assert(paginas > 0 && teksten > 0, "geen gegenereerde pagina's met metadata gevonden; draait dit na de build?");
assert.deepStrictEqual(ontbrekend.slice(0, 20), [], `metadata zonder volledige Engelse vertaling (${ontbrekend.length})`);

/* ---------- B. In de browser ---------- */
const ROUTES = ["/", "/weer/almere/", "/weer/den-haag/", "/nachtzicht/", "/nachtzicht/alde-feanen/", "/maan/", "/herfstvakantie/", "/over/", "/privacy.html"];
const TYPES = { ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
let taalVoorStub = "nl", opslagBewaren = false;
/* De stub wist de opslag bij iedere pagina; voor de taalwissel moet de gekozen taal blijven staan. */
const stubVoor = () => { const t = stub(SCENARIOS[0], taalVoorStub); return opslagBewaren ? t.replace("localStorage.clear();sessionStorage.clear();", "") : t; };
const server = http.createServer((req, res) => {
  const pad = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(PUBLIC, pad.endsWith("/") ? pad + "index.html" : pad);
  if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  if (f.endsWith(".html")) {
    const html = fs.readFileSync(f, "utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi, "").replace("<head>", "<head>" + stubVoor());
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(html);
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

async function lees(page) {
  return page.evaluate(sel => {
    const attr = (s, a) => { const e = document.querySelector(s); return e ? e.getAttribute(a) : null; };
    const meta = {};
    for (const s of sel) meta[s] = attr(s, "content");
    const overig = [...document.head.querySelectorAll("meta[content]")].filter(e => !sel.some(s => e.matches(s))).map(e => (e.getAttribute("name") || e.getAttribute("property") || e.getAttribute("http-equiv")) + "=" + e.getAttribute("content"));
    return {
      lang: document.documentElement.getAttribute("lang"),
      meta, overig,
      canonical: attr('link[rel="canonical"]', "href"),
      ogUrl: attr('meta[property="og:url"]', "content"),
      jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent),
      ontbreekt: window.__WIW_TAAL_ONTBREEKT__ ? [...window.__WIW_TAAL_ONTBREEKT__] : []
    };
  }, META);
}

async function open(browser, route, taal) {
  taalVoorStub = taal;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  const fouten = [];
  page.on("pageerror", e => fouten.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}${route}`, { waitUntil: "load" });
  if (taal === "en") await page.waitForFunction(() => document.documentElement.hasAttribute("data-taal-klaar"), null, { timeout: 20000 });
  await page.waitForTimeout(1200);
  return { ctx, page, fouten };
}

server.listen(0, "127.0.0.1", async () => {
  const browser = await chromium.launch({ executablePath: require("./vind-browser.js").vindBrowser() || undefined });
  let controles = 0;
  try {
    for (const route of ROUTES) {
      const bestand = path.join(PUBLIC, route.endsWith("/") ? route + "index.html" : route);
      const bron = metaUitHtml(fs.readFileSync(bestand, "utf8"));
      const nl = await open(browser, route, "nl");
      const rNl = await lees(nl.page);
      const en = await open(browser, route, "en");
      const rEn = await lees(en.page);

      for (const [tag, tekst] of Object.entries(bron)) {
        const sel = META.find(s => s.includes(`"${tag}"`));
        assert.equal(rNl.meta[sel], tekst, `${route} NL: ${tag} moet exact de gegenereerde HTML blijven`);
        assert.equal(rEn.meta[sel], vertaler.vertaal(tekst), `${route} EN: ${tag} is niet vertaald`);
        const zinnen = [tekst, ...tekst.split(/(?<=[.!?])\s+(?=[A-Z0-9ÀÉÖÜ"'(])/)];
        assert(!rEn.ontbreekt.some(t => zinnen.includes(t)), `${route} EN: ${tag} gemeld als onvertaald: ${JSON.stringify(rEn.ontbreekt.filter(t => zinnen.includes(t)))}`);
        controles += 3;
      }
      assert.equal(rEn.lang, "en-GB", `${route}: lang in het Engels`);
      assert.equal(rEn.canonical, rNl.canonical, `${route}: canonical blijft gelijk aan het Nederlands`);
      assert.equal(rEn.ogUrl, rNl.ogUrl, `${route}: og:url blijft gelijk`);
      assert.deepStrictEqual(rEn.jsonld, rNl.jsonld, `${route}: JSON-LD blijft gelijk`);
      assert.deepStrictEqual(rEn.overig, rNl.overig, `${route}: overige metatags blijven gelijk`);
      controles += 5;

      /* De app zet Nederlandse metadata terug (zoals herstelRouteSeo met setAttribute): opnieuw Engels. */
      const terugTezetten = Object.entries({ 'meta[name="description"]': bron.description, 'meta[property="og:description"]': bron["og:description"] }).filter(([, t]) => t);
      if (terugTezetten.length) {
        await en.page.evaluate(paren => { for (const [sel, t] of paren) document.querySelector(sel).setAttribute("content", t); }, terugTezetten);
        await en.page.waitForTimeout(100);
        const terug = await lees(en.page);
        for (const [sel, t] of terugTezetten) {
          assert.equal(terug.meta[sel], vertaler.vertaal(t), `${route}: teruggezette ${sel} wordt opnieuw vertaald`);
          controles++;
        }
      }
      assert.deepStrictEqual(nl.fouten, [], `${route} NL: paginafouten`);
      assert.deepStrictEqual(en.fouten, [], `${route} EN: paginafouten`);
      await nl.ctx.close(); await en.ctx.close();
    }

    /* Taalwissel NL > EN > NL via de schakelaar op een locatiepagina. */
    const route = "/weer/almere/";
    const bron = metaUitHtml(fs.readFileSync(path.join(PUBLIC, route, "index.html"), "utf8"));
    const w = await open(browser, route, "nl");
    opslagBewaren = true; taalVoorStub = "";
    for (const [doel, verwacht] of [["en", vertaler.vertaal(bron.description)], ["nl", bron.description]]) {
      await Promise.all([w.page.waitForNavigation({ waitUntil: "load" }), w.page.click(`[data-taal-keuze="${doel}"]`)]);
      if (doel === "en") await w.page.waitForFunction(() => document.documentElement.hasAttribute("data-taal-klaar"), null, { timeout: 20000 });
      await w.page.waitForTimeout(800);
      const r = await lees(w.page);
      assert.equal(r.meta['meta[name="description"]'], verwacht, `taalwissel naar ${doel}: description`);
      controles++;
    }
    opslagBewaren = false;
    assert.deepStrictEqual(w.fouten, [], "taalwissel: paginafouten");
    await w.ctx.close();
  } catch (e) { console.error(e); process.exitCode = 1; }
  finally { await browser.close(); server.close(); }
  if (!process.exitCode) console.log(`Engelse metadata: ${teksten} metadatateksten op ${paginas} pagina's volledig vertaald; browser ${ROUTES.length} routes NL en EN, ${controles} controles (NL ongewijzigd, EN vertaald, canonical/og:url/JSON-LD/overige tags gelijk, terugschrijven opnieuw vertaald, taalwissel NL > EN > NL). Alleen weergave in de browser; de HTML van de server blijft Nederlands.`);
});
