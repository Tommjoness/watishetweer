"use strict";

/*
 * Browsertest van de taallader zoals de build hem maakt:
 *   - Nederlands is standaard en laadt geen vertaalbundel;
 *   - ?taal=en zet Engels, bewaart dat en laadt precies één bundel;
 *   - een bewaarde keuze blijft gelden bij het volgende bezoek; ?taal=nl zet terug;
 *   - geblokkeerde opslag breekt niets;
 *   - de schakelaar verschijnt alleen als taal/instellingen.json dat zegt, en dan
 *     bovenin: in de hoek van de kop (smal), in de zoekbalk (breed), naast de
 *     terug-link (subpagina) of bovenaan de inhoud.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { bouwBundels } = require("./apply-taal.js");

const PAGINA = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Test</title></head><body>
<main><footer><span class="bron"><a href="/over/">Over deze site</a></span><span class="bron"><a href="/privacy">Privacy &amp; gegevens</a></span></footer></main>
<script src="/LADER" defer data-taal-lader></script></body></html>`;
const WEERPAGINA = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Weer</title>
<style>.mast{display:flex;justify-content:space-between;flex-wrap:wrap;gap:14px}.mast h1{font-size:21px;margin:0}
@media(max-width:900px){.mastright{width:100%}}</style></head><body>
<main><div class="mast" role="banner"><div><h1>Weer in Capelle aan den IJssel vandaag</h1><h2 id="place">Capelle aan den IJssel</h2></div>
<div class="mastright"><div class="tools"><input type="text" id="q"><button id="here">Locatie</button><button id="ververs">Ververs</button><div class="results" id="res"></div></div></div></div></main>
<script src="/LADER" defer data-taal-lader></script></body></html>`;
const SUBPAGINA = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Privacy</title></head><body>
<main><p><a href="/">← Terug naar het weer</a></p><h1>Privacy</h1></main>
<script src="/LADER" defer data-taal-lader></script></body></html>`;

async function open(browser, { lader, bundelNaam, bundel }, url, voorbereiding, html = PAGINA, viewport) {
  const ctx = await browser.newContext(viewport ? { viewport } : {});
  const page = await ctx.newPage();
  const geladen = [], aangevraagd = [];
  await ctx.route("**/*", route => {
    const u = new URL(route.request().url());
    aangevraagd.push(u.href);
    if (u.pathname === "/LADER") return route.fulfill({ contentType: "application/javascript", body: lader });
    if (u.pathname === "/" + bundelNaam) { geladen.push(u.pathname); return route.fulfill({ contentType: "application/javascript", body: bundel }); }
    return route.fulfill({ contentType: "text/html", body: html });
  });
  if (voorbereiding) await ctx.addInitScript(voorbereiding);
  await page.goto("http://test.local" + url);
  await page.waitForTimeout(150);
  return { ctx, page, geladen, aangevraagd };
}

