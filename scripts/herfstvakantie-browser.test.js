"use strict";

/* Herfstvakantie (soort "vakantie") in de echte, definitieve build: vóór de
   vakantie (aftellen per regio), tijdens de vakantie (tabel per vakantiedag met
   de regio's die vrij zijn), overal vakantie, na de vakantie (volgend jaar) en
   een mislukte verwachting. Mobiel en desktop, Nederlands en Engels; in het
   Engels mag geen tekst onvertaald blijven. */

const fs = require("fs");
const path = require("path");
const http = require("http");
const assert = require("assert");
const { chromium } = require("playwright");
const { SEIZOENSPAGINAS } = require("./seizoenspagina.config.js");

const PUBLIC = path.join(__dirname, "..", "public");
const bestand = path.join(PUBLIC, "herfstvakantie", "index.html");
if (!fs.existsSync(bestand)) throw new Error("public/herfstvakantie/index.html ontbreekt; draai eerst de build.");
const herfst = SEIZOENSPAGINAS.find(p => p.slug === "herfstvakantie");

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

/* Open-Meteo: 7 dagen vanaf `start`; Den Haag (index 3) en Utrecht (4) nat op 13 oktober. */
function antwoord(start) {
  const dagen = []; const t0 = Date.parse(start + "T00:00:00Z");
  for (let i = 0; i < 7; i++) dagen.push(new Date(t0 + i * 864e5).toISOString().slice(0, 10));
  return herfst.plaatsen.map((p, i) => ({
    latitude: p.lat, longitude: p.lon, timezone: "Europe/Amsterdam", utc_offset_seconds: 7200,
    daily: {
      time: dagen,
      temperature_2m_min: dagen.map(() => 7.6), temperature_2m_max: dagen.map(() => 15.4),
      precipitation_sum: dagen.map(d => d === "2026-10-13" && (i === 3 || i === 4) ? 4.2 : d === "2026-10-16" ? 2.1 : 0),
      precipitation_probability_max: dagen.map(d => d === "2026-10-13" ? 70 : 10),
      sunshine_duration: dagen.map(d => d === "2026-10-18" ? 1200 : 7.4 * 3600)
    }
  }));
}

const SCENARIOS = [
  { naam: "voor", nu: "2026-09-20T10:00:00Z", nl: { aftellen: "20 dagen tot de herfstvakantie in regio noord", melding: "Vanaf zondag 4 oktober staat hier de verwachting voor de eerste vakantiedag.", tabellen: 0, fetch: 0 }, en: { kop: "Autumn school holiday 2026", aftellen: "20 days to go until the autumn school holiday in the northern region" } },
  { naam: "noord", nu: "2026-10-12T10:00:00Z", data: antwoord("2026-10-12"), nl: { aftellen: "Het is herfstvakantie in regio noord. In regio midden en zuid begint de vakantie op zaterdag 17 oktober.", samenvatting: "Volgens de huidige verwachting zijn 6 van de 7 vakantiedagen in de verwachting overwegend droog.", tabellen: 7, fetch: 1, koppen: ["Maandag 12 oktober regio noord", "Zaterdag 17 oktober alle regio's"], cellen: ["Droog · 7 uur zon", "4,2 mm regen · kans 70%", "Droog · weinig zon"], later: "De vakantiedagen tot en met zondag 25 oktober verschijnen hier vanzelf zodra ze binnen de 7-daagse verwachting vallen." }, en: { aftellen: "It is the autumn school holiday in the northern region. In the central and southern regions, the holiday starts on Saturday 17 October." } },
  { naam: "overal", nu: "2026-10-17T10:00:00Z", data: antwoord("2026-10-17"), nl: { aftellen: "Het is overal herfstvakantie.", tabellen: 7, fetch: 1 }, en: { aftellen: "It is the autumn school holiday everywhere." } },
  { naam: "na", nu: "2026-10-26T10:00:00Z", nl: { kop: "Herfstvakantie 2027", aftellen: "355 dagen tot de herfstvakantie in regio noord en midden", tabellen: 0, fetch: 0 }, en: { kop: "Autumn school holiday 2027" } },
  { naam: "fout", nu: "2026-10-12T10:00:00Z", status: 503, nl: { tabellen: 0, fetch: 1, fout: true }, en: {} }
];

