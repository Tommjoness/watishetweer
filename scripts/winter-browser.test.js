"use strict";

/* Winter (eigenaar akkoord 8 oktober 2026): de eigen gladheidsregel onder de
   briefing en sneeuw in centimeters in Zeven dagen. Gemeten op het definitieve
   artifact met nagebootste weersituaties, in het Nederlands en het Engels. */

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");
const { stub } = require("./taal-catalogus-browser.js");
const { SCENARIOS, nuMs } = require("./taal-scenarios.js");
const { bouw } = require("../data.js");

const PUBLIC = path.join(__dirname, "..", "public");
const URL = "/?lat=52.35&lon=5.26&plaats=Almere&land=NL";
const LUCHT = { current: { european_aqi: 30, us_aqi: 40 }, hourly: { time: ["2026-07-22T14:00"], alder_pollen: [0], birch_pollen: [0], grass_pollen: [0], mugwort_pollen: [0], ragweed_pollen: [0], olive_pollen: [0] } };
const SNEEUW = new Set([71, 73, 75, 77, 85, 86]);

/* Zet het actuele uur en vul current uit dezelfde uurreeks, zodat alles één moment beschrijft. */
function af(d, uur, dag = true) {
  d.current.time = `2026-07-22T${String(uur).padStart(2, "0")}:00`;
  d.current.interval = 900; d.current.is_day = dag ? 1 : 0; d.current.visibility = 16000;
  d.latitude = 52.35; d.longitude = 5.26; d.elevation = 3;
  d.daily.sunshine_duration = d.daily.time.map(() => 2 * 3600);
  const i = 24 + uur;
  for (const k of ["temperature_2m", "apparent_temperature", "weather_code", "precipitation", "cloud_cover", "relative_humidity_2m"]) if (d.hourly[k]) d.current[k] = d.hourly[k][i];
  d.minutely_15 = { time: [d.current.time], precipitation: [d.current.precipitation], rain: [0], showers: [0], snowfall: [0], weather_code: [d.current.weather_code] };
  return d;
}
function sneeuwVelden(d) {
  d.hourly.snowfall = d.hourly.precipitation.map((v, i) => SNEEUW.has(d.hourly.weather_code[i]) ? +(v * 0.7).toFixed(2) : 0);
  d.hourly.rain = d.hourly.precipitation.map((v, i) => d.hourly.snowfall[i] > 0 ? 0 : v);
  return d;
}

