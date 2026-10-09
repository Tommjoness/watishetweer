"use strict";

/* Nachtronde 9 oktober 2026 (eigenaar akkoord: "Pak alles maar op"), gemeten op
   het definitieve artifact:
   1. "nu 13°" staat nooit over de rode nu-lijn, ook niet als de bewaking het
      label laat uitwijken;
   2. een temperatuurcijfer staat nooit in de kolom van de asgetallen;
   3. de langste dagnaam ("Wo 30 mei", "Wed 30 May") raakt het weericoon niet;
   4. de bewolkingstegel noemt hoge bewolking als de hoofdweergave dat doet;
   5. de uurtabel toont altijd één decimaal ("9,0 °C"). */

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");
const { stub } = require("./taal-catalogus-browser.js");
const { nuMs } = require("./taal-scenarios.js");
const { bouw } = require("../data.js");

const PUBLIC = path.join(__dirname, "..", "public");
const URL = "/?lat=52.35&lon=5.26&plaats=Almere&land=NL";
const LUCHT = { current: { european_aqi: 31, us_aqi: 40 }, hourly: { time: ["2026-07-22T00:00"], alder_pollen: [0], birch_pollen: [0], grass_pollen: [0.5], mugwort_pollen: [0], ragweed_pollen: [0], olive_pollen: [0] } };

/* Temperatuurverlopen rond middernacht die samen alle uitwijkplekken van het
   nu-label en het eerste astijdcijfer raken (vóór de fix 14 van 48 fout). */
const VERLOPEN = {
  zakkend: u => +(13 - 3 * Math.sin((u - 2) / 24 * 2 * Math.PI)).toFixed(1),
  plat: u => 13 + (u % 24 < 3 ? 0.1 * (u % 24) : 0),
  stijgend: u => +(10 + 0.5 * (u % 24)).toFixed(1),
  dalDanStijgend: u => { const h = u % 24; return h < 1 ? 13 : h < 3 ? 12.2 : h < 9 ? 12 - 0.5 * (h - 3) : 9 + 0.6 * (h - 9); }
};

function situatie(uur, minuut, verloop, extra) {
  return {
    nu: nuMs(uur, minuut), lucht: LUCHT, knmi: { beschikbaar: false, provider: null, reden: "test" },
    forecast: () => {
      const d = bouw({ temp: VERLOPEN[verloop], wc: u => (u % 24 >= 5 && u % 24 <= 19 ? 61 : 3), cc: () => 100, pp: u => (u % 24 >= 5 && u % 24 <= 19 ? 90 : 2), pr: u => (u % 24 >= 5 && u % 24 <= 19 ? 1.4 : 0), som: 26, rh: 68, spreiding: 1, nacht: true });
      d.minutely_15 = { time: [], precipitation: [], rain: [], showers: [], snowfall: [], weather_code: [] };
      for (let i = -1; i <= 16; i++) {
        d.minutely_15.time.push(new Date(nuMs(uur, 0) + i * 900000 + 7200000).toISOString().slice(0, 16));
        for (const k of ["precipitation", "rain", "showers", "snowfall"]) d.minutely_15[k].push(0);
        d.minutely_15.weather_code.push(3);
      }
      d.current.time = `2026-07-22T${String(uur).padStart(2, "0")}:${String(Math.floor(minuut / 15) * 15).padStart(2, "0")}`;
      d.current.interval = 900; d.current.is_day = 0; d.latitude = 52.35; d.longitude = 5.26; d.elevation = 3;
      d.daily.sunshine_duration = d.daily.time.map(() => 0);
      for (const k of ["temperature_2m", "apparent_temperature", "weather_code", "precipitation", "cloud_cover", "wind_speed_10m", "wind_gusts_10m", "relative_humidity_2m"]) if (d.hourly[k]) d.current[k] = d.hourly[k][24 + uur];
      if (extra) extra(d);
      return d;
    }
  };
}

