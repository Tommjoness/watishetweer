"use strict";

/*
 * De Nachtzicht-pagina's (/nachtzicht/) rekenen met een eigen kern, maar moeten
 * per nacht exact tonen wat het blok Nachtzicht in de app toont: hetzelfde
 * label, dezelfde score, hetzelfde oordeel en dezelfde vensterzin. Deze test
 * laadt het definitieve artifact (public/index.html) met nagebootste
 * weerdata en een vaste klok, en legt de app naast de kern uit
 * scripts/nachtzicht-bron.js, op exact dezelfde data. Wijzigt iemand later
 * Nachtzicht in de app, dan faalt deze test tot de pagina's meegaan.
 *
 * De situaties dekken: een heldere nacht, een opklaring midden in de nacht,
 * een lopende nacht vóór en na middernacht, mist en neerslag, en hoge
 * luchtvochtigheid met harde windstoten. Daarna worden een parkpagina en het
 * overzicht zelf geladen met dezelfde data, om te zien dat ze die uitkomst
 * ook echt zo tonen.
 */

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");
const { bouw } = require("../data.js");
const { stub } = require("./taal-catalogus-browser.js");
const { laadKern } = require("./nachtzicht-bron.js");
const { parkenMetLicht } = require("./generate-nachtzicht.js");
const { BASIS } = require("./nachtzicht.config.js");

