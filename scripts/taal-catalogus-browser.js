"use strict";

/*
 * Rendert de gebouwde site (public/) voor alle taalscenario's, klikt de
 * bediening door en verzamelt iedere tekst die een bezoeker kan zien of
 * horen (tekstnodes, aria-label, title, alt, placeholder, documenttitel).
 * Gebruik: node scripts/taal-catalogus-browser.js [uitvoer.json] [taal]
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");
const { SCENARIOS, GEEN_WAARSCHUWING } = require("./taal-scenarios.js");

const PUBLIC = process.env.TAAL_PUBLIC || path.join(__dirname, "..", "public");
const TYPES = { ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml", ".css": "text/css" };

function stub(sc, taal) {
  const d = sc.forecast();
  const antwoorden = {
    forecast: d,
    lucht: sc.lucht || null,
    waarschuwingen: sc.waarschuwingen || GEEN_WAARSCHUWING,
    waarschuwingenEn: sc.waarschuwingenEn || null,
    knmi: sc.knmi || { beschikbaar: false, provider: null, reden: "geen actuele neerslagprovider voor deze locatie" }
  };
  return `<script>
Date.now=()=>${sc.nu};
try{localStorage.clear();sessionStorage.clear();${taal ? `localStorage.setItem("weerbriefing.taal.v1",${JSON.stringify(taal)});` : ""}}catch(e){}
(function(){
const A=${JSON.stringify(antwoorden)};
const antwoord=p=>({ok:true,status:200,headers:{get:()=>"application/json"},json:async()=>p,text:async()=>JSON.stringify(p),clone:()=>antwoord(p)});
window.fetch=async function(url){
  const u=String(url&&url.url||url||"");
  if(u.includes("air-quality-api.open-meteo.com"))return A.lucht?antwoord(A.lucht):{ok:false,status:503,json:async()=>({}),text:async()=>""};
  if(u.includes("/api/waarschuwingen"))return antwoord(/[?&]taal=en/.test(u)&&A.waarschuwingenEn?A.waarschuwingenEn:A.waarschuwingen);
  if(u.includes("/api/neerslag"))return antwoord(A.knmi);
  if(u.includes("/api/plaatsnaam"))return antwoord({naam:"Almere",land:"NL",bron:"test"});
  if(u.includes("geocoding-api.open-meteo.com"))return antwoord({results:[{name:"Utrecht",latitude:52.09,longitude:5.12,admin1:"Utrecht",country_code:"NL",country:"Nederland"},{name:"Utrecht",latitude:-28.1,longitude:30.3,admin1:"KwaZulu-Natal",country_code:"ZA",country:"Zuid-Afrika"}]});
  if(u.includes("bigdatacloud")||u.includes("nominatim"))return antwoord({city:"Almere",countryCode:"NL"});
  if(u.includes("posthog")||u.includes("google"))return antwoord({});
  return antwoord(A.forecast);
};
try{Object.defineProperty(navigator,"geolocation",{value:undefined,configurable:true});}catch(e){}
})();
</script>`;
}

const EENHEDEN_BRON = fs.readFileSync(path.join(__dirname, "..", "taal", "eenheden.js"), "utf8");
async function verzamel(page) {
  await page.evaluate(bron => { if (!window.WeatherNowTaalEenheden) (0, eval)(bron); }, EENHEDEN_BRON);
  return page.evaluate(() => {
    /* In het Engels telt alleen wat de vertaallaag niet kon vertalen. */
    if (window.__WIW_TAAL_ONTBREEKT__) return [...window.__WIW_TAAL_ONTBREEKT__];
    const uit = window.WeatherNowTaalEenheden.eenheden(document.body).map(e => e.tekst);
    if (document.title) uit.push(document.title.trim());
    return uit;
  });
}

const log = (...a) => { if (process.env.TAAL_VERBOSE) console.log(...a); };
async function doorklikken(page, verzamelaar) {
  await page.evaluate(() => document.querySelectorAll("details").forEach(d => { d.open = true; }));
  verzamelaar(await verzamel(page));
  /* Na iedere klik opnieuw zoeken: de app tekent lijsten opnieuw, dus een
     eenmaal gevonden element kan verdwenen zijn terwijl zijn opvolger er is. */
  const KLIKBAAR = "button:not([disabled]), [role=button], .row.day, [data-modus]";
  const aantal = await page.$$eval(KLIKBAAR, els => els.length);
  for (let i = 0; i < Math.min(aantal, 80); i++) {
    try {
      const el = (await page.$$(KLIKBAAR))[i];
      if (!el || !(await el.isVisible())) continue;
      log("klik", i);
      await el.click({ timeout: 1500, noWaitAfter: true });
      await page.waitForTimeout(120);
      verzamelaar(await verzamel(page));
    } catch (e) { /* bediening die verdwijnt of navigeert telt niet mee */ }
  }
  try {
    const box = await page.$("#chart");
    if (box) {
      const b = await box.boundingBox();
      for (const f of [0.15, 0.35, 0.55, 0.75, 0.95]) { await page.mouse.click(b.x + b.width * f, b.y + b.height * 0.5); await page.waitForTimeout(80); verzamelaar(await verzamel(page)); }
    }
  } catch (e) { /* grafiek optioneel */ }
  try {
    await page.fill("#q", "Utrecht");
    await page.waitForTimeout(900);
    verzamelaar(await verzamel(page));
  } catch (e) { /* zoekveld optioneel */ }
}

