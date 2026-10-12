"use strict";

/* Kleurronde 12 oktober, gemeten op het definitieve artifact: temperatuurschaal
   op dagbalken en grafiekvlak (licht en donker), richting van de trendbalk,
   metertjes in de tegels, tweekleurige iconen en géén luchttint achter de
   hoofdweergave (weggehaald op verzoek van de eigenaar). Mobiel en desktop, licht en donker, Nederlands en Engels;
   zonder scriptfouten, zonder horizontale overloop en zonder extra tekst. */

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");
const { stub } = require("./taal-catalogus-browser.js");
const { SCENARIOS } = require("./taal-scenarios.js");
const kleur = require("./kleur-20261012.js");

const PUBLIC = path.join(__dirname, "..", "public");
const TYPES = { ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };

/* Pure logica van de tegelruntime. */
assert.deepStrictEqual(kleur.getallen("−1 → −2 °C"), [-1, -2], "minteken in de trendtekst");
assert.deepStrictEqual(kleur.meterVoor("pop", "Droog"), null, "zonder cijfer geen meter");
assert.strictEqual(kleur.meterVoor("uv", "14").waarde, 11, "UV-schaal begrensd op 11+");
assert.strictEqual(kleur.meterVoor("wind", "14 km/u NW").procent, 3 / 12 * 100, "wind 14 km/u is 3 Bft");
const gelijk = kleur.trendVerloop(18, 18, "licht");
assert(/#afaca4,#afaca4/.test(gelijk), "gelijke temperatuur is neutraal: " + gelijk);
const rgb = s => [...s.matchAll(/rgb\((\d+),(\d+),(\d+)\)/g)].map(m => m.slice(1, 4).map(Number));
const [kWarm, kKoud] = rgb(kleur.trendVerloop(18, 13, "licht"));
assert(kWarm[0] > kWarm[2] && kKoud[2] > kKoud[0], "koeler loopt van warm naar koud");
const [wKoud, wWarm] = rgb(kleur.trendVerloop(13, 18, "licht"));
assert(wKoud[2] > wKoud[0] && wWarm[0] > wWarm[2], "warmer loopt van koud naar warm");
const klein = rgb(kleur.trendVerloop(18, 19, "licht"))[1], groot = rgb(kleur.trendVerloop(18, 23, "licht"))[1];
assert(groot[0] - groot[2] > klein[0] - klein[2], "een groter verschil kleurt voller");

let sc = SCENARIOS[0], huidigeTaal = "";
const server = http.createServer((req, res) => {
  const pad = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(PUBLIC, pad.endsWith("/") ? pad + "index.html" : pad);
  if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  if (f.endsWith(".html")) {
    const html = fs.readFileSync(f, "utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi, "").replace("<head>", "<head>" + stub(sc, huidigeTaal));
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(html);
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

const GEVALLEN = [
  { naam: "hitte-uv", accent: "ico-zon" },
  { naam: "regen-nu", accent: "ico-regen" },
  { naam: "vorst-sneeuw", accent: "ico-sneeuw" },
  { naam: "onweer-storm", accent: "ico-flits" },
  { naam: "nacht-helder", accent: null }
];

server.listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: require("./vind-browser.js").vindBrowser() || undefined });
  let gemeten = 0;
  try {
    for (const geval of GEVALLEN) for (const breedte of [390, 1366]) for (const thema of ["light", "dark"]) for (const taal of ["nl", "en"]) {
      if (taal === "en" && thema === "dark") continue;
      sc = SCENARIOS.find(s => s.naam === geval.naam);
      huidigeTaal = taal === "en" ? "en" : "";
      assert(sc, "scenario ontbreekt: " + geval.naam);
      const ctx = await browser.newContext({ viewport: { width: breedte, height: 900 }, colorScheme: thema });
      const page = await ctx.newPage();
      const fouten = [];
      page.on("pageerror", e => fouten.push(e.message));
      await page.goto(`http://127.0.0.1:${port}/?lat=52.35&lon=5.26&plaats=Almere&land=NL`, { waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector("#chart text") && document.querySelector("#chart stop[data-temp-stop]") && document.querySelector(".stats .wiw-meter"), null, { timeout: 20000 });
      if (taal === "en") await page.waitForFunction(() => Array.isArray(window.__WIW_TAAL_ONTBREEKT__) || window.__WIW_TAAL_ONTBREEKT__ instanceof Set, null, { timeout: 20000 });
      await page.waitForTimeout(700);
      const label = `${geval.naam} ${breedte}px ${thema} ${taal}`;
      const m = await page.evaluate(() => {
        const donker = document.documentElement.getAttribute("data-thema") === "donker";
        const meter = id => { const s = document.getElementById(id); const el = s && s.parentElement.querySelector(":scope > .wiw-meter"); return el ? { soort: el.getAttribute("data-meter"), waarde: el.getAttribute("data-waarde"), breed: el.querySelector("i") ? el.querySelector("i").style.width : "", tekst: s.textContent, achtergrond: el.querySelector("i") ? getComputedStyle(el.querySelector("i")).backgroundImage : "", gevuld: [...el.querySelectorAll("i")].filter(i => i.style.background).length } : { soort: null, tekst: s ? s.textContent : null }; };
        const stops = [...document.querySelectorAll("#chart stop[data-temp-stop]")];
        const balk = document.querySelector("#days .row.day:not(.kop) .bar i");
        const held = document.querySelector(".hero");
        return {
          donker,
          stops: stops.map(s => ({ t: Number(s.getAttribute("data-temp-stop")), kleur: getComputedStyle(s).stopColor, verwacht: typeof temperatuurKleur === "function" ? temperatuurKleur(Number(s.getAttribute("data-temp-stop")), donker ? "donker" : "licht") : null })),
          balk: balk && getComputedStyle(balk).display !== "none" && balk.offsetWidth > 0 ? { beeld: getComputedStyle(balk).backgroundImage, licht: balk.style.getPropertyValue("--temp-verloop"), donker: balk.style.getPropertyValue("--temp-verloop-donker") } : null,
          meters: Object.fromEntries(["wind", "prec", "pop", "hum", "cloud", "uv"].map(id => [id, meter(id)])),
          gloed: held ? getComputedStyle(held, "::before").backgroundImage : "",
          accenten: [...document.querySelectorAll("#nowicon svg.ico .ico-zon, #nowicon svg.ico .ico-regen, #nowicon svg.ico .ico-sneeuw, #nowicon svg.ico .ico-flits")].map(e => ({ klasse: e.getAttribute("class"), streep: getComputedStyle(e).stroke })),
          inkt: getComputedStyle(document.getElementById("nowicon")).color,
          overloop: document.documentElement.scrollWidth - innerWidth,
          metertekst: [...document.querySelectorAll(".wiw-meter")].map(e => e.textContent).join("").trim()
        };
      });
      assert.deepStrictEqual(fouten, [], `${label}: scriptfouten`);
      assert(m.overloop <= 0, `${label}: horizontale overloop ${m.overloop}px`);
      assert.strictEqual(m.donker, thema === "dark", `${label}: thema`);
      /* De metertjes voegen geen tekst toe: in het Engels werken ze op dezelfde cijfers. */
      assert.strictEqual(m.metertekst, "", `${label}: metertjes bevatten tekst`);

      /* Grafiekvlak: iedere stop draagt de schaalkleur van zijn temperatuur. */
      assert(m.stops.length >= 11, `${label}: te weinig temperatuurstops (${m.stops.length})`);
      for (const s of m.stops) assert.strictEqual(s.kleur.replace(/ /g, ""), s.verwacht, `${label}: stop ${s.t}° heeft ${s.kleur}, verwacht ${s.verwacht}`);

      /* Dagbalken (alleen waar de balk zichtbaar is): het thema kiest zijn verloop. */
      if (m.balk) {
        assert(/linear-gradient/.test(m.balk.licht) && /linear-gradient/.test(m.balk.donker), `${label}: dagbalk mist een verloop`);
        const eerste = s => (s.match(/rgb\(\d+, ?\d+, ?\d+\)/) || [""])[0].replace(/ /g, "");
        assert.strictEqual(eerste(m.balk.beeld), eerste(thema === "dark" ? m.balk.donker : m.balk.licht), `${label}: dagbalk toont het verkeerde themaverloop`);
      }

      /* Metertjes: waarde volgt het getoonde cijfer. */
      const mt = m.meters;
      assert.strictEqual(mt.wind.soort, "wind", `${label}: windmeter ontbreekt`);
      assert.strictEqual(mt.hum.soort, "neutraal", `${label}: vochtmeter ontbreekt`);
      assert.strictEqual(mt.cloud.soort, "neutraal", `${label}: bewolkingsmeter ontbreekt`);
      const getal = t => Number(String(t).replace(/−/g, "-").match(/-?\d+/)[0]);
      assert.strictEqual(Number(mt.hum.waarde), getal(mt.hum.tekst), `${label}: vochtmeter wijkt af van ${mt.hum.tekst}`);
      if (/\d/.test(mt.pop.tekst)) assert.strictEqual(Number(mt.pop.waarde), getal(mt.pop.tekst), `${label}: neerslagmeter wijkt af`);
      else assert.strictEqual(mt.pop.soort, null, `${label}: meter bij neerslagtegel zonder cijfer`);
      if (/\d/.test(mt.uv.tekst)) assert.strictEqual(mt.uv.gevuld, Math.min(11, getal(mt.uv.tekst)), `${label}: UV-blokjes wijken af van ${mt.uv.tekst}`);
      if (mt.prec.soort === "trend") {
        const [van, naar] = String(mt.prec.tekst).replace(/−/g, "-").match(/-?\d+/g).map(Number);
        const kl = [...mt.prec.achtergrond.matchAll(/rgb\((\d+), ?(\d+), ?(\d+)\)/g)].map(x => x.slice(1, 4).map(Number));
        assert(kl.length >= 2, `${label}: trendbalk zonder verloop`);
        const warmte = c => c[0] - c[2];
        if (naar < van) assert(warmte(kl[0]) > warmte(kl[kl.length - 1]), `${label}: koeler moet van warm naar koud lopen`);
        if (naar > van) assert(warmte(kl[0]) < warmte(kl[kl.length - 1]), `${label}: warmer moet van koud naar warm lopen`);
      }

      /* Geen luchttint meer; wel het iconaccent. */
      assert(!/gradient/.test(m.gloed), `${label}: nog een gloed achter de hoofdweergave: ${m.gloed}`);
      if (geval.accent) {
        const accent = m.accenten.find(a => a.klasse === geval.accent);
        assert(accent, `${label}: accent ${geval.accent} ontbreekt in het hoofdicoon`);
        assert.notStrictEqual(accent.streep, m.inkt, `${label}: accent ${geval.accent} staat nog in inkt`);
      }
      gemeten++;
      await ctx.close();
    }
    console.log(`Kleurronde: ${gemeten} weergaven kloppen (temperatuurschaal, trendrichting, metertjes, iconaccenten, geen luchttint; licht/donker, NL/EN, mobiel/desktop).`);
  } finally {
    await browser.close();
    server.close();
  }
});
