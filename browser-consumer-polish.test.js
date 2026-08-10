"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const assert = require("assert");
const { chromium, webkit } = require("playwright");
const { bouw } = require("./data.js");

// Reproduceert bewust het iPhone-randgeval uit de fysieke screenshots:
// 21:53 lokale tijd, actuele temperatuur 25 °C en een uurmodelwaarde van 26 °C
// vlak bij 'nu'. De interface mag daar nog maar één actuele temperatuur van maken.
const d = bouw({
  temp: (u) => u === 21 ? 26 : +(19 + 4 * Math.sin((u - 7) / 24 * Math.PI * 2)).toFixed(1),
  tempNu: 25,
  pp: () => 1,
  pr: () => 0,
  som: 0,
  ws: 1,
  wsNu: 1,
  cc: () => 20,
  ccNu: 20,
  wg: () => 9,
  wc: () => 0,
  wcNu: 0
});
d.current.time = "2026-07-22T21:53";
d.current.interval = 900;
d.current.temperature_2m = 25;
d.current.apparent_temperature = 25;
d.current.is_day = 0;
d.current.precipitation = 0;
d.current.weather_code = 0;
d.current.cloud_cover = 20;
d.current.wind_speed_10m = 1;
d.current.wind_direction_10m = 67.5;
d.current.wind_gusts_10m = 9;
d.current.pressure_msl = 1013;
d.current.visibility = 16000;
d.elevation = 3;
d.latitude = 52.35;
d.longitude = 5.26;
d.daily.sunshine_duration = d.daily.time.map(() => 11.5 * 3600);
d.daily.sunset = d.daily.time.map(t => t + "T21:30");
d.daily.sunrise = d.daily.time.map(t => t + "T06:13");

// Druk 0,4 hPa hoger dan circa drie uur geleden: dit hoort als 'Vrijwel stabiel'
// te lezen, niet als een betekenisvolle numerieke daling/stijging.
for (let i = 0; i < d.hourly.time.length; i++) {
  const uur = d.hourly.time[i].slice(11, 13);
  if (d.hourly.time[i].slice(0, 10) === "2026-07-22" && (uur === "18" || uur === "19")) {
    d.hourly.pressure_msl[i] = 1012.6;
  }
  // 5,9 wordt zichtbaar 6. De zichtbare categorie moet daarom óók die 6 volgen:
  // UV 6 is hoog, niet het verborgen-decimaal-oordeel 'matig'.
  if (d.hourly.time[i].slice(0, 10) === "2026-07-22" && uur === "15") {
    d.hourly.uv_index[i] = 5.9;
  }
}

// Kwartierdata rond de nieuwe actuele tijd, volledig droog.
d.minutely_15 = { time: [], precipitation: [], rain: [], showers: [], snowfall: [], weather_code: [] };
for (let i = 1; i <= 8; i++) {
  const ms = Date.UTC(2026, 6, 22, 19, 53) + i * 15 * 60000;
  const t = new Date(ms + 2 * 3600000).toISOString().slice(0, 16);
  d.minutely_15.time.push(t);
  d.minutely_15.precipitation.push(0);
  d.minutely_15.rain.push(0);
  d.minutely_15.showers.push(0);
  d.minutely_15.snowfall.push(0);
  d.minutely_15.weather_code.push(0);
}

const air = {
  current: { european_aqi: 38, us_aqi: 45 },
  hourly: {
    time: [d.current.time],
    alder_pollen: [0],
    birch_pollen: [0],
    grass_pollen: [9],
    mugwort_pollen: [6],
    ragweed_pollen: [0],
    olive_pollen: [0]
  }
};