/* Rendert alle scenario's in de gevraagde taal en geeft iedere zichtbare of
   hoorbare tekst terug. In het Engels: alleen wat de vertaallaag miste. */
async function verzamelCatalogus({ taal = "", publicDir = PUBLIC, willekeurigAantal = Number(process.env.TAAL_WILLEKEURIG || 0), zaad = Number(process.env.TAAL_ZAAD || 20260930), alleen = process.env.TAAL_ALLEEN || "" } = {}) {
  const teksten = new Map();
  const fouten = [];
  let lijst = [];
  const server = http.createServer((req, res) => {
    const pad = decodeURIComponent((req.url || "/").split("?")[0]);
    /* Het scenario reist mee in de URL (__sc), zodat pagina's parallel kunnen draaien. */
    const sc = lijst[Number(new URL(req.url, "http://x").searchParams.get("__sc") || 0)] || lijst[0];
    let bestand = path.join(publicDir, pad.endsWith("/") ? pad + "index.html" : pad);
    if (!fs.existsSync(bestand) && fs.existsSync(bestand + ".html")) bestand += ".html";
    if (!fs.existsSync(bestand) || !fs.statSync(bestand).isFile()) { res.writeHead(404); res.end(); return; }
    if (bestand.endsWith(".html")) {
      let html = fs.readFileSync(bestand, "utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi, "");
      html = html.replace("<head>", "<head>" + stub(sc, taal));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(bestand)] || "application/octet-stream" });
    fs.createReadStream(bestand).pipe(res);
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const basis = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const extra = [{ naam: "plaatspagina", url: "/weer/oss/", basis: SCENARIOS[0] }, { naam: "plaatsindex", url: "/weer/", basis: SCENARIOS[0] }, { naam: "over", url: "/over/", basis: SCENARIOS[0] }, { naam: "privacy", url: "/privacy.html", basis: SCENARIOS[0] }];
  const willekeurig = willekeurigAantal ? require("./taal-scenarios-willekeurig.js").willekeurigeScenarios(willekeurigAantal, zaad) : [];
  lijst = [...SCENARIOS.map(s => ({ ...s, basis: s })), ...willekeurig, ...extra.map(e => ({ ...e.basis, naam: e.naam, url: e.url }))];
  const taken = [];
  lijst.forEach((sc, index) => { if (!alleen || sc.naam === alleen) for (const maat of [[390, 844], [1366, 900]]) taken.push({ sc, index, maat }); });
  const PARALLEL = Math.max(1, Number(process.env.TAAL_PARALLEL || 4));
  async function werker() {
    for (let taak = taken.shift(); taak; taak = taken.shift()) {
      const { sc, index, maat: [w, h] } = taak;
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      page.on("pageerror", e => fouten.push(`${sc.naam} ${w}: ${e.message}`));
      page.on("crash", () => fouten.push(`${sc.naam} ${w}: pagina gecrasht`));
      const voeg = arr => { for (const s of arr) { if (!teksten.has(s)) teksten.set(s, new Set()); teksten.get(s).add(sc.naam); } };
      const t0 = Date.now();
      try {
        await page.goto(basis + sc.url + (sc.url.includes("?") ? "&" : "?") + "__sc=" + index, { waitUntil: "load", timeout: 30000 });
        await page.waitForTimeout(2500);
        await doorklikken(page, voeg);
      } catch (e) { fouten.push(`${sc.naam} ${w}: ${e.message}`); }
      log(`${sc.naam} ${w}px: ${Date.now() - t0} ms`);
      await ctx.close();
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, werker));
  await browser.close();
  server.close();
  const catalogus = [...teksten.entries()].map(([tekst, sc]) => ({ tekst, scenarios: [...sc].sort() })).sort((a, b) => a.tekst.localeCompare(b.tekst, "nl"));
  return { catalogus, fouten, aantalScenarios: lijst.length };
}

async function main() {
  const uitvoer = process.argv[2] || path.join(process.cwd(), "taal-catalogus.json");
  const { catalogus, fouten, aantalScenarios } = await verzamelCatalogus({ taal: process.argv[3] || "" });
  fs.writeFileSync(uitvoer, JSON.stringify({ aantal: catalogus.length, fouten, teksten: catalogus }, null, 1));
  console.log(`Taalcatalogus: ${catalogus.length} unieke teksten uit ${aantalScenarios} scenario's × 2 breedtes; ${fouten.length} paginafouten → ${uitvoer}`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { verzamel, doorklikken, stub, verzamelCatalogus };
