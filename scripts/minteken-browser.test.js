"use strict";

/* Grote temperatuurcijfers krijgen een echt minteken (U+2212): in Bodoni is
   het koppelteken zo kort en laag dat "-1" op het oog als "1" leest
   (winteranalyse, eigenaar akkoord 8 oktober). Gemeten op het definitieve
   artifact: hoofdweergave en vaste balk, bij vorst en bij plusgraden. */

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");
const { stub } = require("./taal-catalogus-browser.js");
const { SCENARIOS } = require("./taal-scenarios.js");

const PUBLIC = path.join(__dirname, "..", "public");
const VORST = SCENARIOS.find(s => s.naam === "vorst-sneeuw");
const ZOMER = SCENARIOS[0];
assert(VORST, "scenario vorst-sneeuw ontbreekt");
const TYPES = { ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };

let actief = VORST;
const server = http.createServer((req, res) => {
  const pad = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(PUBLIC, pad.endsWith("/") ? pad + "index.html" : pad);
  if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  if (f.endsWith(".html")) {
    const html = fs.readFileSync(f, "utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi, "").replace("<head>", "<head>" + stub(actief, ""));
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
    for (const sc of [VORST, ZOMER]) {
      actief = sc;
      const verwacht = Math.round(sc.forecast().current.temperature_2m);
      for (const breedte of [390, 1366]) {
        const ctx = await browser.newContext({ viewport: { width: breedte, height: 800 } });
        const page = await ctx.newPage();
        await page.goto(`http://127.0.0.1:${port}${sc.url}`, { waitUntil: "load" });
        await page.waitForFunction(() => /\d/.test((document.getElementById("t") || {}).textContent || "") && /\d/.test((document.getElementById("minitemp") || {}).textContent || ""), null, { timeout: 20000 });
        await page.evaluate(() => { if (typeof minibarBij === "function") minibarBij(); });
        const m = await page.evaluate(() => ({ t: document.getElementById("t").textContent.trim(), mini: document.getElementById("minitemp").textContent.trim() }));
        const tekst = verwacht < 0 ? "−" + Math.abs(verwacht) : String(verwacht);
        assert.strictEqual(m.t, tekst, `${sc.naam} ${breedte}px: hoofdtemperatuur "${m.t}", verwacht "${tekst}"`);
        assert.strictEqual(m.mini, tekst + "°C", `${sc.naam} ${breedte}px: vaste balk "${m.mini}", verwacht "${tekst}°C"`);
        assert(!/-/.test(m.t + m.mini), `${sc.naam} ${breedte}px: nog een koppelteken als minteken`);
        await ctx.close();
      }
      if (sc === VORST) assert(verwacht < 0, "vorstscenario levert geen negatieve temperatuur");
    }
    console.log("Minteken: hoofdweergave en vaste balk tonen vorst met een echt minteken (−), plusgraden zonder teken (mobiel en desktop).");
  } finally {
    await browser.close();
    server.close();
  }
});
