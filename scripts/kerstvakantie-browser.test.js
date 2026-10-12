"use strict";

/* Kerstvakantie (soort "vakantie", overal tegelijk) in de echte, definitieve
   build: vóór de vakantie (aftellen zonder regio), de eerste vakantiedag, over de
   jaargrens (1 januari), na de vakantie (volgend jaar) en een mislukte
   verwachting. Sneeuw staat in cm, iedere dag heet "alle regio's" en de
   vakantiedata staan op één regel. Mobiel en desktop, Nederlands en Engels; in
   het Engels mag geen tekst onvertaald blijven. */

const fs = require("fs");
const path = require("path");
const http = require("http");
const assert = require("assert");
const { chromium } = require("playwright");
const { SEIZOENSPAGINAS } = require("./seizoenspagina.config.js");

const PUBLIC = path.join(__dirname, "..", "public");
const bestand = path.join(PUBLIC, "kerstvakantie", "index.html");
if (!fs.existsSync(bestand)) throw new Error("public/kerstvakantie/index.html ontbreekt; draai eerst de build.");
const kerst = SEIZOENSPAGINAS.find(p => p.slug === "kerstvakantie");

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

/* Open-Meteo: 7 dagen vanaf `start`. Op 20 december sneeuw in Groningen en
   Zwolle (index 0 en 1), op 2 januari regen in Den Haag en Utrecht (3 en 4). */
function antwoord(start) {
  const dagen = []; const t0 = Date.parse(start + "T00:00:00Z");
  for (let i = 0; i < 7; i++) dagen.push(new Date(t0 + i * 864e5).toISOString().slice(0, 10));
  return kerst.plaatsen.map((p, i) => ({
    latitude: p.lat, longitude: p.lon, timezone: "Europe/Amsterdam", utc_offset_seconds: 3600,
    daily: {
      time: dagen,
      temperature_2m_min: dagen.map(() => -1.4), temperature_2m_max: dagen.map(() => 4.2),
      precipitation_sum: dagen.map(d => d === "2026-12-20" && i < 2 ? 2.6 : d === "2027-01-02" && (i === 3 || i === 4) ? 3.1 : 0),
      snowfall_sum: dagen.map(d => d === "2026-12-20" && i < 2 ? 1.8 : 0),
      precipitation_probability_max: dagen.map(d => d === "2026-12-20" || d === "2027-01-02" ? 75 : 10),
      sunshine_duration: dagen.map(() => 2.4 * 3600)
    }
  }));
}

