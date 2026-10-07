"use strict";

/* De vaste balk bovenin (zichtbaar na scrollen) toont de omschrijving in
   dezelfde schrijfwijze als de hoofdweergave: "Geheel bewolkt", niet
   "geheel bewolkt" (eigenaar, 7 oktober). Gemeten op het definitieve
   artifact, mobiel en desktop. */

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");
const { stub } = require("./taal-catalogus-browser.js");
const { SCENARIOS } = require("./taal-scenarios.js");

const PUBLIC = path.join(__dirname, "..", "public");
/* Bewolkt met bekende bewolkingslagen: dan schrijft ook de
   bewolkingslaag de omschrijving, zoals in Almere op 7 oktober. */
const SCENARIO = { ...SCENARIOS[0], forecast: () => {
  const d = SCENARIOS[0].forecast();
  Object.assign(d.current, { weather_code: 3, cloud_cover: 100, cloud_cover_low: 95, cloud_cover_mid: 60, cloud_cover_high: 20 });
  return d;
} };
const TYPES = { ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };

const server = http.createServer((req, res) => {
  const pad = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(PUBLIC, pad.endsWith("/") ? pad + "index.html" : pad);
  if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  if (f.endsWith(".html")) {
    const html = fs.readFileSync(f, "utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi, "").replace("<head>", "<head>" + stub(SCENARIO, ""));
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(html);
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

/* Welke laag als laatste de omschrijving schrijft, hangt af van het weer.
   Daarom ook een controle op de gebouwde scripts: nergens mag de balk de
   omschrijving in kleine letters zetten. */
const scripts = fs.readdirSync(PUBLIC).filter(n => /\.js$/.test(n)).map(n => fs.readFileSync(path.join(PUBLIC, n), "utf8"));
const kleineLetters = scripts.flatMap(bron => bron.match(/getElementById\("minicond"\)[\s\S]{0,260}?toLowerCase\(\)/g) || []).filter(m => !/getElementById\("(?!minicond)[a-z]+"\)[\s\S]*?toLowerCase\(\)$/.test(m.slice(28)));
assert.deepStrictEqual(kleineLetters.map(m => m.slice(-120)), [], "gebouwde scripts zetten de omschrijving in de balk nog in kleine letters");

server.listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: require("./vind-browser.js").vindBrowser() || undefined });
  try {
    for (const breedte of [390, 1366]) {
      const ctx = await browser.newContext({ viewport: { width: breedte, height: 800 } });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${port}/?lat=52.669&lon=4.701&plaats=Bergen&land=NL`, { waitUntil: "load" });
      await page.waitForFunction(() => /\S/.test((document.getElementById("cond") || {}).textContent || "") && /\S/.test((document.getElementById("minicond") || {}).textContent || ""), null, { timeout: 20000 });
      await page.mouse.wheel(0, 1600);
      /* Zoals bij iedere verversing: de balk en de meters opnieuw laten tekenen,
         zodat elke laag die de omschrijving schrijft aan de beurt komt. */
      await page.evaluate(() => { if (typeof meters === "function") meters(); if (typeof minibarBij === "function") minibarBij(); });
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => ({ hoofd: document.getElementById("cond").textContent.trim(), balk: document.getElementById("minicond").textContent.trim(), titel: document.getElementById("minicond").title }));
      assert(/bewolkt$/.test(m.hoofd), `${breedte}px: scenario toont geen bewolkingsomschrijving maar "${m.hoofd}"`);
      assert(/^\p{Lu}/u.test(m.balk), `${breedte}px: omschrijving in de balk begint niet met een hoofdletter: "${m.balk}"`);
      assert.strictEqual(m.titel, m.balk, `${breedte}px: titel van de balk wijkt af van de tekst`);
      assert.strictEqual(m.balk, m.hoofd, `${breedte}px: balk "${m.balk}" wijkt af van de hoofdweergave "${m.hoofd}"`);
      await ctx.close();
    }
    console.log("Vaste balk: omschrijving in dezelfde schrijfwijze als de hoofdweergave (mobiel en desktop).");
  } finally {
    await browser.close();
    server.close();
  }
});
