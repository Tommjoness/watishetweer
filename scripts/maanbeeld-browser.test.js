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
   6. het maanicoon van de app staat op het zuidelijk halfrond ondersteboven;
   7. stand, op- en ondergang en tijdzone gelden voor de eigen plaats uit de
      app (wereldwijd), anders voor De Bilt. */

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

/* Onafhankelijke controle: de richting van de maan naar de zon aan de hemel, in
   het horizonstelsel van de waarnemer, als hoek tegen de klok in vanaf "boven". */
const { zonMaanBron } = require("./nachtzicht-bron.js");
const H = new Function(zonMaanBron() + ";return {zonPositie,maanPositie,gmstVan};")();
const GR = Math.PI / 180;
function horizon(pos, D, lat, lon) {
  const u = ((H.gmstVan(D) + lon - pos.ra) % 360 + 360) % 360 * GR, d = pos.dec * GR, f = lat * GR;
  const alt = Math.asin(Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(u));
  const az = Math.atan2(Math.sin(u), Math.cos(u) * Math.sin(f) - Math.tan(d) * Math.cos(f)) + Math.PI;
  return { alt, az, v: [Math.cos(alt) * Math.sin(az), Math.cos(alt) * Math.cos(az), Math.sin(alt)] };
}
function zonRichting(ms, lat, lon) {
  const D = ms / 86400000 + 2440587.5 - 2451545.0, m = horizon(H.maanPositie(D), D, lat, lon), z = horizon(H.zonPositie(D), D, lat, lon);
  const boven = [-Math.sin(m.alt) * Math.sin(m.az), -Math.sin(m.alt) * Math.cos(m.az), Math.cos(m.alt)], rechts = [Math.cos(m.az), -Math.sin(m.az), 0];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return (Math.atan2(-dot(z.v, rechts), dot(z.v, boven)) / GR + 360) % 360;
}
const hoekVerschil = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

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
    const draai = Number(c.getAttribute("data-draai")), rand = Number(c.getAttribute("data-rand"));
    /* Richting van het licht: zwaartepunt van de helderheid, als hoek tegen de klok
       in vanaf boven; en de helderste rand aan de lichte en de donkere kant. */
    const p = (rand - draai) * Math.PI / 180, ux = -Math.sin(p), uy = -Math.cos(p);
    let sx = 0, sy = 0, som = 0, randLicht = 0, randDonker = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = x + 0.5 - r, dy = y + 0.5 - r, afst = Math.hypot(dx, dy) / r;
      if (afst > 0.97) continue;
      const i = (y * n + x) * 4, l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      sx += dx * l; sy += dy * l; som += l;
      if (afst > 0.85) { const lang = (dx * ux + dy * uy) / (afst * r); if (lang > 0.9) randLicht = Math.max(randLicht, l); if (lang < -0.9) randDonker = Math.max(randDonker, l); }
    }
    const lichtHoek = ((Math.atan2(-sx / som, -sy / som) * 180 / Math.PI) + 360) % 360;
    const hoek = d[3];
    return { canvas: true, lichtHoek, randLicht, randDonker, hoek, draai, rand, iconen };
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
        /* De stand is die van de kern op het moment dat de maan daar te zien is,
           en het licht wijst op het scherm naar de zon (onafhankelijk berekend
           in het horizonstelsel). */
        const plek = ref || { lat: 52.1009, lon: 5.1801 }, st = K.maanStand(Date.parse(iso), plek.lat, plek.lon);
        assert(Math.abs(m.draai - st.draai) < 0.06, `${label}: stand ${m.draai}, verwacht ${st.draai}`);
        assert(hoekVerschil(m.rand - m.draai, zonRichting(st.moment, plek.lat, plek.lon)) < 2, `${label}: lichte rand wijst niet naar de zon`);
        if (pct >= 10) assert(hoekVerschil(m.lichtHoek, m.rand - m.draai) < 25, `${label}: licht op het beeld staat op ${m.lichtHoek.toFixed(0)}°, verwacht ${(m.rand - m.draai).toFixed(0)}°`);
        /* Een smalle sikkel: de verlichte rand is duidelijk lichter dan de tegenoverliggende. */
        assert(m.randLicht > m.randDonker + 25, `${label}: sikkel niet zichtbaar (licht ${m.randLicht.toFixed(0)}, donker ${m.randDonker.toFixed(0)})`);
      }
    }
    console.log("Maanbeeld: NASA-foto met belichting; licht wijst naar de zon in De Bilt en Sydney, ook bij 2%.");

    /* Rond de evenaar staat de maan ondersteboven als hij ten noorden van het zenit culmineert. */
    referentie = { naam: "Quito", lat: -0.18, lon: -78.47 };
    for (const iso of ["2026-10-15T21:00:00+02:00", "2026-10-26T06:00:00+01:00"]) {
      const m = await meet(browser, port, iso), verwacht = K.maanStand(Date.parse(iso), -0.18, -78.47).draai;
      assert(Math.abs(m.draai - verwacht) < 0.06, `Quito ${iso}: stand ${m.draai}, verwacht ${verwacht}`);
    }
    referentie = null;
    console.log("Maanbeeld: rond de evenaar volgt de stand de echte hoek (sikkel op zijn kant).");

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

    /* Eigen plaats (eigenaar, 12 oktober, wereldwijd): de plaats uit de app
       (zelfde browseropslag) bepaalt stand, op- en ondergang en tijdzone. Buiten
       Nederland komt de tijdzone uit de bewaarde verwachting van die plaats;
       ontbreekt die, dan blijft het De Bilt. */
    const iso = "2026-10-12T17:30:00+02:00";
    const sydneyData = { d: { timezone: "Australia/Sydney" }, lat: -33.87, lon: 151.21, label: "Sydney", land: "AU" };
    for (const [label, plaats, data, naam, lat, lon, tz, zone] of [
      ["Almere uit de app", { lat: 52.351, lon: 5.265, label: "Almere", land: "NL" }, null, "Almere", 52.351, 5.265, "Europe/Amsterdam", "Nederlandse tijd"],
      ["plaats met provincie", { lat: 50.851, lon: 5.691, label: "Maastricht, Limburg", land: "NL" }, null, "Maastricht", 50.851, 5.691, "Europe/Amsterdam", "Nederlandse tijd"],
      ["Sydney met tijdzone", { lat: -33.87, lon: 151.21, label: "Sydney", land: "AU" }, sydneyData, "Sydney", -33.87, 151.21, "Australia/Sydney", "plaatselijke tijd van Sydney"],
      ["buitenland zonder tijdzone", { lat: -33.87, lon: 151.21, label: "Sydney", land: "AU" }, null, "De Bilt", 52.1009, 5.1801, "Europe/Amsterdam", "Nederlandse tijd"],
      ["geen plaats", null, null, "De Bilt", 52.1009, 5.1801, "Europe/Amsterdam", "Nederlandse tijd"],
      ["kapotte opslag", "{kapot", null, "De Bilt", 52.1009, 5.1801, "Europe/Amsterdam", "Nederlandse tijd"]
    ]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      const fouten = []; page.on("pageerror", e => fouten.push(e.message));
      await page.addInitScript(([p, d]) => { try { localStorage.clear(); if (p !== null) localStorage.setItem("weerbriefing.plaats", typeof p === "string" ? p : JSON.stringify(p)); if (d) localStorage.setItem("weerbriefing.data", JSON.stringify(d)); } catch (e) { } }, [plaats, data]);
      await page.clock.setFixedTime(new Date(iso));
      await page.goto(`http://127.0.0.1:${port}/maan/`, { waitUntil: "load" });
      await page.waitForFunction(() => /Vandaag/.test((document.getElementById("nz-maan-tijden") || {}).textContent || "") && document.querySelector("#nz-maan-schijf canvas"), null, { timeout: 15000 });
      const m = await page.evaluate(() => ({ tijden: document.getElementById("nz-maan-tijden").textContent, plaats: document.getElementById("nz-maan-plaats").textContent, stand: document.getElementById("nz-maan-standplaats").textContent, zone: document.getElementById("nz-maan-tijdzone").textContent, elders: document.getElementById("nz-maan-elders").hidden, draai: Number(document.querySelector("#nz-maan-schijf canvas").getAttribute("data-draai")) }));
      const ref = K.maanOverzicht(Date.parse(iso), lat, lon, tz);
      const verwacht = `Vandaag in ${naam}: ` + [["op", ref.op], ["onder", ref.onder]].filter(x => x[1]).sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)).map(x => x[0] + " " + x[1]).join(", ") + ".";
      assert.strictEqual(m.tijden, verwacht, `${label}: maantijden`);
      assert.strictEqual(m.plaats, naam, `${label}: kleine letters noemen de plaats`);
      assert.strictEqual(m.stand, naam, `${label}: stand vanuit de plaats`);
      assert.strictEqual(m.zone, zone, `${label}: tijdzone in de kleine letters`);
      assert.strictEqual(m.elders, tz !== "Europe/Amsterdam", `${label}: zin over elders in Nederland`);
      assert(Math.abs(m.draai - ref.draai) < 0.06, `${label}: stand ${m.draai}, verwacht ${ref.draai}`);
      assert.deepStrictEqual(fouten, [], `${label}: scriptfouten`);
      await ctx.close();
    }
    console.log("Maanbeeld: stand, op- en ondergang en tijdzone voor de eigen plaats uit de app, wereldwijd; anders De Bilt.");
  } finally {
    await browser.close();
    server.close();
  }
});
