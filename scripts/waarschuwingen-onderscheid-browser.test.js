"use strict";

/* Officiële NWS-waarschuwingen op het finale artifact (public/) in een echte browser, Nederlands en Engels.

   Aanleiding (audit 25 oktober 2026): de ernstigste Amerikaanse meldingen kregen een algemene kop. In Miami stond de Coastal
   Flood Warning (ernst "Severe") onder de kop "Officiële weerwaarschuwing", terwijl mildere meldingen een eigen titel hadden.
   Meer dan drie meldingen werden zonder aanduiding afgekapt, en de ernst stond alleen in een gekleurde rand.

   Gecontroleerd:
   - elke melding toont haar specifieke gebeurtenis: een Nederlandse titel bij een zekere vertaling, anders de officiële Engelse
     naam (lang="en"); nooit een algemene kop, ook niet voor een onbekend type;
   - een tekstueel ernstlabel uit de bron (CAP severity), uitdrukkelijk als ernst volgens de Amerikaanse weerdienst; geen kleurcode;
   - de volgorde volgt de ernst van de bron en daarna de soort melding (warning, watch, advisory, statement);
   - elke actieve waarschuwing blijft bereikbaar: de dringendste drie staan direct zichtbaar, de rest in een uitklap met het aantal,
     met toetsenbord te bedienen en open blijvend na verversen;
   - niets wordt samengevoegd (een werkelijk identiek object wordt één kaart); de volledige officiële tekst en titel blijven bij elke kaart;
   - de briefing noemt de dringendste melding één keer, met dezelfde titel als de kaart;
   - een antwoord in de oude vorm (zonder de nieuwe velden) blijft werken, zonder algemene kop;
   - geen onvertaalde tekst in het Engels, geen scriptfouten, geen horizontale overflow op 390 px.
   De testdata komt uit de echte servercode (lib/waarschuwingen.cjs) met nagebootste NWS-meldingen, zodat testdata en productie dezelfde vorm hebben. */

const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const { chromium } = require("playwright");
const { bouw } = require("../data.js");
const handler = require("../lib/waarschuwingen.cjs");

const PUBLIC = path.join(__dirname, "..", "public");
if (!fs.existsSync(path.join(PUBLIC, "index.html"))) throw new Error("public/index.html ontbreekt; draai eerst de build.");
const mime = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".css": "text/css; charset=utf-8" };

const d = bouw({ temp: () => 22, tempNu: 22, pp: () => 12, pr: () => 0, som: 0, ws: 2, wsNu: 2, cc: () => 55, ccNu: 55, wg: () => 8, wc: () => 3, wcNu: 53 });
Object.assign(d.current, { time: "2026-07-22T14:17", interval: 900, temperature_2m: 22, apparent_temperature: 22, is_day: 1, precipitation: 0, weather_code: 3, cloud_cover: 55, wind_speed_10m: 2, wind_direction_10m: 225, wind_gusts_10m: 8, pressure_msl: 1014, visibility: 16000 });
d.elevation = 3; d.latitude = 25.77; d.longitude = -80.19; d.minutely_15 = null;
d.daily.precipitation_probability_max = d.daily.time.map(() => 12); d.daily.precipitation_sum = d.daily.time.map(() => 0); d.daily.weather_code = d.daily.time.map(() => 3); d.daily.sunshine_duration = d.daily.time.map(() => 6 * 3600);
const air = { current: { european_aqi: 30, us_aqi: 40 }, hourly: { time: [d.current.time], alder_pollen: [0], birch_pollen: [0], grass_pollen: [0], mugwort_pollen: [0], ragweed_pollen: [0], olive_pollen: [0] } };
const NU = Date.UTC(2026, 6, 22, 12, 17, 0);