server.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: require("./vind-browser.js").vindBrowser() || undefined });
  let gemeten = 0;
  try {
    for (const sc of SCENARIOS) for (const taal of ["nl", "en"]) for (const breedte of [320, 390, 1366]) {
      const context = await browser.newContext({ viewport: { width: breedte, height: breedte < 700 ? 844 : 900 } });
      const page = await context.newPage();
      const fouten = []; let fetches = 0;
      page.on("pageerror", e => fouten.push(e.message));
      await page.addInitScript(t => { try { localStorage.clear(); if (t === "en") localStorage.setItem("weerbriefing.taal.v1", "en"); } catch (e) { } }, taal);
      await page.clock.setFixedTime(new Date(sc.nu));
      await page.route("https://api.open-meteo.com/**", route => {
        fetches++;
        const url = new URL(route.request().url());
        assert.equal(url.searchParams.get("latitude").split(",").length, herfst.plaatsen.length, "één aanvraag voor alle plaatsen");
        assert(url.searchParams.get("daily").includes("sunshine_duration"), "zonuren in de aanvraag");
        if (sc.status) return route.fulfill({ status: sc.status, body: "{}" });
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sc.data) });
      });
      await page.goto(base + "/herfstvakantie/", { waitUntil: "load" });
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => ({
        kop: document.getElementById("seizoen-kop").textContent.trim(),
        aftellen: document.getElementById("seizoen-aftellen").hidden ? "" : document.getElementById("seizoen-aftellen").textContent.replace(/\s+/g, " ").trim(),
        melding: document.getElementById("seizoen-melding").hidden ? "" : document.getElementById("seizoen-melding").textContent.trim(),
        samenvatting: (document.querySelector(".seizoen-samenvatting") || {}).textContent || "",
        tabellen: document.querySelectorAll("#seizoen-verwachting .seizoen-dag").length,
        koppen: [...document.querySelectorAll("#seizoen-verwachting .seizoen-dag h3")].map(h => h.textContent.replace(/\s+/g, " ").trim()),
        cellen: [...document.querySelectorAll("#seizoen-verwachting td:nth-child(2)")].map(td => td.textContent.replace(/\s+/g, " ").trim()),
        later: (document.querySelector(".seizoen-later") || {}).textContent || "",
        fout: !!document.querySelector(".seizoen-fout"),
        perioden: [...document.querySelectorAll(".seizoen-perioden")].map(d => d.getAttribute("data-jaar")),
        overloop: document.documentElement.scrollWidth - innerWidth,
        ontbreekt: window.__WIW_TAAL_ONTBREEKT__ ? [...window.__WIW_TAAL_ONTBREEKT__] : null
      }));
      const label = `${sc.naam} ${taal} ${breedte}px`;
      assert.deepEqual(fouten, [], `${label}: scriptfouten`);
      assert(m.overloop <= 0, `${label}: horizontale overloop ${m.overloop}px`);
      const v = sc[taal];
      if (taal === "nl") {
        assert.equal(m.kop, v.kop || "Herfstvakantie 2026", `${label}: kop`);
        if (v.aftellen !== undefined) assert.equal(m.aftellen, v.aftellen, `${label}: aftellen`);
        if (v.melding) assert.equal(m.melding, v.melding, `${label}: melding`);
        assert.equal(m.tabellen, v.tabellen, `${label}: aantal dagtabellen`);
        assert.equal(fetches, v.fetch, `${label}: aantal verwachtingsaanvragen`);
        if (v.samenvatting) assert.equal(m.samenvatting, v.samenvatting, `${label}: samenvatting`);
        for (const k of v.koppen || []) assert(m.koppen.includes(k), `${label}: dagkop "${k}" ontbreekt (${m.koppen.join(" | ")})`);
        for (const c of v.cellen || []) assert(m.cellen.includes(c), `${label}: weercel "${c}" ontbreekt`);
        if (v.later) assert.equal(m.later, v.later, `${label}: later`);
        assert.equal(m.fout, !!v.fout, `${label}: foutmelding`);
        assert(m.perioden.length >= 1, `${label}: vakantiedata per regio staan op de pagina`);
      } else {
        assert.deepEqual(m.ontbreekt, [], `${label}: onvertaalde teksten`);
        if (v.kop) assert.equal(m.kop, v.kop, `${label}: kop`);
        if (v.aftellen) assert.equal(m.aftellen, v.aftellen, `${label}: aftellen`);
      }
      gemeten++;
      await context.close();
    }
    console.log(`Herfstvakantie: ${gemeten} weergaven (vóór, tijdens, overal, na, fout × NL/EN × 320/390/1366 px) kloppen; Engels volledig vertaald, geen overloop.`);
  } finally {
    await browser.close();
    server.close();
  }
});
