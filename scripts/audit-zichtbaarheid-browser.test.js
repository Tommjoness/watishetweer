"use strict";

/*
 * Audit 6 oktober, zichtbare punten, gemeten op het definitieve artifact:
 * - F09: regio en land onder de plaatsnaam (ook in het Engels), en
 *   gelijknamige bewaarde plaatsen krijgen hun regio erachter;
 * - F04: de bron van de hoofdverwachting staat bij de ophaaltijd, inclusief
 *   een zichtbare reservebron;
 * - F10: de grafiektabel heeft een zichtbare, klikbare link en blijft dicht
 *   tot iemand hem opent.
 */

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");
const { stub } = require("./taal-catalogus-browser.js");
const { SCENARIOS } = require("./taal-scenarios.js");

const PUBLIC = path.join(__dirname, "..", "public");
const TYPES = { ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
let taal = "";

const server = http.createServer((req, res) => {
  const pad = decodeURIComponent(req.url.split("?")[0]);
  let f = path.join(PUBLIC, pad.endsWith("/") ? pad + "index.html" : pad);
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  if (f.endsWith(".html")) {
    const html = fs.readFileSync(f, "utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi, "").replace("<head>", "<head>" + stub(SCENARIOS[0], taal));
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(html);
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

async function open(browser, port, breedte) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: 900 } });
  const page = await ctx.newPage();
  const fouten = [];
  page.on("pageerror", e => fouten.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?lat=52.669&lon=4.701&plaats=Bergen&land=NL`, { waitUntil: "load" });
  await page.waitForFunction(() => /\d{2}:\d{2}/.test(document.getElementById("stamp")?.textContent || ""), null, { timeout: 15000 });
  return { ctx, page, fouten };
}

server.listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: require("./vind-browser.js").vindBrowser() || undefined });
  try {
    for (const breedte of [390, 1366]) {
      taal = "";
      const { ctx, page, fouten } = await open(browser, port, breedte);

      /* F09: zonder bekende regio alleen het land; na een gekozen regio beide. */
      let regel = await page.evaluate(() => { const el = document.getElementById("plaatsregio"); return el && !el.hidden ? el.textContent : ""; });
      assert.strictEqual(regel, "Nederland", `${breedte}px: land ontbreekt onder de plaatsnaam`);
      await page.evaluate(() => { onthoudRegio(S.lat, S.lon, "Noord-Holland"); toonPlaatsRegio(); });
      regel = await page.evaluate(() => document.getElementById("plaatsregio").textContent);
      assert.strictEqual(regel, "Noord-Holland, Nederland", `${breedte}px: regio en land onder de plaatsnaam`);
      const kop = await page.evaluate(() => {
        const p = document.getElementById("place"), r = document.getElementById("plaatsregio");
        const a = p.getBoundingClientRect(), b = r.getBoundingClientRect();
        return { label: p.getAttribute("aria-label"), onder: b.top >= a.bottom - 1, binnen: b.right <= innerWidth + 0.5, volgt: p.nextElementSibling === r };
      });
      assert.strictEqual(kop.label, "Bergen", "de plaatsnaam zelf (aria-label) blijft ongewijzigd");
      assert(kop.onder && kop.binnen && kop.volgt, `${breedte}px: regioregel staat niet direct onder de plaatsnaam: ${JSON.stringify(kop)}`);

      /* Een nieuwe render van de kop houdt de regioregel bij. */
      await page.evaluate(() => { document.getElementById("place").innerHTML = "Bergen"; });
      await page.waitForFunction(() => document.getElementById("plaatsregio").textContent === "Noord-Holland, Nederland");

      /* Gelijknamige bewaarde plaatsen zijn van elkaar te onderscheiden. */
      const chips = await page.evaluate(() => {
        onthoudRegio(60.392, 5.324, "Vestland");
        localStorage.setItem("weerbriefing.lijst", JSON.stringify([
          { lat: S.lat, lon: S.lon, label: "Bergen", land: "NL" },
          { lat: 60.392, lon: 5.324, label: "Bergen", land: "NO" },
          { lat: 52.09, lon: 5.12, label: "Utrecht", land: "NL" }
        ]));
        chips();
        return [...document.querySelectorAll("#chips .chipplaats")].map(b => b.textContent);
      });
      assert.deepStrictEqual(chips, ["Bergen (Noord-Holland, Nederland)", "Bergen (Vestland, Noorwegen)", "Utrecht"], "gelijknamige bewaarde plaatsen");

      /* Geen zoekgeschiedenis: een regio van een niet-bewaarde, niet-getoonde
         plaats verdwijnt zodra een volgende plaats wordt gekozen. */
      const opslag = await page.evaluate(() => {
        onthoudRegio(51.44, 5.47, "Noord-Brabant");
        onthoudRegio(50.85, 5.69, "Limburg");
        return Object.keys(JSON.parse(localStorage.getItem("weerbriefing.regio") || "{}")).sort();
      });
      assert.deepStrictEqual(opslag, ["50.850,5.690", "52.669,4.701", "60.392,5.324"], "regio-opslag bewaart alleen de gekozen, getoonde en bewaarde plaatsen");

      /* F04: bron bij de ophaaltijd, ook bij de reservebron. */
      const stempel = await page.evaluate(() => document.getElementById("stamp").textContent);
      assert(/^Gegevens opgehaald om \d{2}:\d{2} · .+ · Open-Meteo$/.test(stempel), "bron ontbreekt bij de ophaaltijd: " + stempel);
      const reserve = await page.evaluate(() => { S.d.provider = "visualcrossing"; stempel(); const t = document.getElementById("stamp").textContent; S.d.provider = "weatherapi"; stempel(); return [t, document.getElementById("stamp").textContent]; });
      assert(reserve[0].endsWith(" · reservebron Visual Crossing") && reserve[1].endsWith(" · reservebron WeatherAPI"), "reservebron niet zichtbaar: " + reserve);

      /* F10: zichtbare link onder de grafiek; de tabel blijft dicht tot een klik. */
      const link = await page.evaluate(() => {
        const d = document.getElementById("chartdata"), s = d && d.querySelector(":scope > summary");
        s.scrollIntoView({ block: "center" });
        const r = s.getBoundingClientRect(), stijl = getComputedStyle(s);
        return { open: d.open, tekst: s.textContent.trim(), b: r.width, h: r.height, links: r.left, rechts: r.right, zicht: stijl.visibility, klik: stijl.pointerEvents, hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === s };
      });
      assert.strictEqual(link.open, false, "grafiektabel moet standaard dicht blijven");
      assert.strictEqual(link.tekst, "Grafiekgegevens als tabel");
      assert(link.b > 40 && link.h >= 24 && link.links >= 0 && link.rechts <= breedte && link.zicht === "visible" && link.klik !== "none" && link.hit, `${breedte}px: tabel-link is niet zichtbaar of klikbaar: ${JSON.stringify(link)}`);
      await page.click("#chartdata > summary");
      assert(await page.evaluate(() => document.getElementById("chartdata").open), "klik op de link opent de grafiektabel");

      assert.deepStrictEqual(fouten, [], "paginafouten: " + fouten.join(" | "));
      await ctx.close();
    }

    /* Engels: land in het Engels, regio onvertaald (komt al uit de geocoder), stempel vertaald. */
    taal = "en";
    const { ctx, page, fouten } = await open(browser, port, 390);
    await page.evaluate(() => { onthoudRegio(S.lat, S.lon, "North Holland"); toonPlaatsRegio(); });
    await page.waitForTimeout(300);
    const en = await page.evaluate(() => ({ regio: document.getElementById("plaatsregio").textContent, stempel: document.getElementById("stamp").textContent, link: document.querySelector("#chartdata > summary").textContent.trim() }));
    assert.strictEqual(en.regio, "North Holland, Netherlands");
    assert(/^Loaded at \d{2}:\d{2} · .+ · Open-Meteo$/.test(en.stempel), "Engelse stempel: " + en.stempel);
    assert.strictEqual(en.link, "Chart data as a table");
    assert.deepStrictEqual(fouten, [], "paginafouten (en): " + fouten.join(" | "));
    await ctx.close();

    console.log("Audit-zichtbaarheid groen (390 en 1366px, NL en EN): regio en land onder de plaatsnaam, onderscheidbare gelijknamige bewaarde plaatsen, verwachtingsbron en reservebron bij de ophaaltijd, zichtbare en klikbare link naar de grafiektabel.");
  } finally {
    await browser.close();
    server.close();
  }
});