const PUBLIC = path.join(__dirname, "..", "public");
const TYPES = { ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
const LAT = 52.909, LON = 6.281;
const PARKEN = parkenMetLicht();

/* Het artifact bevat alle pagina's en de sitemap noemt ze. */
const SITEMAP = fs.readFileSync(path.join(PUBLIC, "sitemap.xml"), "utf8");
for (const rel of [BASIS, ...PARKEN.map(p => BASIS + p.slug + "/"), "/maan/"]) {
  assert(fs.existsSync(path.join(PUBLIC, rel, "index.html")), `public${rel}index.html ontbreekt`);
  assert(SITEMAP.includes(`<loc>https://watishetweer.nl${rel}</loc>`), `sitemap mist ${rel}`);
}
const K = laadKern(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"));

/* Europe/Amsterdam in juli: UTC+2. Dag 0 is 22 juli 2026. */
const moment = (dag, uur, minuut = 0) => Date.UTC(2026, 6, 22 + dag, uur - 2, minuut);
const lokaal = (dag, uur, minuut = 0) => new Date(moment(dag, uur, minuut) + 2 * 3600000).toISOString().slice(0, 16);

function situatie(naam, opties, dag, uur, minuut = 0) {
  const d = bouw(Object.assign({ geenKwartier: true }, opties));
  const i = d.hourly.time.indexOf(lokaal(dag, uur));
  assert(i >= 0, naam + ": klokuur ontbreekt in de nagebootste data");
  const c = d.current, h = d.hourly;
  c.time = lokaal(dag, uur, minuut - (minuut % 15));
  for (const veld of ["temperature_2m", "relative_humidity_2m", "precipitation", "weather_code", "cloud_cover", "wind_gusts_10m", "is_day"]) c[veld] = h[veld][i];
  c.visibility = h.visibility ? h.visibility[i] : null;
  d.latitude = LAT; d.longitude = LON; d.elevation = 10;
  d.daily.sunshine_duration = d.daily.time.map(() => 8 * 3600);
  return { naam, d, nu: moment(dag, uur, minuut) };
}

const SITUATIES = [
  situatie("heldere nachten", { cc: () => 8 }, 0, 14),
  situatie("opklaring midden in de nacht", { cc: (u, d) => (u >= 1 && u <= 4) || d >= 3 ? 12 : 85 }, 0, 16, 20),
  situatie("lopende nacht voor middernacht", { cc: u => u >= 23 || u <= 2 ? 15 : 70 }, 0, 22, 35),
  situatie("lopende nacht na middernacht", { cc: (u, d) => (u >= 2 && u <= 4) ? 10 : d === 1 ? 30 : 90 }, 1, 1, 40),
  situatie("mist en neerslag", { cc: u => u <= 5 ? 20 : 95, wc: u => u >= 1 && u <= 3 ? 45 : u >= 22 ? 61 : 3, pr: u => u >= 22 ? 0.6 : 0, zicht: 3500 }, 0, 12),
  situatie("vocht en windstoten", { cc: (u, d) => 20 + 10 * d, rh: 96, spreiding: 1, wg: u => u >= 21 || u <= 5 ? 55 : 30 }, 0, 18, 5)
];

let actief = null;
const server = http.createServer((req, res) => {
  const pad = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(PUBLIC, pad.endsWith("/") ? pad + "index.html" : pad);
  if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  if (f.endsWith(".html")) {
    const html = fs.readFileSync(f, "utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi, "")
      .replace("<head>", "<head>" + stub({ forecast: () => pad === BASIS ? PARKEN.map(() => actief.d) : actief.d, nu: actief.nu }, ""));
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(html);
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

server.listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: require("./vind-browser.js").vindBrowser() || undefined });
  let rijen = 0;
  try {
    for (const s of SITUATIES) {
      actief = s;
      const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, timezoneId: "Europe/Amsterdam" });
      const page = await ctx.newPage();
      const fouten = [];
      page.on("pageerror", e => fouten.push(e.message));
      await page.goto(`http://127.0.0.1:${port}/?lat=${LAT}&lon=${LON}&plaats=Testpark&land=NL&analytics=uit`, { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector("#nights .row.night:not(.kop) .nachtoordeel"), null, { timeout: 20000 });
      const app = await page.evaluate(() => [...document.querySelectorAll("#nights .row.night:not(.kop)")].map(r => ({
        label: ((r.querySelector(".nachtlabel-lang") || r.querySelector(".dname")).textContent || "").trim().replace("–", " op "),
        score: (r.querySelector(".score").textContent || "").trim(),
        oordeel: (r.querySelector(".nachtoordeel").textContent || "").trim(),
        zin: ((r.querySelector(".nachtvenster") || {}).textContent || "").trim()
      })));
      /* De kern draait in een eigen vm-context; JSON maakt er gewone objecten van. */
      const kern = JSON.parse(JSON.stringify(K.nachten(JSON.parse(JSON.stringify(s.d)), LAT, LON, "Europe/Amsterdam", 6, s.nu)
        .map(n => ({ label: n.label, score: n.scoreTekst, oordeel: n.oordeel, zin: n.zin }))));
      assert(app.length >= 3, `${s.naam}: de app toont te weinig nachten (${app.length})`);
      assert.deepStrictEqual(kern, app, `${s.naam}: Nachtzicht-pagina wijkt af van de app`);
      assert.deepStrictEqual(fouten, [], `${s.naam}: scriptfouten in de app`);
      rijen += app.length;
      await ctx.close();
    }
    /* De pagina's zelf: een parkpagina en het overzicht, met dezelfde data en klok. */
    const park = PARKEN[0], gewoon = v => JSON.parse(JSON.stringify(v));
    for (const s of [SITUATIES[1], SITUATIES[3]]) {
      actief = s;
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/Amsterdam" });
      const page = await ctx.newPage();
      const fouten = [];
      page.on("pageerror", e => fouten.push(e.message));
      await page.goto(`http://127.0.0.1:${port}${BASIS}${park.slug}/`, { waitUntil: "load" });
      await page.waitForFunction(() => document.getElementById("nz-status").hidden, null, { timeout: 10000 });
      const getoond = await page.evaluate(() => ({
        cijfer: document.querySelector(".nz-cijfer").textContent, oordeel: document.querySelector(".nz-oordeel b").textContent,
        zin: document.querySelector(".nz-oordeel span").textContent,
        rijen: [...document.querySelectorAll("#nz-nachten tbody tr")].map(r => [r.querySelector("th").textContent, r.querySelector(".nz-n").textContent, r.querySelector("td:last-child").textContent])
      }));
      const verwacht = gewoon(K.nachten(gewoon(s.d), park.lat, park.lon, "Europe/Amsterdam", 6, s.nu));
      assert.deepStrictEqual({ cijfer: getoond.cijfer, oordeel: getoond.oordeel, zin: getoond.zin },
        { cijfer: verwacht[0].scoreTekst, oordeel: verwacht[0].oordeel, zin: verwacht[0].zin }, `${s.naam}: parkpagina toont iets anders dan de kern`);
      assert.deepStrictEqual(getoond.rijen, verwacht.map(n => [n.label, n.scoreTekst + " " + n.oordeel, n.zin]), `${s.naam}: nachtentabel op de parkpagina`);

      await page.goto(`http://127.0.0.1:${port}${BASIS}`, { waitUntil: "load" });
      await page.waitForFunction(() => document.getElementById("nz-status").hidden, null, { timeout: 10000 });
      const overzicht = await page.evaluate(() => [...document.querySelectorAll("tr[data-park]")].map(r => [r.dataset.park, r.querySelector(".nz-n").textContent, r.querySelector(".nz-venster").textContent]));
      assert.strictEqual(overzicht.length, PARKEN.length, "overzicht toont niet alle parken");
      for (const [slug, n, venster] of overzicht) {
        const p = PARKEN.find(x => x.slug === slug), v = gewoon(K.nachten(gewoon(s.d), p.lat, p.lon, "Europe/Amsterdam", 1, s.nu))[0];
        assert.strictEqual(n, v.scoreTekst + " " + v.oordeel, `${s.naam}: overzicht ${slug}`);
        assert(!venster.includes("…") && (v.venster ? venster.includes(v.venster.tot) : venster.startsWith("geen")), `${s.naam}: kijkvenster in overzicht ${slug}: ${venster}`);
      }
      assert.deepStrictEqual(fouten, [], `${s.naam}: scriptfouten op de Nachtzicht-pagina's`);
      await ctx.close();
    }

    /* De situaties moeten echt verschillende uitkomsten raken, anders bewijst de test weinig. */
    const alle = SITUATIES.flatMap(s => K.nachten(JSON.parse(JSON.stringify(s.d)), LAT, LON, "Europe/Amsterdam", 6, s.nu));
    const zinnen = alle.map(n => n.zin).join("\n");
    assert(alle.some(n => n.label === "nu"), "geen lopende nacht na middernacht getoetst");
    assert(/nu tot \d{2}:\d{2}/.test(zinnen), "geen lopend kijkvenster getoetst");
    assert(/Beste periode: \d{2}:\d{2}–\d{2}:\d{2}/.test(zinnen), "geen kijkvenster met tijden getoetst");
    assert(/Geen gunstig kijkvenster door|omstandigheden/.test(zinnen), "geen nacht zonder kijkvenster getoetst");
    assert(/ van de | in de /.test(zinnen), "geen globale vensterzin voor latere nachten getoetst");
    assert(alle.some(n => n.oordeel.startsWith("Voorlopig")), "geen voorlopige nacht getoetst");
    assert(new Set(alle.map(n => n.scoreTekst)).size >= 4, "te weinig verschillende scores getoetst");
    console.log(`Nachtzicht-pagina's gelijk aan de app: ${SITUATIES.length} situaties, ${rijen} nachten (label, score, oordeel en kijkvenster); parkpagina en overzicht tonen dezelfde uitkomst.`);
  } finally {
    await browser.close();
    server.close();
  }
});