let html = fs.readFileSync(path.join(__dirname, "public/index.html"), "utf8");
const fixedNow = Date.UTC(2026, 6, 22, 19, 53); // 21:53 Europe/Amsterdam
const stub = `<script>
Date.now=()=>${fixedNow};
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({ bron: "test", dekking: true, lijst: [], land: "NL" })}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}
    :u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({ results: [{ name: "Amsterdam", latitude: 52.37, longitude: 4.90, admin1: "Noord-Holland", country_code: "NL" }] })}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({ naam: "Almere", land: "NL", bron: "test" })}
    :${JSON.stringify(d)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html = html.replace("</head>", stub + "</head>");

const server = http.createServer((req, res) => {
  const pathname = (req.url || "").split("?")[0];
  if (pathname === "/" || pathname === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  const rel = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const file = path.join(__dirname, "public", rel);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    const ext = path.extname(file).toLowerCase();
    const types = { ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png" };
    res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  } else {
    res.writeHead(404);
    res.end("not found");
  }
});

async function controleer(page, naam, modus) {
  const fouten = [];
  page.on("pageerror", e => fouten.push(String(e)));
  page.on("console", m => { if (m.type() === "error") fouten.push(m.text()); });

  await page.goto(`http://127.0.0.1:${server.address().port}/?lat=52.35&lon=5.26&plaats=Almere&land=NL`, { waitUntil: "networkidle" });
  await page.waitForSelector("#app", { state: "visible" });

  const resultaat = await page.evaluate(() => {
    const chart = document.getElementById("chart");
    const nuTeksten = [...chart.querySelectorAll("text")]
      .map(el => (el.textContent || "").trim())
      .filter(t => /^nu(?:\s-?\d+°)?$/.test(t));
    const gewoneTemperaturen = [...chart.querySelectorAll("text")]
      .filter(el => /^-?\d+°$/.test((el.textContent || "").trim()) && String(el.getAttribute("font-family") || "").includes("Bodoni"));
    let bots = 0;
    for (let i = 0; i < gewoneTemperaturen.length; i++) {
      for (let j = i + 1; j < gewoneTemperaturen.length; j++) {
        const a = gewoneTemperaturen[i].getBoundingClientRect();
        const b = gewoneTemperaturen[j].getBoundingClientRect();
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) bots++;
      }
    }
    const sun = document.getElementById("suntimes");
    const sunRijen = sun ? [...sun.querySelectorAll(".zonregel")].map(rij => ({
      dag: ((rij.querySelector(".zondag") || {}).textContent || "").trim(),
      tekst: (rij.textContent || "").replace(/\s+/g, " ").trim()
    })) : [];
    const uv = document.getElementById("uv");
    const pollen = [...document.querySelectorAll("#aq .stat")]
      .find(el => /^Pollen gras$/.test((el.querySelector(".eyebrow") || {}).textContent || ""));
    const nachtRijen = [...document.querySelectorAll("#nights .row.night:not(.kop)")].map(rij => ({
      score: ((rij.querySelector(".score") || {}).textContent || "").trim(),
      advies: ((rij.querySelector(".nachtadvies") || {}).textContent || "").trim(),
      bewolking: ((rij.querySelector(".nmeta:not(.wide)") || {}).textContent || "").replace(/\s+/g, " ").trim(),
      balk: parseFloat(((rij.querySelector(".sbar i") || {}).style || {}).width || "0")
    }));
    const maanGebied = [document.getElementById("moonlab"), document.getElementById("nights")].filter(Boolean);
    const maanTekst = maanGebied.map(el => el.textContent || "").join(" ");
    const maanSvgs = maanGebied.reduce((n, el) => n + el.querySelectorAll(".maan-fase-svg").length, 0);
    const dagTeksten = [...document.querySelectorAll("#days .row.day:not(.kop) .dcond")].map(el => (el.textContent || "").trim());
    return {
      heroTemp: (document.getElementById("t") || {}).textContent || "",
      nuTeksten,
      labels: gewoneTemperaturen.length,
      bots,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      sunDag: sunRijen[0] ? sunRijen[0].dag : "",
      sunTekst: sun ? sun.textContent.replace(/\s+/g, " ").trim() : "",
      sunRijen,
      sunOverflow: sun ? sun.scrollWidth - sun.clientWidth : 0,
      hint: (document.getElementById("charthint") || {}).textContent || "",
      briefing: (document.getElementById("brief") || {}).textContent || "",
      uvKop: uv && uv.parentElement ? (uv.parentElement.querySelector(".eyebrow") || {}).textContent || "" : "",
      uvWaarde: uv ? uv.textContent.trim() : "",
      uvSub: (document.getElementById("uvsub") || {}).textContent || "",
      drukSub: (document.getElementById("pressub") || {}).textContent || "",
      recent: (document.getElementById("prec") || {}).textContent || "",
      recentSub: (document.getElementById("precsub") || {}).textContent || "",
      nachtAdvies: document.querySelectorAll("#nights .nachtadvies").length,
      nachtMaan: document.querySelectorAll("#nights .nachtmaan").length,
      nachtRijen,
      maanTekst,
      maanSvgs,
      dagTeksten,
      pollenSub: pollen && pollen.querySelector(".ssub") ? pollen.querySelector(".ssub").textContent.trim() : ""
    };
  });

  assert.equal(resultaat.heroTemp, "25", `${naam} ${modus}: hero-temperatuur`);
  assert.deepEqual(resultaat.nuTeksten, ["nu 25°"], `${naam} ${modus}: exact één actuele grafiektemperatuur`);
  assert.ok(resultaat.labels >= 5, `${naam} ${modus}: voldoende temperatuurlabels`);
  assert.equal(resultaat.bots, 0, `${naam} ${modus}: temperatuurlabels botsen`);
  assert.ok(resultaat.overflow <= 2, `${naam} ${modus}: horizontale overflow`);

  // 21:53 is na de zonsondergang van 21:30. De kop boven de grafiek mag dan
  // geen reeds verstreken zonsopkomst van vandaag meer naast toekomstige tijden
  // zetten: hij schakelt naar één duidelijk daggebonden blok voor morgen.
  assert.equal(resultaat.sunRijen.length, 1, `${naam} ${modus}: één relevante astronomische dag na zonsondergang`);
  assert.equal(resultaat.sunDag, "Morgen", `${naam} ${modus}: morgen staat als eigen zonskop`);
  assert.ok(/zon op 06:13/i.test(resultaat.sunTekst), `${naam} ${modus}: exacte zonsopkomst van morgen blijft zichtbaar`);
  assert.ok(/zon onder 21:30/i.test(resultaat.sunTekst), `${naam} ${modus}: exacte zonsondergang van morgen blijft zichtbaar`);
  assert.ok(!/Vandaag/i.test(resultaat.sunTekst), `${naam} ${modus}: geen verstreken vandaag-momenten na zonsondergang`);
  assert.ok(resultaat.sunOverflow <= 1, `${naam} ${modus}: zoninformatie heeft geen horizontale overflow`);
  assert.equal(resultaat.hint, "Houd de grafiek vast voor details.", `${naam} ${modus}: korte grafiekhint`);

  assert.ok(!/wind komt|draait naar/i.test(resultaat.briefing), `${naam} ${modus}: 1 Bft krijgt geen briefing over richtingsdraai`);
  assert.ok(!/het is nu\s+-?\d+/i.test(resultaat.briefing), `${naam} ${modus}: briefing herhaalt actuele temperatuur niet`);
  assert.equal(resultaat.uvKop, "UV-piek vandaag", `${naam} ${modus}: UV is expliciet dagpiek`);
  assert.equal(resultaat.uvWaarde, "6", `${naam} ${modus}: UV-piek is consumentgericht afgerond`);
  assert.ok(/Rond 15:00 · hoog\./.test(resultaat.uvSub), `${naam} ${modus}: zichtbaar UV-getal en oordeel gebruiken dezelfde grens`);
  assert.equal(resultaat.drukSub, "Vrijwel stabiel.", `${naam} ${modus}: minieme luchtdrukverandering zonder schijnprecisie`);
  assert.equal(resultaat.recent, "Droog", `${naam} ${modus}: recente droge tegel`);
  assert.equal(resultaat.recentSub, "Geen neerslag.", `${naam} ${modus}: recente droge tegel is kort`);

  assert.ok(resultaat.nachtAdvies > 0 && resultaat.nachtMaan > 0, `${naam} ${modus}: Nachtzicht heeft rustige aparte advies- en maanregels`);
  assert.ok(resultaat.nachtRijen.length > 0, `${naam} ${modus}: Nachtzicht heeft beoordeelde nachten`);
  for (const rij of resultaat.nachtRijen) {
    const m = /^(\d+)\/10$/.exec(rij.score);
    if (!m) continue;
    const score = Number(m[1]);
    const oordeel = score >= 9 ? "uitstekend" : score >= 7 ? "goed" : score >= 5 ? "redelijk" : score >= 4 ? "matig" : "ongunstig";
    assert.ok(rij.advies.toLowerCase().includes(oordeel), `${naam} ${modus}: ${rij.score} en Nachtzicht-oordeel zijn consistent`);
    assert.equal(rij.balk, score * 10, `${naam} ${modus}: ${rij.score} en Nachtzicht-balk zijn consistent`);
    assert.match(rij.bewolking, /^\d+%$/, `${naam} ${modus}: Bewolking-kolom herhaalt het woord niet per rij`);
  }
  assert.ok(resultaat.maanSvgs >= resultaat.nachtMaan + 1, `${naam} ${modus}: maanfase gebruikt monochrome inline-SVG in kop en nachtrijen`);
  assert.ok(!/[🌑🌒🌓🌔🌕🌖🌗🌘]/u.test(resultaat.maanTekst), `${naam} ${modus}: geen platformkleurige maanemoji blijft zichtbaar`);
  assert.ok(resultaat.dagTeksten.every(t => !/neerslagkans/i.test(t)), `${naam} ${modus}: droge weerbeelden dupliceren de aparte neerslagkolom niet`);

  assert.equal(resultaat.pollenSub, "laag", `${naam} ${modus}: pollen geeft kwalitatieve betekenis`);
  assert.deepEqual(fouten, [], `${naam} ${modus}: console/page errors: ${fouten.join(" | ")}`);
}

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    for (const [naam, type] of [["Chromium", chromium], ["WebKit", webkit]]) {
      const browser = await type.launch({ headless: true });
      try {
        for (const [modus, viewport] of [["mobiel", { width: 390, height: 844 }], ["desktop", { width: 1440, height: 1000 }]]) {
          const page = await browser.newPage({ viewport });
          await controleer(page, naam, modus);
          await page.close();
          console.log(`OK  ${naam} ${modus} consumentenpolish`);
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    server.close();
  }
})().catch(err => {
  console.error(err && err.stack || err);
  server.close();
  process.exit(1);
});