const SITUATIES = [
  {
    naam: "opvriezing", nu: nuMs(20), url: URL, lucht: LUCHT,
    /* Regen van 14 tot 18 uur bij plusgraden, daarna helder en vanaf 21 uur onder nul. */
    forecast: () => {
      const d = bouw({ wc: u => (u >= 14 && u <= 18 ? 61 : u >= 20 ? 0 : 3), cc: u => (u >= 20 ? 5 : 90), pp: u => (u >= 14 && u <= 18 ? 80 : 5), pr: u => (u >= 14 && u <= 18 ? 1 : 0), som: 5, rh: 90, spreiding: 1 });
      d.hourly.temperature_2m = d.hourly.time.map((_, i) => { const u = i % 24; return u < 8 ? -3 + u * 0.5 : u < 12 ? 1 + u * 0.2 : +(4 - (u - 12) * 0.5).toFixed(1); });
      return af(d, 20, false);
    },
    gladheid: /^Kans op gladheid: natte wegen kunnen vanaf ongeveer 20:00 opvriezen\.$|^Kans op gladheid: natte wegen kunnen opvriezen\.$/,
    gladheidEn: /^Risk of icy patches: wet roads may freeze( from about \d{2}:\d{2})?\.$/,
    sneeuwDagen: 0
  },
  {
    naam: "sneeuw", nu: nuMs(8), url: URL, lucht: LUCHT,
    forecast: () => {
      const d = bouw({ temp: u => +(-2 + 1.5 * Math.sin((u - 8) / 24 * 2 * Math.PI)).toFixed(1), wc: u => (u >= 6 && u <= 14 ? 73 : 3), cc: () => 100, pp: u => (u >= 6 && u <= 14 ? 90 : 20), pr: u => (u >= 6 && u <= 14 ? 1.2 : 0), som: 6, rh: 93, spreiding: 1 });
      return af(sneeuwVelden(d), 8);
    },
    gladheid: /^Kans op gladheid door sneeuw\.$/,
    gladheidEn: /^Risk of slippery roads from snow\.$/,
    sneeuwDagen: "alle"
  },
  {
    naam: "ijzel-met-waarschuwing", nu: nuMs(7), url: URL, lucht: LUCHT,
    forecast: () => af(bouw({ temp: u => +(-1 + 1.5 * Math.sin((u - 10) / 24 * 2 * Math.PI)).toFixed(1), wc: u => (u >= 5 && u <= 11 ? 66 : 3), cc: () => 100, pp: () => 85, pr: u => (u >= 5 && u <= 11 ? 0.6 : 0), som: 3, rh: 96, spreiding: 0.5 }), 7),
    waarschuwingen: { bron: "test", dekking: true, land: "NL", lijst: [{ titel: "Code oranje: ijzel", tekst: "Plaatselijk ijzel door aanvriezende regen.", niveau: "oranje", van: "2026-07-22T03:00:00Z", tot: "2026-07-22T23:00:00Z", gebied: "Flevoland", plaatsSpecifiek: true }] },
    gladheid: null, sneeuwDagen: 0
  },
  {
    naam: "reservebron-berg", nu: nuMs(14), url: "/?lat=46.547&lon=7.985&plaats=Jungfraujoch&land=CH", lucht: LUCHT,
    /* De reservebron levert dalwaarden; de hoogte-API kent de echte hoogte. */
    forecast: () => { const d = af(bouw({ temp: () => 2 }), 14); d.provider = "visualcrossing"; d.elevation = null; return d; },
    hoogte: 3571, hoogtehint: /^De reservebron houdt geen rekening met de hoogte van deze plek \(ongeveer 3\.570 m\)\./,
    hoogtehintEn: /^The backup source does not account for the altitude of this location \(about 3,570 m\)\./,
    gladheid: null, sneeuwDagen: 0
  },
  { ...SCENARIOS[0], naam: "zomer", gladheid: null, sneeuwDagen: 0, vorstlijn: false }
];
SITUATIES[0].vorstlijn = true;