const TYPES = { ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
let actief = null, taal = "";
const server = http.createServer((req, res) => {
  const pad = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(PUBLIC, pad.endsWith("/") ? pad + "index.html" : pad);
  if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  if (f.endsWith(".html")) {
    const html = fs.readFileSync(f, "utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi, "").replace("<head>", "<head>" + stub(actief, taal));
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(html);
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

async function open(browser, port, breedte) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: 852 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const fouten = [];
  page.on("pageerror", e => fouten.push(e.message));
  await page.goto(`http://127.0.0.1:${port}${URL}`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("#days .row.day:not(.kop)") && document.querySelector("#chart text"), null, { timeout: 20000 });
  await page.waitForTimeout(1000);
  return { ctx, page, fouten };
}

server.listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: require("./vind-browser.js").vindBrowser() || undefined });
  try {
    /* 1 en 2: grafieklabels rond middernacht. */
    let gemeten = 0;
    for (const verloop of Object.keys(VERLOPEN)) for (const [uur, minuut] of [[0, 10], [0, 51], [1, 30], [2, 45]]) for (const breedte of [360, 390, 430]) {
      actief = situatie(uur, minuut, verloop); taal = "";
      const { ctx, page, fouten } = await open(browser, port, breedte);
      const m = await page.evaluate(() => {
        const svg = document.getElementById("chart");
        const teksten = [...svg.querySelectorAll("text")].filter(t => t.getAttribute("display") !== "none" && !t.closest("#scrub"));
        const lijn = [...svg.querySelectorAll("line")].find(l => !l.closest("#scrub") && !l.hasAttribute("data-nu-aanloop") && /carmine/i.test(l.getAttribute("stroke") || ""));
        const lx = lijn ? Number(lijn.getAttribute("x1")) : null;
        const nu = teksten.find(t => /^nu\b/.test(t.textContent.trim()));
        const nb = nu && nu.getBBox();
        const asKolom = Number(S.geo.x(0)) - 4;
        return {
          nu: nb ? [Math.round(nb.x), Math.round(nb.x + nb.width)] : null, lx,
          nuKruist: !!(nb && lx !== null && nb.x < lx - 0.5 && nb.x + nb.width > lx + 0.5),
          inAsKolom: teksten.filter(t => /Bodoni/i.test(t.getAttribute("font-family") || "") && /^-?\d+°$/.test(t.textContent.trim()))
            .filter(t => t.getBBox().x < asKolom - 0.5).map(t => t.textContent.trim() + "@" + Math.round(t.getBBox().x))
        };
      });
      const label = `${verloop} ${uur}:${String(minuut).padStart(2, "0")} ${breedte}px`;
      assert(m.nu, `${label}: nu-label ontbreekt`);
      assert(!m.nuKruist, `${label}: "nu" staat over de rode nu-lijn (label ${m.nu.join("–")}, lijn ${m.lx})`);
      assert.deepStrictEqual(m.inAsKolom, [], `${label}: temperatuurcijfer in de kolom van de asgetallen`);
      assert.deepStrictEqual(fouten, [], `${label}: scriptfouten`);
      gemeten++;
      await ctx.close();
    }

    /* 3, 4 en 5: dagnamen, bewolkingstegel en uurtabel, in het Nederlands en het Engels. */
    for (const t of ["", "en"]) for (const breedte of [320, 375, 430]) {
      actief = situatie(0, 51, "zakkend", d => {
        d.current.cloud_cover = 100; d.current.cloud_cover_low = 5; d.current.cloud_cover_mid = 10; d.current.cloud_cover_high = 100; d.current.weather_code = 3;
        d.hourly.temperature_2m[24 + 8] = 9;
      });
      taal = t;
      const { ctx, page, fouten } = await open(browser, port, breedte);
      const m = await page.evaluate(langst => {
        /* De langst mogelijke dagnaam, ook halfvet zoals de gekozen dag. */
        const rijen = [...document.querySelectorAll("#days .row.day:not(.kop)")];
        const gaten = rijen.map(rij => {
          const naam = rij.querySelector(".dname"), icoon = rij.querySelector(".dico svg");
          naam.textContent = langst; naam.style.fontWeight = "500";
          const r = document.createRange(); r.selectNodeContents(naam);
          return icoon ? icoon.getBoundingClientRect().left - r.getBoundingClientRect().right : null;
        });
        const cel = [...document.querySelectorAll("#wiw-hour-table tbody tr td:nth-child(2)")].map(td => td.textContent.trim());
        return { gaten, wolk: (document.getElementById("cloudsub") || {}).textContent || "", cond: (document.getElementById("cond") || {}).textContent || "", cel };
      }, t ? "Wed 30 May" : "Wo 30 mei");
      const label = `${t || "nl"} ${breedte}px`;
      for (const gat of m.gaten) assert(gat !== null && gat >= 4, `${label}: dagnaam staat ${gat === null ? "zonder icoon" : gat.toFixed(1) + " px"} van het weericoon (minimaal 4 px)`);
      if (t) {
        assert(/high cloud/i.test(m.cond), `${label}: hoofdweergave noemt geen hoge bewolking: "${m.cond}"`);
        assert(/^Overcast, mostly high cloud\./.test(m.wolk.trim()), `${label}: bewolkingstegel "${m.wolk}"`);
      } else {
        assert(/hoge bewolking/i.test(m.cond), `${label}: hoofdweergave noemt geen hoge bewolking: "${m.cond}"`);
        assert(/^Geheel bewolkt, vooral hoge bewolking\./.test(m.wolk.trim()), `${label}: bewolkingstegel "${m.wolk}"`);
        assert(m.cel.length > 0, `${label}: uurtabel leeg`);
        for (const c of m.cel) assert(/^-?\d+,\d °C$/.test(c), `${label}: uurtabel toont "${c}", verwacht één decimaal`);
      }
      assert.deepStrictEqual(fouten, [], `${label}: scriptfouten`);
      await ctx.close();
    }
    console.log(`Nachtronde: nu-label nooit over de nu-lijn en geen cijfer in de askolom (${gemeten} grafieken rond middernacht).`);
    console.log("Nachtronde: langste dagnaam (NL en EN) vrij van het weericoon; tegel noemt hoge bewolking; uurtabel met één decimaal.");
  } finally {
    await browser.close();
    server.close();
  }
});