(async () => {
  const b = await bouwBundels();
  const browser = await chromium.launch({ executablePath: require("./vind-browser.js").vindBrowser() || undefined });

  let t = await open(browser, b, "/");
  assert.equal(await t.page.evaluate(() => document.documentElement.lang), "nl", "standaard Nederlands");
  assert.equal(await t.page.evaluate(() => window.WeatherNowTaal.taal), "nl");
  assert.deepEqual(t.geladen, [], "Nederlands laadt geen vertaalbundel");
  await t.ctx.close();

  t = await open(browser, b, "/?taal=en");
  assert.equal(await t.page.evaluate(() => document.documentElement.lang), "en-GB", "?taal=en zet Engels");
  assert.deepEqual(t.geladen, ["/" + b.bundelNaam], "precies één vertaalbundel");
  assert.equal(await t.page.evaluate(() => localStorage.getItem("weerbriefing.taal.v1")), '"en"', "keuze bewaard");
  assert.equal(await t.page.evaluate(() => document.title), "Test", "onbekende tekst blijft staan");
  /* In het Engels komen plaatsnamen in het Engels binnen (Paris, niet Parijs). */
  await t.page.evaluate(() => Promise.all([
    fetch("https://geocoding-api.open-meteo.com/v1/search?name=Parijs&count=6&language=nl&format=json").catch(() => null),
    fetch("https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=48.85&longitude=2.35&localityLanguage=nl").catch(() => null),
    fetch("/api/waarschuwingen?lat=51.05&lon=3.72&land=BE").catch(() => null)
  ]));
  assert(t.aangevraagd.some(u => u.includes("/api/waarschuwingen") && u.includes("taal=en")), "waarschuwingen in het Engels: officiële Engelse tekst");
  assert(t.aangevraagd.some(u => u.includes("geocoding-api.open-meteo.com") && u.includes("language=en") && !u.includes("language=nl")), "zoeken vraagt Engelse plaatsnamen");
  assert(t.aangevraagd.some(u => u.includes("bigdatacloud") && u.includes("localityLanguage=en")), "Mijn locatie vraagt een Engelse plaatsnaam");
  await t.page.goto("http://test.local/");
  await t.page.waitForTimeout(150);
  assert.equal(await t.page.evaluate(() => document.documentElement.lang), "en-GB", "bewaarde keuze geldt bij volgend bezoek");
  await t.page.goto("http://test.local/?taal=nl");
  await t.page.waitForTimeout(150);
  assert.equal(await t.page.evaluate(() => document.documentElement.lang), "nl", "?taal=nl zet terug");
  assert.equal(await t.page.evaluate(() => localStorage.getItem("weerbriefing.taal.v1")), '"nl"');
  await t.ctx.close();

  t = await open(browser, b, "/", () => { Object.defineProperty(window, "localStorage", { get() { throw new Error("geblokkeerd"); } }); });
  assert.equal(await t.page.evaluate(() => window.WeatherNowTaal.taal), "nl", "geblokkeerde opslag: gewoon Nederlands");
  await t.ctx.close();

  const instellingen = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "taal", "instellingen.json"), "utf8"));
  /* Waar staat de schakelaar en hoe ziet hij eruit? */
  async function schakelaar(html, viewport, url = "/") {
    const t = await open(browser, b, url, null, html, viewport);
    const info = await t.page.evaluate(() => {
      const a = document.querySelector("[data-taal-keuze]");
      if (!a) return null;
      const r = a.getBoundingClientRect(), m = document.querySelector(".mast");
      return {
        tekst: a.textContent, label: a.getAttribute("aria-label"), lang: a.getAttribute("lang"),
        ouder: a.parentElement.className || a.parentElement.tagName.toLowerCase(),
        hoek: a.classList.contains("taal-keuze-hoek"),
        /* Geen regel van de kop mag onder de knop doorlopen. */
        overlap: m ? (() => { const reeks = document.createRange(); reeks.selectNodeContents(m.querySelector("h1"));
          return [...reeks.getClientRects()].some(k => k.right > r.left && k.left < r.right && k.bottom > r.top && k.top < r.bottom); })() : null,
        rechtsboven: m ? Math.abs(m.getBoundingClientRect().right - r.right) < 1 && Math.abs(m.getBoundingClientRect().top - r.top) < 1 : null,
        hoogte: r.height
      };
    });
    return { t, info };
  }
  let s = await schakelaar(WEERPAGINA, { width: 390, height: 844 });
  if (instellingen.schakelaarZichtbaar === true) {
    assert.deepEqual(
      { tekst: s.info.tekst, label: s.info.label, lang: s.info.lang, hoek: s.info.hoek, rechtsboven: s.info.rechtsboven, overlap: s.info.overlap },
      { tekst: "EN", label: "English", lang: "en-GB", hoek: true, rechtsboven: true, overlap: false },
      "smal scherm: EN rechtsboven in de kop");
    assert(s.info.hoogte >= 24, "tikdoel minstens 24px hoog");
    /* Breder venster: de knop verhuist naar de zoekbalk, terug naar de hoek bij smal. */
    await s.t.page.setViewportSize({ width: 1366, height: 900 });
    await s.t.page.waitForFunction(() => document.querySelector("[data-taal-keuze]").parentElement.classList.contains("tools"), null, { timeout: 2000 }).catch(() => {});
    assert.equal(await s.t.page.evaluate(() => document.querySelector("[data-taal-keuze]").parentElement.className), "tools", "breed scherm: laatste vakje in de zoekbalk");
    assert.equal(await s.t.page.evaluate(() => document.querySelector("[data-taal-keuze]").nextElementSibling.id), "res", "vóór de zoekresultaten");
    await s.t.page.setViewportSize({ width: 390, height: 844 });
    await s.t.page.waitForFunction(() => document.querySelector("[data-taal-keuze]").classList.contains("taal-keuze-hoek"), null, { timeout: 2000 }).catch(() => {});
    assert.equal(await s.t.page.evaluate(() => document.querySelector("[data-taal-keuze]").classList.contains("taal-keuze-hoek")), true, "terug naar de hoek");
    assert.equal(await s.t.page.evaluate(() => document.querySelectorAll("[data-taal-keuze]").length), 1, "precies één schakelaar");
    await s.t.page.click("[data-taal-keuze]");
    await s.t.page.waitForTimeout(300);
    assert.equal(await s.t.page.evaluate(() => document.documentElement.lang), "en-GB", "klik op de schakelaar zet Engels");
    await s.t.ctx.close();

    s = await schakelaar(WEERPAGINA, { width: 1366, height: 900 }, "/?taal=en");
    assert.deepEqual({ tekst: s.info.tekst, label: s.info.label, lang: s.info.lang, ouder: s.info.ouder },
      { tekst: "NL", label: "Nederlands", lang: "nl", ouder: "tools" }, "Engelse site: NL in de zoekbalk");
    await s.t.ctx.close();

    s = await schakelaar(SUBPAGINA, { width: 390, height: 844 });
    assert.deepEqual({ tekst: s.info.tekst, ouder: s.info.ouder }, { tekst: "EN", ouder: "taal-keuze-rij" }, "subpagina: naast de terug-link");
    await s.t.ctx.close();

    s = await schakelaar(PAGINA, { width: 390, height: 844 });
    assert.deepEqual({ tekst: s.info.tekst, ouder: s.info.ouder }, { tekst: "EN", ouder: "taal-keuze-boven" }, "andere pagina: bovenaan de inhoud");
    assert.equal(await s.t.page.evaluate(() => document.querySelector("main").firstElementChild.className), "taal-keuze-boven");
  } else {
    assert.equal(s.info, null, "schakelaar blijft verborgen zolang instellingen.json dat zegt");
  }
  await s.t.ctx.close();

  await browser.close();
  console.log(`Taallader-browsertest geslaagd: standaard Nederlands zonder bundel, ?taal=en/nl, bewaarde keuze, geblokkeerde opslag en schakelaar ${instellingen.schakelaarZichtbaar ? "zichtbaar" : "verborgen"}.`);
})().catch(e => { console.error(e); process.exit(1); });