const SCENARIOS = [
  { naam: "voor", nu: "2026-10-12T10:00:00Z", nl: { aftellen: "68 dagen tot de kerstvakantie", melding: "Vanaf zondag 13 december staat hier de verwachting voor de eerste vakantiedag.", tabellen: 0, fetch: 0 }, en: { kop: "Christmas school holiday 2026", aftellen: "68 days to go until the Christmas school holiday" } },
  { naam: "eerste dag", nu: "2026-12-19T09:00:00Z", data: antwoord("2026-12-19"), nl: { aftellen: "Vandaag begint de kerstvakantie.", tabellen: 7, fetch: 1, koppen: ["Zaterdag 19 december alle regio's", "Vrijdag 25 december alle regio's"], cellen: ["1,8 cm sneeuw · kans 75%", "Droog · 2 uur zon"], later: "De vakantiedagen tot en met zondag 3 januari verschijnen hier vanzelf zodra ze binnen de 7-daagse verwachting vallen." }, en: { aftellen: "The Christmas school holiday starts today." } },
  { naam: "jaargrens", nu: "2027-01-01T10:00:00Z", data: antwoord("2027-01-01"), nl: { aftellen: "Het is kerstvakantie.", tabellen: 3, fetch: 1, koppen: ["Vrijdag 1 januari alle regio's", "Zondag 3 januari alle regio's"], cellen: ["3,1 mm regen · kans 75%"] }, en: { aftellen: "It is the Christmas school holiday." } },
  { naam: "na", nu: "2027-01-04T10:00:00Z", nl: { kop: "Kerstvakantie 2027", aftellen: "355 dagen tot de kerstvakantie", tabellen: 0, fetch: 0 }, en: { kop: "Christmas school holiday 2027" } },
  { naam: "fout", nu: "2026-12-21T10:00:00Z", status: 503, nl: { tabellen: 0, fetch: 1, fout: true }, en: {} }
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
        assert.equal(url.searchParams.get("latitude").split(",").length, kerst.plaatsen.length, "één aanvraag voor alle plaatsen");
        assert(url.searchParams.get("daily").includes("snowfall_sum"), "sneeuw in de aanvraag");
        if (sc.status) return route.fulfill({ status: sc.status, body: "{}" });
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sc.data) });
      });
      await page.goto(base + "/kerstvakantie/", { waitUntil: "load" });
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => ({
        kop: document.getElementById("seizoen-kop").textContent.trim(),
        aftellen: document.getElementById("seizoen-aftellen").hidden ? "" : document.getElementById("seizoen-aftellen").textContent.replace(/\s+/g, " ").trim(),
        melding: document.getElementById("seizoen-melding").hidden ? "" : document.getElementById("seizoen-melding").textContent.trim(),
        tabellen: document.querySelectorAll("#seizoen-verwachting .seizoen-dag").length,
        koppen: [...document.querySelectorAll("#seizoen-verwachting .seizoen-dag h3")].map(h => h.textContent.replace(/\s+/g, " ").trim()),
        cellen: [...document.querySelectorAll("#seizoen-verwachting td:nth-child(2)")].map(td => td.textContent.replace(/\s+/g, " ").trim()),
        later: (document.querySelector(".seizoen-later") || {}).textContent || "",
        fout: !!document.querySelector(".seizoen-fout"),
        periodeRijen: [...document.querySelectorAll(".seizoen-perioden tbody tr")].map(tr => [...tr.children].map(c => c.textContent.trim()).join(" ")),
        overloop: document.documentElement.scrollWidth - innerWidth,
        ontbreekt: window.__WIW_TAAL_ONTBREEKT__ ? [...window.__WIW_TAAL_ONTBREEKT__] : null
      }));
      const label = `${sc.naam} ${taal} ${breedte}px`;
      assert.deepEqual(fouten, [], `${label}: scriptfouten`);
      assert(m.overloop <= 0, `${label}: horizontale overloop ${m.overloop}px`);
      const v = sc[taal];
      if (taal === "nl") {
        assert.equal(m.kop, v.kop || "Kerstvakantie 2026", `${label}: kop`);
        if (v.aftellen !== undefined) assert.equal(m.aftellen, v.aftellen, `${label}: aftellen`);
        if (v.melding) assert.equal(m.melding, v.melding, `${label}: melding`);
        assert.equal(m.tabellen, v.tabellen, `${label}: aantal dagtabellen`);
        assert.equal(fetches, v.fetch, `${label}: aantal verwachtingsaanvragen`);
        for (const k of v.koppen || []) assert(m.koppen.includes(k), `${label}: dagkop "${k}" ontbreekt (${m.koppen.join(" | ")})`);
        for (const c of v.cellen || []) assert(m.cellen.includes(c), `${label}: weercel "${c}" ontbreekt (${[...new Set(m.cellen)].join(" | ")})`);
        if (v.later) assert.equal(m.later, v.later, `${label}: later`);
        assert.equal(m.fout, !!v.fout, `${label}: foutmelding`);
        assert(m.periodeRijen.length >= 1 && m.periodeRijen.every(r => /^Alle regio's /.test(r)), `${label}: vakantiedata op één regel voor alle regio's (${m.periodeRijen.join(" | ")})`);
      } else {
        assert.deepEqual(m.ontbreekt, [], `${label}: onvertaalde teksten`);
        if (v.kop) assert.equal(m.kop, v.kop, `${label}: kop`);
        if (v.aftellen) assert.equal(m.aftellen, v.aftellen, `${label}: aftellen`);
      }
      gemeten++;
      await context.close();
    }
    console.log(`Kerstvakantie: ${gemeten} weergaven (vóór, eerste dag, jaargrens, na, fout × NL/EN × 320/390/1366 px) kloppen; sneeuw in cm, alle regio's, Engels volledig vertaald, geen overloop.`);
  } finally {
    await browser.close();
    server.close();
  }
});
