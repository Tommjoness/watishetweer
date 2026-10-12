"use strict";

/* Voorjaars-, mei- en zomervakantie (soort "vakantie") in de echte build, plus
   de zie-ook-links tussen de kerstpagina's (eigenaar, 12 oktober). Per pagina
   één moment vóór en één tijdens de vakantie, mobiel en desktop, Nederlands en
   Engels; in het Engels mag geen tekst onvertaald blijven. */

const fs = require("fs");
const path = require("path");
const http = require("http");
const assert = require("assert");
const { chromium } = require("playwright");
const { SEIZOENSPAGINAS } = require("./seizoenspagina.config.js");

const PUBLIC = path.join(__dirname, "..", "public");
for (const slug of ["voorjaarsvakantie", "meivakantie", "zomervakantie"]) if (!fs.existsSync(path.join(PUBLIC, slug, "index.html"))) throw new Error(`public/${slug}/index.html ontbreekt; draai eerst de build.`);

const mime = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png", ".css": "text/css; charset=utf-8" };
const server = http.createServer((req, res) => {
  const pathname = (req.url || "/").split("?")[0];
  const rel = (pathname.endsWith("/") ? pathname + "index.html" : pathname).replace(/^\//, "");
  const file = path.join(PUBLIC, rel);
  if (file.startsWith(PUBLIC + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { "content-type": mime[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res); return;
  }
  res.writeHead(404); res.end("not found");
});

/* Open-Meteo: 7 droge dagen met zon vanaf `start`, voor alle plaatsen. */
function antwoord(cfg, start) {
  const dagen = []; const t0 = Date.parse(start + "T00:00:00Z");
  for (let i = 0; i < 7; i++) dagen.push(new Date(t0 + i * 864e5).toISOString().slice(0, 10));
  return cfg.plaatsen.map(p => ({
    latitude: p.lat, longitude: p.lon, timezone: "Europe/Amsterdam", utc_offset_seconds: 3600,
    daily: { time: dagen, temperature_2m_min: dagen.map(() => 4.1), temperature_2m_max: dagen.map(() => 11.3), precipitation_sum: dagen.map(() => 0), snowfall_sum: dagen.map(() => 0), precipitation_probability_max: dagen.map(() => 10), sunshine_duration: dagen.map(() => 6 * 3600) }
  }));
}

const GEVALLEN = [
  { slug: "voorjaarsvakantie", nu: "2026-10-12T10:00:00Z", kop: "Voorjaarsvakantie 2027", aftellen: "124 dagen tot de voorjaarsvakantie in regio zuid", tabellen: 0, en: { kop: "Spring school holiday 2027", aftellen: "124 days to go until the spring school holiday in the southern region" } },
  { slug: "voorjaarsvakantie", nu: "2027-02-20T10:00:00Z", start: "2027-02-20", kop: "Voorjaarsvakantie 2027", aftellen: "Het is overal voorjaarsvakantie.", tabellen: 7, koppen: ["Zaterdag 20 februari alle regio's", "Maandag 22 februari regio noord en midden"], en: { aftellen: "It is the spring school holiday everywhere." } },
  { slug: "meivakantie", nu: "2026-10-12T10:00:00Z", kop: "Meivakantie 2027", aftellen: "194 dagen tot de meivakantie", tabellen: 0, en: { kop: "May school holiday 2027", aftellen: "194 days to go until the May school holiday" } },
  { slug: "meivakantie", nu: "2027-04-27T09:00:00Z", start: "2027-04-27", kop: "Meivakantie 2027", aftellen: "Het is meivakantie.", tabellen: 6, koppen: ["Dinsdag 27 april alle regio's", "Zondag 2 mei alle regio's"], en: { aftellen: "It is the May school holiday." } },
  { slug: "zomervakantie", nu: "2027-08-25T09:00:00Z", start: "2027-08-25", kop: "Zomervakantie 2027", aftellen: "Het is zomervakantie in regio midden en zuid.", tabellen: 7, koppen: ["Woensdag 25 augustus regio midden en zuid", "Maandag 30 augustus regio zuid"], en: { aftellen: "It is the summer school holiday in the central and southern regions." } }
];

server.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: require("./vind-browser.js").vindBrowser() || undefined });
  let gemeten = 0;
  try {
    for (const g of GEVALLEN) for (const taal of ["nl", "en"]) for (const breedte of [390, 1366]) {
      const cfg = SEIZOENSPAGINAS.find(p => p.slug === g.slug);
      const context = await browser.newContext({ viewport: { width: breedte, height: breedte < 700 ? 844 : 900 } });
      const page = await context.newPage();
      const fouten = [];
      page.on("pageerror", e => fouten.push(e.message));
      await page.addInitScript(t => { try { localStorage.clear(); if (t === "en") localStorage.setItem("weerbriefing.taal.v1", "en"); } catch (e) { } }, taal);
      await page.clock.setFixedTime(new Date(g.nu));
      await page.route("https://api.open-meteo.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(antwoord(cfg, g.start || g.nu.slice(0, 10))) }));
      await page.goto(`${base}/${g.slug}/`, { waitUntil: "load" });
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => ({
        kop: document.getElementById("seizoen-kop").textContent.trim(),
        aftellen: document.getElementById("seizoen-aftellen").hidden ? "" : document.getElementById("seizoen-aftellen").textContent.replace(/\s+/g, " ").trim(),
        tabellen: document.querySelectorAll("#seizoen-verwachting .seizoen-dag").length,
        koppen: [...document.querySelectorAll("#seizoen-verwachting .seizoen-dag h3")].map(h => h.textContent.replace(/\s+/g, " ").trim()),
        overloop: document.documentElement.scrollWidth - innerWidth,
        ontbreekt: window.__WIW_TAAL_ONTBREEKT__ ? [...window.__WIW_TAAL_ONTBREEKT__] : null
      }));
      const label = `${g.slug} ${g.nu.slice(0, 10)} ${taal} ${breedte}px`;
      assert.deepEqual(fouten, [], `${label}: scriptfouten`);
      assert(m.overloop <= 0, `${label}: horizontale overloop ${m.overloop}px`);
      if (taal === "nl") {
        assert.equal(m.kop, g.kop, `${label}: kop`);
        assert.equal(m.aftellen, g.aftellen, `${label}: aftellen`);
        assert.equal(m.tabellen, g.tabellen, `${label}: aantal dagtabellen`);
        for (const k of g.koppen || []) assert(m.koppen.includes(k), `${label}: dagkop "${k}" ontbreekt (${m.koppen.join(" | ")})`);
      } else {
        assert.deepEqual(m.ontbreekt, [], `${label}: onvertaalde teksten`);
        if (g.en.kop) assert.equal(m.kop, g.en.kop, `${label}: kop`);
        assert.equal(m.aftellen, g.en.aftellen, `${label}: aftellen`);
      }
      gemeten++;
      await context.close();
    }

    /* Zie-ook-links tussen de kerstpagina's, ook in het Engels. */
    for (const [slug, verwacht] of [["kerstvakantie", ["/witte-kerst/", "/oud-en-nieuw/"]], ["witte-kerst", ["/kerstvakantie/", "/oud-en-nieuw/"]], ["oud-en-nieuw", ["/witte-kerst/", "/kerstvakantie/"]]]) for (const taal of ["nl", "en"]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await page.addInitScript(t => { try { localStorage.clear(); if (t === "en") localStorage.setItem("weerbriefing.taal.v1", "en"); } catch (e) { } }, taal);
      await page.clock.setFixedTime(new Date("2026-10-12T10:00:00Z"));
      await page.route("https://api.open-meteo.com/**", route => route.fulfill({ status: 503, body: "{}" }));
      await page.goto(`${base}/${slug}/`, { waitUntil: "load" });
      await page.waitForTimeout(700);
      const z = await page.evaluate(() => { const p = document.querySelector(".seizoen-zieook"); return p ? { tekst: p.textContent.replace(/\s+/g, " ").trim(), links: [...p.querySelectorAll("a")].map(a => a.getAttribute("href")) } : null; });
      assert(z, `${slug} ${taal}: zie-ook ontbreekt`);
      assert.deepEqual(z.links, verwacht, `${slug} ${taal}: zie-ook-links`);
      assert(taal === "nl" ? /^Zie ook /.test(z.tekst) : /^See also /.test(z.tekst) && !/Zie ook|Kerstvakantie|Witte kerst|Oud en nieuw/.test(z.tekst), `${slug} ${taal}: zie-ook-tekst "${z.tekst}"`);
      await context.close();
    }
    console.log(`Vakanties: ${gemeten} weergaven (voorjaar, mei, zomer; vóór en tijdens; NL/EN; 390/1366 px) kloppen; zie-ook-links tussen de kerstpagina's in NL en EN.`);
  } finally {
    await browser.close();
    server.close();
  }
});