const TYPES = { ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
let actief = SITUATIES[0], taal = "";
const server = http.createServer((req, res) => {
  const pad = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(PUBLIC, pad.endsWith("/") ? pad + "index.html" : pad);
  if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  if (f.endsWith(".html")) {
    /* De hoogte-API van Open-Meteo antwoordt in deze test met de hoogte van het scenario. */
    const hoogte = `<script>(function(){const f=window.fetch;window.fetch=function(u){if(String(u&&u.url||u).includes("/v1/elevation"))return Promise.resolve({ok:true,status:200,headers:{get:()=>"application/json"},json:async()=>({elevation:[${Number(actief.hoogte) || 0}]}),text:async()=>""});return f.apply(this,arguments);};})();</script>`;
    const html = fs.readFileSync(f, "utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi, "").replace("<head>", "<head>" + stub(actief, taal) + hoogte);
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
    for (const s of SITUATIES) {
      for (const t of s.gladheid || s.hoogtehint ? ["", "en"] : [""]) {
        actief = s; taal = t;
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await ctx.newPage();
        const fouten = [];
        page.on("pageerror", e => fouten.push(e.message));
        await page.goto(`http://127.0.0.1:${port}${s.url}`, { waitUntil: "load" });
        await page.waitForFunction(() => document.querySelector("#days .row.day:not(.kop)") && /\S/.test((document.getElementById("brief") || {}).textContent || ""), null, { timeout: 20000 });
        await page.waitForTimeout(1200);
        const m = await page.evaluate(() => {
          const g = document.getElementById("gladheid");
          return {
            bestaat: !!g, zichtbaar: !!g && !g.hidden && g.getBoundingClientRect().height > 0, tekst: g ? g.textContent.trim() : "",
            /* Onder de briefing (eventueel na Opvallend) en vóór de officiële waarschuwingen. */
            naBrief: !!g && !!(document.getElementById("brief").compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING)
              && !!(g.compareDocumentPosition(document.getElementById("waarschuwingen")) & Node.DOCUMENT_POSITION_FOLLOWING),
            hoogte: (() => { const h = document.getElementById("hoogtehint"); return h && !h.hidden ? h.textContent.trim() : ""; })(),
            vorstlijn: document.querySelectorAll("#chart line.vorstlijn").length,
            hoeveelheden: document.querySelectorAll("#days .row.day:not(.kop) .drain small").length,
            sneeuw: [...document.querySelectorAll("#days .row.day:not(.kop) .drain small")].map(e => e.textContent.trim()).filter(x => /cm (sneeuw|snow)$/.test(x)),
            ontbreekt: window.__WIW_TAAL_ONTBREEKT__ ? [...window.__WIW_TAAL_ONTBREEKT__].filter(x => /glad|sneeuw|opvriez|ijzel|reservebron/i.test(x)) : []
          };
        });
        const label = `${s.naam}${t ? " (en)" : ""}`;
        assert(m.bestaat && m.naBrief, `${label}: #gladheid ontbreekt of staat niet tussen briefing en waarschuwingen`);
        if (s.gladheid) {
          assert(m.zichtbaar, `${label}: gladheidsregel niet zichtbaar`);
          assert((t ? s.gladheidEn : s.gladheid).test(m.tekst), `${label}: onverwachte gladheidstekst "${m.tekst}"`);
        } else {
          assert(!m.zichtbaar, `${label}: gladheidsregel had verborgen moeten blijven, maar toont "${m.tekst}"`);
        }
        const verwachtSneeuw = s.sneeuwDagen === "alle" ? m.hoeveelheden : s.sneeuwDagen;
        if (s.sneeuwDagen === "alle") assert(m.hoeveelheden >= 5, `${label}: te weinig dagen met een hoeveelheid (${m.hoeveelheden})`);
        if (s.hoogtehint) assert((t ? s.hoogtehintEn : s.hoogtehint).test(m.hoogte), `${label}: hoogtemelding ontbreekt of wijkt af: "${m.hoogte}"`);
        else assert.strictEqual(m.hoogte, "", `${label}: onverwachte hoogtemelding "${m.hoogte}"`);
        if (typeof s.vorstlijn === "boolean") assert.strictEqual(m.vorstlijn, s.vorstlijn ? 1 : 0, `${label}: vorstlijn ${m.vorstlijn}, verwacht ${s.vorstlijn ? 1 : 0}`);
        if (!t) assert.strictEqual(m.sneeuw.length, verwachtSneeuw, `${label}: aantal dagen met sneeuw in cm ${m.sneeuw.length} (${m.sneeuw.join(", ")}), verwacht ${verwachtSneeuw}`);
        for (const x of m.sneeuw) assert((t ? /^\d+ cm snow$/ : /^\d+ cm sneeuw$/).test(x), `${label}: sneeuwtekst "${x}"`);
        assert.deepStrictEqual(m.ontbreekt, [], `${label}: onvertaalde wintertekst`);
        assert.deepStrictEqual(fouten, [], `${label}: scriptfouten`);
        await ctx.close();
      }
    }
    console.log("Winter: hoogtemelding bij de reservebron op 3.570 m (NL en EN); vorstlijn alleen als de as door 0 °C loopt.");
    console.log("Winter: gladheidsregel bij opvriezing en sneeuw (NL en EN), stil naast een officiële ijzelwaarschuwing en in de zomer; sneeuw in cm in Zeven dagen.");
  } finally {
    await browser.close();
    server.close();
  }
});
