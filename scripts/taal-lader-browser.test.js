"use strict";

/*
 * Browsertest van de taallader zoals de build hem maakt:
 *   - Nederlands is standaard en laadt geen vertaalbundel;
 *   - ?taal=en zet Engels, bewaart dat en laadt precies één bundel;
 *   - een bewaarde keuze blijft gelden bij het volgende bezoek; ?taal=nl zet terug;
 *   - geblokkeerde opslag breekt niets;
 *   - de schakelaar verschijnt alleen als taal/instellingen.json dat zegt.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { bouwBundels } = require("./apply-taal.js");

const PAGINA = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Test</title></head><body>
<main><footer><span class="bron"><a href="/over/">Over deze site</a></span><span class="bron"><a href="/privacy">Privacy &amp; gegevens</a></span></footer></main>
<script src="/LADER" defer data-taal-lader></script></body></html>`;

async function open(browser, { lader, bundelNaam, bundel }, url, voorbereiding) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const geladen = [], aangevraagd = [];
  await ctx.route("**/*", route => {
    const u = new URL(route.request().url());
    aangevraagd.push(u.href);
    if (u.pathname === "/LADER") return route.fulfill({ contentType: "application/javascript", body: lader });
    if (u.pathname === "/" + bundelNaam) { geladen.push(u.pathname); return route.fulfill({ contentType: "application/javascript", body: bundel }); }
    return route.fulfill({ contentType: "text/html", body: PAGINA });
  });
  if (voorbereiding) await ctx.addInitScript(voorbereiding);
  await page.goto("http://test.local" + url);
  await page.waitForTimeout(150);
  return { ctx, page, geladen, aangevraagd };
}

(async () => {
  const b = await bouwBundels();
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

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
  t = await open(browser, b, "/");
  const link = await t.page.evaluate(() => { const a = document.querySelector("[data-taal-keuze]"); return a && { tekst: a.textContent, lang: a.getAttribute("lang"), naPrivacy: a.parentElement.previousElementSibling.textContent }; });
  if (instellingen.schakelaarZichtbaar === true) {
    assert.deepEqual(link, { tekst: "English", lang: "en-GB", naPrivacy: "Privacy & gegevens" }, "schakelaar staat naast Privacy");
    await t.page.click("[data-taal-keuze]");
    await t.page.waitForTimeout(300);
    assert.equal(await t.page.evaluate(() => document.documentElement.lang), "en-GB", "klik op de schakelaar zet Engels");
  } else {
    assert.equal(link, null, "schakelaar blijft verborgen zolang instellingen.json dat zegt");
  }
  await t.ctx.close();

  await browser.close();
  console.log(`Taallader-browsertest geslaagd: standaard Nederlands zonder bundel, ?taal=en/nl, bewaarde keuze, geblokkeerde opslag en schakelaar ${instellingen.schakelaarZichtbaar ? "zichtbaar" : "verborgen"}.`);
})().catch(e => { console.error(e); process.exit(1); });
