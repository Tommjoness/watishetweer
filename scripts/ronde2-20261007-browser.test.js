"use strict";

/* Ontwerpronde 2, gemeten op het definitieve artifact: de stip van nu staat
   op de dagbalk van vandaag op de huidige temperatuur, de donkere modus heeft
   de nieuwe kleuren (ook op een subpagina), de wolken van de nieuwe iconenset
   hebben hun zachte vulling en de balken verschijnen alleen zacht als het
   apparaat geen beperkte beweging vraagt. */

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");
const { stub } = require("./taal-catalogus-browser.js");
const { SCENARIOS } = require("./taal-scenarios.js");

const PUBLIC = path.join(__dirname, "..", "public");
const TYPES = { ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };

/* Een week met wisselend weer en temperaturen; nu is het 17°. */
const MIN = [12, 10, 7, 4, -2, 8, 6], MAX = [21, 17, 13, 9, 2, 15, 11], CODE = [1, 2, 3, 61, 71, 95, 45], NU = 17;
const SCENARIO = { ...SCENARIOS[0], forecast: () => {
  const d = SCENARIOS[0].forecast();
  d.daily.weather_code = d.daily.time.map((_, i) => CODE[i % 7]);
  d.daily.temperature_2m_min = d.daily.time.map((_, i) => MIN[i % 7]);
  d.daily.temperature_2m_max = d.daily.time.map((_, i) => MAX[i % 7]);
  d.current.temperature_2m = NU;
  return d;
} };

const server = http.createServer((req, res) => {
  const pad = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(PUBLIC, pad.endsWith("/") ? pad + "index.html" : pad);
  if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  if (f.endsWith(".html")) {
    let html = fs.readFileSync(f, "utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi, "");
    if (pad === "/") html = html.replace("<head>", "<head>" + stub(SCENARIO, ""));
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(html);
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

server.listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: require("./vind-browser.js").vindBrowser() || undefined });
  try {
    for (const [breedte, thema, beweging] of [[1366, "dark", "no-preference"], [1366, "light", "reduce"]]) {
      const ctx = await browser.newContext({ viewport: { width: breedte, height: 900 }, colorScheme: thema, reducedMotion: beweging });
      const page = await ctx.newPage();
      const fouten = [];
      page.on("pageerror", e => fouten.push(e.message));
      await page.goto(`http://127.0.0.1:${port}/?lat=52.669&lon=4.701&plaats=Bergen&land=NL`, { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector("#days .row.day:not(.kop) .bar .nu-stip") && document.querySelector("#nights .row.night:not(.kop) .sbar i"), null, { timeout: 20000 });
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => {
        const stippen = [...document.querySelectorAll("#days .nu-stip")];
        const stip = stippen[0], balk = stip.parentElement, rij = stip.closest(".row.day");
        const s = stip.getBoundingClientRect(), b = balk.getBoundingClientRect();
        const wolk = [...document.querySelectorAll("#days .dico svg.ico path")].some(p => p.getAttribute("fill-opacity") === ".08");
        return {
          aantal: stippen.length, rijIndex: [...document.querySelectorAll("#days .row.day:not(.kop)")].indexOf(rij),
          fractie: (s.left + s.width / 2 - b.left) / b.width, kleur: getComputedStyle(stip).backgroundColor,
          achtergrond: getComputedStyle(document.body).backgroundColor, inkt: getComputedStyle(document.body).color,
          wolk, animatie: getComputedStyle(document.querySelector("#days .row.day:not(.kop) .bar i")).animationName
        };
      });
      const v = `${breedte}px ${thema} ${beweging}`;
      assert.strictEqual(m.aantal, 1, `${v}: niet precies één nu-stip`);
      assert.strictEqual(m.rijIndex, 0, `${v}: nu-stip staat niet op de rij van vandaag`);
      const lo = Math.min(...MIN), hi = Math.max(...MAX);
      assert(Math.abs(m.fractie - (NU - lo) / (hi - lo)) < 0.01, `${v}: nu-stip niet op ${NU}°: ${m.fractie}`);
      assert(m.wolk, `${v}: wolk van de nieuwe iconenset zonder zachte vulling`);
      if (thema === "dark") {
        assert.strictEqual(m.achtergrond, "rgb(12, 15, 14)", `${v}: donkere achtergrond niet vernieuwd`);
        assert.strictEqual(m.inkt, "rgb(233, 231, 226)", `${v}: donkere inkt niet vernieuwd`);
        assert.strictEqual(m.kleur, "rgb(224, 122, 134)", `${v}: nu-stip niet in karmijn`);
      }
      assert.strictEqual(m.animatie, beweging === "reduce" ? "none" : "wiw-verschijn", `${v}: balkovergang klopt niet bij ${beweging}`);
      assert.deepStrictEqual(fouten, [], `${v}: scriptfouten`);
      await ctx.close();
    }
    /* Subpagina in donker: dezelfde nieuwe kleuren. */
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
    const page = await ctx.newPage();
    await page.route(/open-meteo|posthog|google/, r => r.abort());
    await page.goto(`http://127.0.0.1:${port}/witte-kerst/`, { waitUntil: "load" });
    await page.waitForFunction(() => document.documentElement.getAttribute("data-thema") === "donker", null, { timeout: 10000 });
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(12, 15, 14)", "/witte-kerst/ donker: achtergrond niet vernieuwd");
    await ctx.close();
    console.log("Ronde 2 zichtbaar op het artifact: nu-stip op vandaag, nieuwe donkere kleuren (app en subpagina), iconen met zachte vulling, overgangen alleen zonder beperkte beweging.");
  } finally {
    await browser.close();
    server.close();
  }
});