/* Een NWS-melding zoals api.weather.gov die levert (alleen de velden die de server leest). */
const GEBIED = "Coastal Broward County; Coastal Miami Dade County";
const MIAMI_TEKST = "* WHAT...For the Coastal Flood Advisory, moderate coastal flooding. For the High Rip Current Risk, dangerous rip currents. * WHERE...Coastal Broward County and Coastal Miami Dade County. * WHEN...For the Coastal Flood Advisory, until 8 PM EDT Saturday. For the High Rip Current Risk, until 8 PM EDT Saturday. * IMPACTS...Minor coastal flooding is expected.";
const feature = (event, severity, extra) => ({ properties: Object.assign({
  event, severity, status: "Actual", messageType: "Alert", headline: event + " issued",
  description: "* WHAT..." + event + " conditions. * WHERE...Test County. * WHEN...Until 8 PM EDT. * IMPACTS...Test impacts.", instruction: "",
  onset: "2026-07-22T04:36:00Z", effective: "2026-07-22T04:36:00Z", ends: "2026-07-23T00:00:00Z", expires: "2026-07-23T00:00:00Z", areaDesc: GEBIED
}, extra || {}) });

/* De antwoordlijst van de echte server voor een nagebootste NWS-feed. */
async function apiLijst(features) {
  const echteFetch = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ features }) });
  try {
    const res = { setHeader() {}, status() { return res; }, json(v) { res.body = v; return res; } };
    await handler({ query: { lat: "25.77", lon: "-80.19", land: "US" } }, res);
    assert.equal(res.body.dekking, true);
    return res.body.lijst;
  } finally { global.fetch = echteFetch; }
}
/* Het antwoord van vóór deze wijziging: zonder titelNl, klasse, ernstNl, prioriteit en taal. */
const oudeVorm = lijst => lijst.map(w => { const { titelNl, klasse, ernstNl, prioriteit, taal, ...rest } = w; return rest; });

