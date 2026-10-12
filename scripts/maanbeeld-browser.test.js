"use strict";

/* De maan op /maan/ (eigenaar 12 oktober 2026: "akkoord als het overal ter
   wereld klopt"), gemeten op het definitieve artifact:
   1. de maan is de NASA-foto met de belichting erover, geen tekening;
   2. het licht zit aan de goede kant: in Nederland wassend rechts en afnemend
      links, op het zuidelijk halfrond (referentie Sydney) precies andersom;
   3. ook een sikkel van 2% is zichtbaar;
   4. de stand volgt de breedte: rond de evenaar (Quito) draait hij mee met de
      maan die ten noorden of ten zuiden van het zenit staat;
   5. laadt de foto niet, dan blijft er een tekening staan;
   6. het maanicoon van de app staat op het zuidelijk halfrond ondersteboven. */

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");
const { maanFaseSvgV2 } = require("./mobile-screenshot-polish.js");
const { laadKern } = require("./nachtzicht-bron.js");

const PUBLIC = path.join(__dirname, "..", "public");
const K = laadKern();
let referentie = null;

const TYPES = { ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const pad = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(PUBLIC, pad.endsWith("/") ? pad + "index.html" : pad);
  if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  if (f.endsWith(".html")) {
    let html = fs.readFileSync(f, "utf8");
    if (referentie) html = html.replace(/(<script type="application\/json" id="nz-config">)([\s\S]*?)(<\/script>)/, (_, a, json, b) => {
      const cfg = JSON.parse(json); cfg.referentie = { ...cfg.referentie, ...referentie };
      return a + JSON.stringify(cfg).replace(/</g, "\\u003c") + b;
    });
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(html);
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

/* Helderheid van de grote maan: links tegen rechts en de helderste rand. */
async function meet(browser, port, iso, opties = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark" });
  const page = await ctx.newPage();
  const fouten = [];
  page.on("pageerror", e => fouten.push(e.message));
  if (opties.zonderFoto) await page.route("**/maan.webp", r => r.abort());
  await page.clock.setFixedTime(new Date(iso));
  await page.goto(`http://127.0.0.1:${port}/maan/`, { waitUntil: "load" });
  await page.waitForFunction(zonder => {
    const el = document.querySelector("#nz-maan-schijf");
    if (zonder) return !!(el && el.querySelector("svg.nz-maan-svg"));
    const c = el && el.querySelector("canvas");
    if (!c) return false;
    const d = c.getContext("2d").getImageData(c.width / 2, c.height / 2, 1, 1).data;
    return d[3] > 0;
  }, !!opties.zonderFoto, { timeout: 15000 });
  const m = await page.evaluate(() => {
    const el = document.querySelector("#nz-maan-schijf"), c = el.querySelector("canvas");
    const iconen = [...document.querySelectorAll("#nz-maan-fasen .nz-maan-beeld")].map(x => x.firstElementChild && x.firstElementChild.tagName.toLowerCase());
    if (!c) return { canvas: false, svg: !!el.querySelector("svg"), iconen };
    const n = c.width, d = c.getContext("2d").getImageData(0, 0, n, n).data, r = n / 2;
    let links = 0, rechts = 0, nl = 0, nr = 0, randL = 0, randR = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = x + 0.5 - r, dy = y + 0.5 - r, afst = Math.hypot(dx, dy) / r;
      if (afst > 0.97) continue;
      const i = (y * n + x) * 4, l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      if (dx < 0) { links += l; nl++; } else { rechts += l; nr++; }
      if (afst > 0.85 && Math.abs(dy) < r * 0.4) { if (dx < 0) randL = Math.max(randL, l); else randR = Math.max(randR, l); }
    }
    const hoek = d[3];
    return { canvas: true, links: links / nl, rechts: rechts / nr, randL, randR, hoek, draai: Number(c.getAttribute("data-draai")), rand: Number(c.getAttribute("data-rand")), iconen };
  });
  await ctx.close();
  assert.deepStrictEqual(fouten, [], `${iso}: scriptfouten`);
  return m;
}

server.listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: require("./vind-browser.js").vindBrowser() || undefined });
  try {
    const MOMENTEN = [
      ["2026-10-09T11:20:00+02:00", "afnemend", 2],
      ["2026-10-15T21:00:00+02:00", "wassend", 23],
      ["2026-10-19T21:00:00+02:00", "wassend", 62],
      ["2026-10-30T06:00:00+01:00", "afnemend", 79]
    ];
    for (const [plaats, ref, zuid] of [["De Bilt", null, false], ["Sydney", { naam: "Sydney", lat: -33.87, lon: 151.21 }, true]]) {
      referentie = ref;
      for (const [iso, soort, pct] of MOMENTEN) {
        const m = await meet(browser, port, iso), label = `${plaats} ${iso} (${soort} ${pct}%)`;
        assert(m.canvas, `${label}: geen maanfoto getekend`);
        assert.strictEqual(m.hoek, 0, `${label}: hoek buiten de schijf is niet doorzichtig`);
        assert.deepStrictEqual(m.iconen, ["canvas", "canvas", "canvas", "canvas"], `${label}: fase-icoontjes`);
        assert.strictEqual(m.draai, zuid ? 180 : 0, `${label}: stand ${m.draai}`);
        const lichtRechts = (soort === "wassend") !== zuid;
        if (pct >= 10) assert(lichtRechts ? m.rechts > m.links * 1.5 : m.links > m.rechts * 1.5, `${label}: licht aan de verkeerde kant (links ${m.links.toFixed(0)}, rechts ${m.rechts.toFixed(0)})`);
        /* Een smalle sikkel: de verlichte rand is duidelijk lichter dan de donkere. */
        assert(lichtRechts ? m.randR > m.randL + 25 : m.randL > m.randR + 25, `${label}: sikkel niet zichtbaar (rand links ${m.randL.toFixed(0)}, rechts ${m.randR.toFixed(0)})`);
      }
    }
    console.log("Maanbeeld: NASA-foto met belichting; licht aan de goede kant in De Bilt en Sydney, ook bij 2%.");

    /* Rond de evenaar staat de maan ondersteboven als hij ten noorden van het zenit culmineert. */
    referentie = { naam: "Quito", lat: -0.18, lon: -78.47 };
    for (const iso of ["2026-10-15T21:00:00+02:00", "2026-10-26T06:00:00+01:00"]) {
      const m = await meet(browser, port, iso), verwacht = K.maanStand(Date.parse(iso), -0.18).draai;
      assert.strictEqual(m.draai, verwacht, `Quito ${iso}: stand ${m.draai}, verwacht ${verwacht}`);
    }
    referentie = null;
    console.log("Maanbeeld: rond de evenaar volgt de stand de maan ten noorden of zuiden van het zenit.");

    const zonder = await meet(browser, port, "2026-10-19T21:00:00+02:00", { zonderFoto: true });
    assert(!zonder.canvas && zonder.svg, "zonder foto blijft de tekening staan");
    assert.deepStrictEqual(zonder.iconen, ["svg", "svg", "svg", "svg"], "zonder foto tekeningen als fase-icoontjes");
    console.log("Maanbeeld: zonder foto blijft de tekening staan.");

    /* Het maanicoon van de app. */
    const noord = maanFaseSvgV2(0.2, 14, false), zuidIcoon = maanFaseSvgV2(0.2, 14, true), volZuid = maanFaseSvgV2(0.5, 14, true);
    assert(!noord.includes("rotate(180") && !noord.includes("data-halfrond"), "noordelijk icoon ongedraaid");
    assert(zuidIcoon.includes('<g transform="rotate(180 12 12)">') && zuidIcoon.includes('data-halfrond="zuid"'), "zuidelijk icoon een halve slag gedraaid");
    assert(volZuid.includes("rotate(180"), "ook de volle maan krijgt dezelfde stand");
    console.log("Maanbeeld: app-icoon staat op het zuidelijk halfrond ondersteboven.");
  } finally {
    await browser.close();
    server.close();
  }
});
