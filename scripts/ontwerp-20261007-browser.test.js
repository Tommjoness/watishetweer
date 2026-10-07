"use strict";

/* Ontwerpronde 7 oktober, gemeten op het definitieve artifact: de dagbalk
   heeft een kleurverloop van min naar max, de zichtscorebalk is 5px en
   afgerond, de maantjes zijn 18px, het weericoon bij de huidige temperatuur is
   groter en de temperatuurcijfers in de grafiek staan in de gewone letter. */

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");
const { stub } = require("./taal-catalogus-browser.js");
const { SCENARIOS } = require("./taal-scenarios.js");

const PUBLIC = path.join(__dirname, "..", "public");
const TYPES = { ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };

const server = http.createServer((req, res) => {
  const pad = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(PUBLIC, pad.endsWith("/") ? pad + "index.html" : pad);
  if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  if (f.endsWith(".html")) {
    const html = fs.readFileSync(f, "utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi, "").replace("<head>", "<head>" + stub(SCENARIOS[0], ""));
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
    for (const [breedte, thema] of [[1366, "light"], [390, "dark"]]) {
      const ctx = await browser.newContext({ viewport: { width: breedte, height: 900 }, colorScheme: thema });
      const page = await ctx.newPage();
      const fouten = [];
      page.on("pageerror", e => fouten.push(e.message));
      await page.goto(`http://127.0.0.1:${port}/?lat=52.669&lon=4.701&plaats=Bergen&land=NL`, { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector("#days .row.day:not(.kop) .bar i") && document.querySelector("#nights .row.night:not(.kop) .sbar") && document.querySelector("#chart text"), null, { timeout: 20000 });
      const m = await page.evaluate(() => {
        const cs = el => el ? getComputedStyle(el) : null;
        const balk = document.querySelector("#days .row.day:not(.kop) .bar i");
        const sbar = document.querySelector("#nights .row.night:not(.kop) .sbar");
        const label = [...document.querySelectorAll("#chart text")].find(t => (t.getAttribute("font-family") || "").startsWith("Bodoni"));
        const maan = document.querySelector("#moonlab .maan-fase-svg-v2");
        const icoon = document.querySelector("#nowicon svg.ico");
        return {
          verloop: cs(balk).backgroundImage, balkHoogte: cs(balk).height,
          sbarHoogte: sbar.getBoundingClientRect().height, sbarRond: cs(sbar).borderTopLeftRadius,
          letter: label ? cs(label).fontFamily : null,
          maan: maan ? maan.getBoundingClientRect().width : null,
          icoon: icoon ? icoon.getBoundingClientRect().width : null
        };
      });
      const v = `${breedte}px ${thema}`;
      assert(/linear-gradient\(90deg, rgb\(\d+, \d+, \d+\), rgb\(\d+, \d+, \d+\)\)/.test(m.verloop), `${v}: dagbalk heeft geen kleurverloop: ${m.verloop}`);
      assert.strictEqual(m.balkHoogte, "6px", `${v}: dagbalk is geen 6px`);
      assert(Math.abs(m.sbarHoogte - 5) < 0.5 && m.sbarRond === "3px", `${v}: zichtscorebalk niet 5px en afgerond: ${JSON.stringify(m)}`);
      assert(m.letter && /^"?Instrument Sans/.test(m.letter), `${v}: grafiekcijfers niet in de gewone letter: ${m.letter}`);
      assert(Math.abs(m.maan - 18) < 0.5, `${v}: maantje niet 18px: ${m.maan}`);
      assert(Math.abs(m.icoon - 58) < 0.5, `${v}: weericoon niet 58px: ${m.icoon}`);
      assert.deepStrictEqual(fouten, [], `${v}: scriptfouten`);
      await ctx.close();
    }
    console.log("Ontwerpronde 7 oktober zichtbaar op het artifact: dagbalk met kleurverloop, zichtscorebalk, maantjes, weericoon en grafiekcijfers (desktop licht, mobiel donker).");
  } finally {
    await browser.close();
    server.close();
  }
});