function bouwServer(lijst) {
  let html = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8");
  const stub = `<script>Date.now=()=>${NU};window.fetch=async function(url){const u=String(url);
    const payload=u.includes('/api/neerslag')?${JSON.stringify({ beschikbaar: false, reden: "test" })}:u.includes('/api/waarschuwingen')?${JSON.stringify({ bron: "National Weather Service", dekking: true, lijst, plaatsSpecifiek: true, land: "US" })}:u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}:u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({ results: [{ name: "Miami", latitude: 25.77, longitude: -80.19, admin1: "Florida", country_code: "US" }] })}:u.includes('/api/plaatsnaam')?${JSON.stringify({ naam: "Miami", land: "US", bron: "test" })}:${JSON.stringify(d)};
    return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};};
    try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
  html = html.replace("</head>", stub + "</head>");
  return http.createServer((req, res) => {
    const p = (req.url || "").split("?")[0];
    if (p === "/" || p === "/index.html") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html); return; }
    const f = path.join(PUBLIC, p.replace(/^\//, ""));
    if (f.startsWith(PUBLIC + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { "content-type": mime[path.extname(f).toLowerCase()] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); }
    else { res.writeHead(404); res.end("not found"); }
  });
}

const NL_ZONDER_VERTALING = /waarschuw|rip|coastal|beach|surf|stroming|overstroming|national weather|officiële|ernst|andere/i;
const ALGEMEEN = /^(Officiële weerwaarschuwing|Official weather warning)\b/;

const ERNST_NL = { gering: "Ernst volgens de Amerikaanse weerdienst: gering.", matig: "Ernst volgens de Amerikaanse weerdienst: matig.", ernstig: "Ernst volgens de Amerikaanse weerdienst: ernstig.", extreem: "Ernst volgens de Amerikaanse weerdienst: extreem.", "niet opgegeven": "Ernst volgens de Amerikaanse weerdienst: niet opgegeven." };
const ERNST_EN = { minor: "Severity according to the US National Weather Service: minor.", moderate: "Severity according to the US National Weather Service: moderate.", severe: "Severity according to the US National Weather Service: severe.", extreme: "Severity according to the US National Weather Service: extreme.", "not stated": "Severity according to the US National Weather Service: not stated." };

const M = (event, ernstNl, ernstEn, severity, titelNl, uitlegNl, uitlegEn) => ({ event, ernstNl, ernstEn, severity, titelNl, uitlegNl, uitlegEn });
const ZIN_WAARSCHUWING = [/een waarschuwing uitgegeven\.$/, /has issued a warning for this location\.$/];
const ZIN_ADVIES = [/een advies uitgegeven\.$/, /has issued an advisory for this location\.$/];
const ZIN_WATCH = [/een waakzaamheidsmelding \(watch\) uitgegeven\.$/, /has issued a watch for this location\./];
const ZIN_MELDING = [/een officiële melding uitgegeven\.$/, /has issued an official notice for this location\.$/];
const ZIN_RIP = [/een officiële melding uitgegeven\. Een rip current is een sterke, smalle stroming die van de kust af loopt/, /has issued an official notice for this location\. A rip current is a strong, narrow current that flows away from the shore/];

const SITUATIES = [
  { naam: "Miami (25 oktober): een Severe-waarschuwing staat vóór een Moderate- en een Minor-melding, ongeacht de volgorde van de bron",
    features: [feature("Rip Current Statement", "Moderate", { description: MIAMI_TEKST }), feature("Coastal Flood Advisory", "Minor", { description: MIAMI_TEKST }),
      feature("Coastal Flood Warning", "Severe", { description: MIAMI_TEKST, onset: "2026-07-23T02:00:00Z", ends: "2026-07-25T20:00:00Z" })],
    volgorde: [
      M("Coastal Flood Warning", "ernstig", "severe", "oranje", "Waarschuwing voor overstroming aan de kust", ...ZIN_WAARSCHUWING),
      M("Rip Current Statement", "matig", "moderate", "geel", "Melding over gevaarlijke stromingen (rip currents)", ...ZIN_RIP),
      M("Coastal Flood Advisory", "gering", "minor", "geel", "Advies voor overstroming aan de kust", ...ZIN_ADVIES)],
    zichtbaar: 3, briefing: [/^Officiële weerwaarschuwing: Waarschuwing voor overstroming aan de kust\. /, /^Official weather warning: Coastal Flood Warning\. /], mobiel: true },
  { naam: "Hatteras (25 oktober): een Moderate Beach Hazards Statement staat vóór twee Minor advisories",
    features: [feature("Coastal Flood Advisory", "Minor"), feature("High Surf Advisory", "Minor"), feature("Beach Hazards Statement", "Moderate")],
    volgorde: [
      M("Beach Hazards Statement", "matig", "moderate", "geel", "Melding over gevaren aan het strand", ...ZIN_MELDING),
      M("Coastal Flood Advisory", "gering", "minor", "geel", "Advies voor overstroming aan de kust", ...ZIN_ADVIES),
      M("High Surf Advisory", "gering", "minor", "geel", "Advies voor hoge branding", ...ZIN_ADVIES)],
    zichtbaar: 3, briefing: [/^Officiële weerwaarschuwing: Melding over gevaren aan het strand\. /, /^Official weather warning: Beach Hazards Statement\. /] },
  { naam: "onzekere vertaling, onbekend type en onbekende ernst: de officiële naam blijft staan, nooit een algemene kop",
    features: [feature("Hydrologic Outlook", "Unknown", { ends: null }), feature("Special Marine Warning", "Moderate"), feature("Volcanic Fog Warning", "Severe")],
    volgorde: [
      M("Volcanic Fog Warning", "ernstig", "severe", "oranje", null, ...ZIN_WAARSCHUWING),
      M("Special Marine Warning", "matig", "moderate", "geel", null, ...ZIN_WAARSCHUWING),
      M("Hydrologic Outlook", "niet opgegeven", "not stated", "", null, ...ZIN_MELDING)],
    zichtbaar: 3, briefing: [/^Officiële weerwaarschuwing: Volcanic Fog Warning\. /, /^Official weather warning: Volcanic Fog Warning\. /] },
  { naam: "zeven meldingen (orkaan): de dringendste drie direct, vier in de uitklap",
    features: [feature("Small Craft Advisory", "Minor", { onset: "2026-07-22T09:00:00Z" }), feature("High Surf Advisory", "Minor", { onset: "2026-07-22T05:00:00Z" }),
      feature("Rip Current Statement", "Moderate"), feature("Flood Watch", "Severe"), feature("Tropical Storm Warning", "Severe"),
      feature("Storm Surge Warning", "Extreme", { onset: "2026-07-22T07:00:00Z" }), feature("Hurricane Warning", "Extreme", { onset: "2026-07-22T06:00:00Z" })],
    volgorde: [
      M("Hurricane Warning", "extreem", "extreme", "rood", "Orkaanwaarschuwing", ...ZIN_WAARSCHUWING),
      M("Storm Surge Warning", "extreem", "extreme", "rood", "Waarschuwing voor stormvloed", ...ZIN_WAARSCHUWING),
      M("Tropical Storm Warning", "ernstig", "severe", "oranje", "Waarschuwing voor een tropische storm", ...ZIN_WAARSCHUWING),
      M("Flood Watch", "ernstig", "severe", "oranje", "Waakzaamheid voor overstromingen", ...ZIN_WATCH),
      M("Rip Current Statement", "matig", "moderate", "geel", "Melding over gevaarlijke stromingen (rip currents)", ...ZIN_RIP),
      M("High Surf Advisory", "gering", "minor", "geel", "Advies voor hoge branding", ...ZIN_ADVIES),
      M("Small Craft Advisory", "gering", "minor", "geel", "Advies voor kleine vaartuigen", ...ZIN_ADVIES)],
    zichtbaar: 3, uitklap: ["+ 4 andere waarschuwingen", "+ 4 other warnings"], briefing: [/^Officiële weerwaarschuwing: Orkaanwaarschuwing\. /, /^Official weather warning: Hurricane Warning\. /], mobiel: true },
  { naam: "vier meldingen: één in de uitklap, enkelvoud",
    features: [feature("Wind Advisory", "Moderate", { onset: "2026-07-22T08:00:00Z" }), feature("Heat Advisory", "Moderate", { onset: "2026-07-22T05:00:00Z" }), feature("Flood Watch", "Severe"), feature("Flood Warning", "Severe")],
    volgorde: [
      M("Flood Warning", "ernstig", "severe", "oranje", "Waarschuwing voor overstromingen", ...ZIN_WAARSCHUWING),
      M("Flood Watch", "ernstig", "severe", "oranje", "Waakzaamheid voor overstromingen", ...ZIN_WATCH),
      M("Heat Advisory", "matig", "moderate", "geel", "Hitteadvies", ...ZIN_ADVIES),
      M("Wind Advisory", "matig", "moderate", "geel", "Windadvies", ...ZIN_ADVIES)],
    zichtbaar: 3, uitklap: ["+ 1 andere waarschuwing", "+ 1 other warning"], briefing: [/^Officiële weerwaarschuwing: Waarschuwing voor overstromingen\. /, /^Official weather warning: Flood Warning\. /] },
  { naam: "werkelijk identiek object (zelfde titel, einde en gebied) wordt één kaart",
    features: [feature("Rip Current Statement", "Moderate"), feature("Rip Current Statement", "Moderate")],
    volgorde: [M("Rip Current Statement", "matig", "moderate", "geel", "Melding over gevaarlijke stromingen (rip currents)", ...ZIN_RIP)],
    zichtbaar: 1, briefing: [/^Officiële weerwaarschuwing: Melding over gevaarlijke stromingen \(rip currents\)\. /, /^Official weather warning: Rip Current Statement\. /] },
  { naam: "zelfde titel, ander einde: afzonderlijke meldingen blijven afzonderlijk",
    features: [feature("Rip Current Statement", "Moderate"), feature("Rip Current Statement", "Moderate", { ends: "2026-07-24T00:00:00Z", expires: "2026-07-24T00:00:00Z" })],
    volgorde: [M("Rip Current Statement", "matig", "moderate", "geel", "Melding over gevaarlijke stromingen (rip currents)", ...ZIN_RIP), M("Rip Current Statement", "matig", "moderate", "geel", "Melding over gevaarlijke stromingen (rip currents)", ...ZIN_RIP)],
    zichtbaar: 2, briefing: [/^Officiële weerwaarschuwing: Melding over gevaarlijke stromingen \(rip currents\)\. /, /^Official weather warning: Rip Current Statement\. /] },
  { naam: "antwoord in de oude vorm (zonder titelNl, klasse, ernstNl): oudere tabel als terugval, geen algemene kop",
    features: [feature("Rip Current Statement", "Moderate"), feature("Beach Hazards Statement", "Moderate")], oud: true,
    volgorde: [
      { event: "Rip Current Statement", ernstNl: null, severity: "geel", titelNl: "Melding over gevaarlijke stromingen (rip currents)", uitlegNl: ZIN_RIP[0], uitlegEn: ZIN_RIP[1] },
      { event: "Beach Hazards Statement", ernstNl: null, severity: "geel", titelNl: null, uitlegNl: ZIN_MELDING[0], uitlegEn: ZIN_MELDING[1] }],
    zichtbaar: 2, briefing: [/^Officiële weerwaarschuwing: Melding over gevaarlijke stromingen \(rip currents\)\. /, /^Official weather warning: Rip Current Statement\. /] }
];

async function meet(page) {
  return page.evaluate(() => {
    const t = el => ((el && el.textContent) || "").replace(/\s+/g, " ").trim();
    /* checkVisibility() weet dat de inhoud van een dichte <details> niet wordt getoond; een rechthoek alleen zegt dat niet. */
    const zichtbaar = el => el.checkVisibility() && el.getBoundingClientRect().height > 0;
    const uitklap = document.querySelector("#waarschuwingen details.waarsch-meer");
    const kaarten = [...document.querySelectorAll("#waarschuwingen .waarsch")].map(k => ({
      titel: t(k.querySelector("h3")), titelEngelsMarkering: !!k.querySelector("h3 [lang=en]"), severity: k.getAttribute("data-ui-severity"),
      uitleg: t(k.querySelector(".final-warning-explanation")),
      officieleTitel: t(k.querySelector(".final-warning-official-meta span")),
      officieleTekst: t(k.querySelector(".final-warning-official-text")),
      meta: t(k.querySelector(".waarsch-meta")), zichtbaar: zichtbaar(k), inUitklap: !!k.closest("details.waarsch-meer")
    }));
    return { kaarten, brief: t(document.getElementById("brief")), actief: (S.actieveWaarschuwingen || []).length,
      uitklap: uitklap ? { samenvatting: t(uitklap.querySelector(":scope > summary")), open: uitklap.open } : null,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      /* Alleen wat na de laatste render nog onvertaald op de pagina staat; een tussenstand die direct door de
         verrijkte kaart wordt vervangen telt niet. */
      ontbreekt: [...(window.__WIW_TAAL_ONTBREEKT__ || [])].filter(x => document.body.textContent.replace(/\s+/g, " ").includes(x)) };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: require("./vind-browser.js").vindBrowser() || undefined });
  let n = 0;
  try {
    for (const taal of ["nl", "en"]) for (const sit of SITUATIES) for (const mobiel of sit.mobiel ? [false, true] : [false]) {
      const en = taal === "en", L = `${taal}${mobiel ? " 390px" : ""}: ${sit.naam}`;
      const api = await apiLijst(sit.features), lijst = sit.oud ? oudeVorm(api) : api;
      const srv = bouwServer(lijst); await new Promise(r => srv.listen(0, "127.0.0.1", r));
      const context = await browser.newContext({ viewport: mobiel ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobiel, locale: en ? "en-GB" : "nl-NL", timezoneId: "Europe/Amsterdam", serviceWorkers: "block" });
      try {
        const page = await context.newPage(), fouten = [];
        page.on("pageerror", e => fouten.push(String(e)));
        if (en) await page.addInitScript(() => { try { localStorage.setItem("weerbriefing.taal.v1", "en"); } catch (e) {} });
        await page.goto(`http://127.0.0.1:${srv.address().port}/?lat=25.77&lon=-80.19&plaats=Miami&land=US`, { waitUntil: "networkidle" });
        await page.waitForFunction(() => document.querySelectorAll("#waarschuwingen .waarsch .final-warning-explanation").length > 0, null, { timeout: 10000 });
        await page.waitForTimeout(1500);
        const r = await meet(page);
        const verwacht = sit.volgorde, nAantal = verwacht.length;

        assert.equal(r.kaarten.length, nAantal, `${L}: aantal kaarten (${r.kaarten.map(k => k.titel)})`);
        assert.equal(r.actief, nAantal, `${L}: elke actieve waarschuwing staat in de app`);
        r.kaarten.forEach((k, i) => {
          const v = verwacht[i], heeftNl = !!v.titelNl && !en;
          assert.equal(k.titel, heeftNl ? v.titelNl : v.event, `${L}: titel van kaart ${i + 1} (volgorde op ernst van de bron)`);
          assert.doesNotMatch(k.titel, ALGEMEEN, `${L}: kaart ${i + 1} heeft geen algemene kop`);
          assert.equal(k.titelEngelsMarkering, !heeftNl, `${L}: kaart ${i + 1}: de officiële Engelse naam is als Engels gemarkeerd (uitspraak), de Nederlandse titel niet`);
          assert.equal(k.severity, v.severity, `${L}: accent van kaart ${i + 1}`);
          assert.match(k.uitleg, en ? /^Explanation from watishetweer\.nl: / : /^Uitleg van watishetweer\.nl: /, `${L}: kaart ${i + 1} behoudt het uitlegkopje`);
          assert.match(k.uitleg, en ? v.uitlegEn : v.uitlegNl, `${L}: uitleg van kaart ${i + 1}: "${k.uitleg}"`);
          assert(!/officiële waarschuwing uitgegeven|official warning for this location/.test(k.uitleg), `${L}: geen algemene uitlegzin bij kaart ${i + 1}`);
          /* Ernst: alleen wat de bron zegt, als tekst, met bronvermelding; geen kleurcode. */
          if (v.ernstNl) {
            assert(k.meta.startsWith((en ? ERNST_EN : ERNST_NL)[en ? v.ernstEn : v.ernstNl]), `${L}: ernstlabel van kaart ${i + 1}: "${k.meta}"`);
            assert.doesNotMatch(k.meta, /KNMI|MeteoAlarm|code (geel|oranje|rood)|(yellow|orange|red) (code|warning)/i, `${L}: de ernst is geen officiële kleurcode`);
          } else assert.doesNotMatch(k.meta, /Ernst volgens|Severity according/, `${L}: zonder ernst in het antwoord geen verzonnen label`);
          assert.match(k.meta, en ? /Valid until / : /Geldig tot /, `${L}: geldigheid van kaart ${i + 1} blijft`);
          /* Niets wordt samengevoegd of ingekort: de volledige officiële tekst en de officiële titel blijven bij elke kaart. */
          const bron = api.find(w => w.titel === v.event);
          assert.equal(k.officieleTekst, bron.tekst, `${L}: officiële tekst van kaart ${i + 1} blijft volledig`);
          assert.equal(k.officieleTitel, v.event, `${L}: officiële titel van kaart ${i + 1} blijft letterlijk`);
        });
        assert.match(r.brief, sit.briefing[en ? 1 : 0], `${L}: de briefing noemt de dringendste melding: "${r.brief}"`);
        assert.equal((r.brief.match(/Officiële weerwaarschuwing|Official weather warning/g) || []).length, 1, `${L}: de briefing noemt de melding één keer`);
        assert(!/Officiële weerwaarschuwing: Code|:\s[^.]*:\s/.test(r.brief.split(". ")[0]), `${L}: de eerste briefingzin heeft één dubbele punt: "${r.brief.split(". ")[0]}"`);

        /* Zichtbaarheid: de dringendste drie direct, de rest alleen via de uitklap. */
        assert.equal(r.kaarten.filter(k => k.zichtbaar).length, sit.zichtbaar, `${L}: direct zichtbare kaarten ${JSON.stringify(r.kaarten.map(k => [k.zichtbaar, k.inUitklap]))} uitklap ${JSON.stringify(r.uitklap)}`);
        assert.equal(r.kaarten.filter(k => k.inUitklap).length, nAantal - sit.zichtbaar, `${L}: kaarten in de uitklap`);
        if (sit.uitklap) {
          assert.equal(r.uitklap.samenvatting, sit.uitklap[en ? 1 : 0], `${L}: samenvatting van de uitklap`);
          assert.equal(r.uitklap.open, false, `${L}: de uitklap is dicht`);
          assert(r.kaarten.slice(sit.zichtbaar).every(k => !k.zichtbaar), `${L}: kaarten in de dichte uitklap zijn niet zichtbaar`);
          /* Toetsenbord: de samenvatting is een knop met Enter en Spatie; de kaarten worden bereikbaar en blijven open na verversen. */
          await page.focus("#waarschuwingen details.waarsch-meer > summary");
          await page.keyboard.press("Enter");
          let o = await meet(page);
          assert.equal(o.uitklap.open, true, `${L}: Enter opent de uitklap`);
          assert(o.kaarten.every(k => k.zichtbaar), `${L}: na openen zijn alle ${nAantal} meldingen zichtbaar`);
          await page.keyboard.press("Space");
          o = await meet(page);
          assert.equal(o.uitklap.open, false, `${L}: Spatie sluit de uitklap`);
          await page.keyboard.press("Space");
          await page.evaluate(() => waarschuwingen());
          await page.waitForFunction(() => document.querySelectorAll("#waarschuwingen .waarsch .final-warning-explanation").length > 0, null, { timeout: 10000 });
          await page.waitForTimeout(500);
          o = await meet(page);
          assert.equal(o.kaarten.length, nAantal, `${L}: na verversen nog steeds alle meldingen`);
          assert.equal(o.uitklap && o.uitklap.open, true, `${L}: een geopende uitklap blijft open na verversen`);
        } else assert.equal(r.uitklap, null, `${L}: geen uitklap bij ${nAantal} meldingen`);

        if (en) {
          const weg = r.ontbreekt.filter(s => NL_ZONDER_VERTALING.test(s));
          assert.deepEqual(weg, [], `${L}: geen onvertaalde waarschuwingstekst: ${JSON.stringify(weg)}`);
          r.kaarten.forEach((k, i) => assert.doesNotMatch(k.titel + " " + k.uitleg + " " + k.meta, /Officiële|Uitleg van|weerdienst|gevaarlijke|overstroming|Ernst volgens|andere waarschuwing/, `${L}: kaart ${i + 1} is volledig Engels`));
        }
        if (mobiel) assert(r.overflow <= 0, `${L}: horizontale overflow van ${r.overflow}px`);
        assert.deepEqual(fouten, [], `${L}: scriptfouten`);
        n++;
      } finally { await context.close(); srv.close(); }
    }
    console.log(`Waarschuwingen: ${n} situaties (NL/EN, desktop en 390 px): specifieke gebeurtenis in elke kop, ernstlabel uit de bron, volgorde op bronernst, alle meldingen bereikbaar via toegankelijke uitklap, identieke objecten één kaart, briefing noemt de dringendste melding eenmaal.`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
