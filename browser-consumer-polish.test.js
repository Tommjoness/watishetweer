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
    const nachtRijen = [...document.querySelectorAll("#nights .row.night:not(.kop)")].map(rij => {
      const scoreEl = rij.querySelector(".score");
      const balkEl = rij.querySelector(".sbar");
      const scoreRect = scoreEl ? scoreEl.getBoundingClientRect() : null;
      const balkRect = balkEl ? balkEl.getBoundingClientRect() : null;
      return {
        score: (scoreEl && scoreEl.textContent || "").trim(),
        advies: ((rij.querySelector(".nachtadvies") || {}).textContent || "").trim(),
        bewolking: ((rij.querySelector(".nmeta:not(.wide)") || {}).textContent || "").replace(/\s+/g, " ").trim(),
        balk: parseFloat(((rij.querySelector(".sbar i") || {}).style || {}).width || "0"),
        scoreBalkRuimte: scoreRect && balkRect ? balkRect.left - scoreRect.right : null
      };
    });
    const maanGebied = [document.getElementById("moonlab"), document.getElementById("nights")].filter(Boolean);
    const maanTekst = maanGebied.map(el => el.textContent || "").join(" ");
    const maanSvgs = maanGebied.reduce((n, el) => n + el.querySelectorAll(".maan-fase-svg").length, 0);
    const faseSvg = document.querySelector(".maan-fase-svg");
    const faseSchaduw = faseSvg ? faseSvg.querySelector(".maan-schaduw") : null;
    const faseSchaduwStyle = faseSchaduw ? getComputedStyle(faseSchaduw) : null;
    const dagTeksten = [...document.querySelectorAll("#days .row.day:not(.kop) .dcond")].map(el => (el.textContent || "").trim());
    const merk = document.querySelector(".mast h1");
    const windKop = document.querySelector("#days .row.kop .dwind");
    const thema = document.getElementById("thema");
    const zoek = document.getElementById("q");
    const locatie = document.getElementById("here");
    const footer = document.querySelector("footer");
    const topbar = document.querySelector(".topbar");
    const nav = document.querySelector(".nav");
    const app = document.getElementById("app");
    const pop = document.getElementById("pop");
    const prec = document.getElementById("prec");
    const trendStat = prec ? prec.closest(".stat") : null;
    const popStat = pop ? pop.closest(".stat") : null;
    const nachtAdvies = document.querySelectorAll("#nights .nachtadvies").length;
    const nachtMaan = document.querySelectorAll("#nights .nachtmaan").length;
    const maanRect = faseSvg ? faseSvg.getBoundingClientRect() : null;
    return {
      nuTeksten,
      bots,
      sunTekst: sun ? sun.textContent.replace(/\s+/g," ").trim() : "",
      sunRijen,
      sunOverflow: sun ? sun.scrollWidth - sun.clientWidth : 0,
      hint: (document.getElementById("charthint") || {}).textContent || "",
      briefing: (document.getElementById("briefing") || {}).textContent || "",
      uvKop: uv ? uv.parentElement.querySelector(".eyebrow").textContent.trim() : "",
      uvWaarde: uv ? uv.textContent.trim() : "",
      uvSub: (document.getElementById("uvsub") || {}).textContent || "",
      drukSub: (document.getElementById("pressub") || {}).textContent || "",
      trendKop: trendStat ? trendStat.querySelector(".eyebrow").textContent.trim() : "",
      trend: prec ? prec.textContent.trim() : "",
      trendSub: (document.getElementById("precsub") || {}).textContent || "",
      neerslagSectieVerborgen: getComputedStyle(document.getElementById("nchint").previousElementSibling).display === "none",
      nachtAdvies,
      nachtMaan,
      nachtRijen,
      maanSvgs,
      maanTekst,
      maanBreedte: maanRect ? maanRect.width : 0,
      maanSchaduw: !!faseSchaduw,
      maanSchaduwVulling: faseSchaduwStyle ? faseSchaduwStyle.fill : "none",
      maanSchaduwLijn: faseSchaduwStyle ? faseSchaduwStyle.stroke : "none",
      maanSchaduwStraal: faseSchaduw ? faseSchaduw.getAttribute("r") : "0",
      dagTeksten,
      merk: merk ? merk.textContent.trim() : "",
      windKopVisueel: windKop ? windKop.textContent.trim() : "",
      zoekHoogte: zoek ? zoek.getBoundingClientRect().height : 0,
      knopHoogte: locatie ? locatie.getBoundingClientRect().height : 0,
      locatieTekst: locatie ? locatie.textContent.trim() : "",
      locatieNaam: locatie ? locatie.getAttribute("aria-label") || "" : "",
      bewaarHoogte: document.getElementById("fav") ? document.getElementById("fav").getBoundingClientRect().height : 0,
      popSubDisplay: (document.getElementById("popsub") || {}).style.display || "",
      footerGrootte: footer ? parseFloat(getComputedStyle(footer).fontSize) : 0,
      topbar,
      nav,
      app,
      popStat,
      thema
    };
  });

  assert.equal(resultaat.nuTeksten.length, 1, `${naam} ${modus}: exact één Nu-label in de grafiek`);
  assert.equal(resultaat.bots, 0, `${naam} ${modus}: temperatuurwaarden botsen niet`);
  assert.ok(/zon onder 21:30/i.test(resultaat.sunTekst), `${naam} ${modus}: exacte zonsondergang van morgen blijft zichtbaar`);
  assert.ok(!/Vandaag/i.test(resultaat.sunTekst), `${naam} ${modus}: geen verstreken vandaag-momenten na zonsondergang`);
  assert.ok(resultaat.sunOverflow <= 1, `${naam} ${modus}: zoninformatie heeft geen horizontale overflow`);
  assert.equal(resultaat.hint, "Selecteer een punt in de grafiek voor details.", `${naam} ${modus}: input-neutrale grafiekhint`);

  assert.ok(!/wind komt|draait naar/i.test(resultaat.briefing), `${naam} ${modus}: 1 Bft krijgt geen briefing over richtingsdraai`);
  assert.ok(!/het is nu\s+-?\d+/i.test(resultaat.briefing), `${naam} ${modus}: briefing herhaalt actuele temperatuur niet`);
  assert.equal(resultaat.uvKop, "UV-piek vandaag", `${naam} ${modus}: UV is expliciet dagpiek`);
  assert.equal(resultaat.uvWaarde, "6", `${naam} ${modus}: UV-piek is consumentgericht afgerond`);
  assert.equal(resultaat.uvSub, "Piek was rond 15:00 · hoog.", `${naam} ${modus}: verstreken UV-piek en zichtbaar oordeel volgen dezelfde afgeronde grens`);
  assert.equal(resultaat.drukSub, "Vrijwel stabiel.", `${naam} ${modus}: minieme luchtdrukverandering zonder schijnprecisie`);
  assert.equal(resultaat.trendKop, "Temperatuur komende 3 uur", `${naam} ${modus}: trendhorizon staat altijd in de tegelkop`);
  assert.match(resultaat.trend, /^-?\d+\s*→\s*-?\d+\s*°C$/, `${naam} ${modus}: temperatuurtrend toont uitsluitend huidige en toekomstige temperatuur`);
  assert.ok(["Het wordt de komende uren warmer.","Het wordt de komende uren koeler.","De temperatuur verandert de komende uren nauwelijks."].includes(resultaat.trendSub), `${naam} ${modus}: temperatuurtrend gebruikt één natuurlijke richtingstekst`);
  assert.ok(!/neerslag|wind|gevoel/i.test(resultaat.trend+" "+resultaat.trendSub), `${naam} ${modus}: temperatuurtrend bevat geen andere weerinformatie`);
  assert.equal(resultaat.neerslagSectieVerborgen, true, `${naam} ${modus}: volledig droge twee-uurssectie dupliceert de briefing niet`);

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
    if (modus === "mobiel") assert.ok(rij.scoreBalkRuimte >= 8, `${naam} ${modus}: ${rij.score} houdt minimaal 8px lucht vóór de scorebalk`);
  }
  assert.ok(resultaat.maanSvgs >= resultaat.nachtMaan + 1, `${naam} ${modus}: maanfase gebruikt monochrome inline-SVG in kop en nachtrijen`);
  assert.ok(!/[🌑🌒🌓🌔🌕🌖🌗🌘]/u.test(resultaat.maanTekst), `${naam} ${modus}: geen platformkleurige maanemoji blijft zichtbaar`);
  assert.ok(resultaat.maanBreedte >= 13, `${naam} ${modus}: maanfase blijft op klein scherm herkenbaar`);
  assert.equal(resultaat.maanSchaduw, true, `${naam} ${modus}: maanfase heeft een fysieke ronde basisschijf`);
  assert.notEqual(resultaat.maanSchaduwVulling, "none", `${naam} ${modus}: onverlichte maanschijf heeft een zichtbare themavulling`);
  assert.notEqual(resultaat.maanSchaduwVulling, "rgba(0, 0, 0, 0)", `${naam} ${modus}: maanfase leest niet als los haakje`);
  assert.notEqual(resultaat.maanSchaduwLijn, "none", `${naam} ${modus}: schijfrand blijft in ieder thema herkenbaar`);
  assert.ok(parseFloat(resultaat.maanSchaduwStraal) >= 8, `${naam} ${modus}: fysieke maanschijf blijft groot genoeg`);

  // De fixture heeft voor vandaag een niet-neerslagbeeld uit de resterende uurdata,
  // maar voor toekomstige dagen bewust een officiële dagelijkse regencode (61) en
  // 40% neerslagkans. Code 61 is 'Lichte regen'; de centrale kanspolicy hoort dat
  // bij 40% concreet als 'Lichte regen mogelijk' te formuleren.
  assert.ok(resultaat.dagTeksten.length >= 2, `${naam} ${modus}: weektabel bevat meerdere dagen`);
  assert.ok(!/neerslagkans/i.test(resultaat.dagTeksten[0]), `${naam} ${modus}: niet-neerslagbeeld dupliceert de aparte neerslagkolom niet`);
  assert.ok(resultaat.dagTeksten.slice(1).some(t => /^Lichte regen mogelijk(?:\b|$)/i.test(t)), `${naam} ${modus}: officiële lichte-regendag met 40% krijgt de centrale formulering 'Lichte regen mogelijk'`);

  if (modus === "mobiel") {
    assert.equal(resultaat.windKopVisueel, "Wind", `${naam} ${modus}: mobiele weekkop heeft geen dubbelzinnig extra 'max'`);
    assert.ok(resultaat.zoekHoogte >= 43.5, `${naam} ${modus}: zoekveld heeft geen comfortabel mobiel aanraakvlak`);
    assert.ok(resultaat.knopHoogte >= 43.5, `${naam} ${modus}: locatiebediening heeft geen comfortabel mobiel aanraakvlak`);
    assert.equal(resultaat.locatieTekst.toLocaleLowerCase("nl-NL"),"mijn locatie",`${naam} ${modus}: volledig locatielabel hoort op 390px zichtbaar te blijven`);
    assert.equal(resultaat.locatieNaam,"Mijn locatie",`${naam} ${modus}: locatieknop mist een stabiele toegankelijke naam`);
    assert.ok(resultaat.bewaarHoogte>=35.5,`${naam} ${modus}: plaats bewaren heeft geen bruikbaar mobiel aanraakvlak`);
    assert.equal(resultaat.popSubDisplay, "none", `${naam} ${modus}: derde neerslagzin wordt niet dubbel getoond`);
    assert.ok(resultaat.footerGrootte >= 10.5 && resultaat.footerGrootte <= 11.5, `${naam} ${modus}: bronfooter is compact maar leesbaar`);

    // Echte animatie-engine: de mobiele fixed balk verdwijnt tijdens neerwaarts
    // lezen volledig uit beeld en komt bij omhoog scrollen terug, terwijl de hero
    // nog steeds voorbij is. Dit voorkomt het afsnijden van sectiekoppen/content.
    await page.evaluate(() => {
      const hero = document.querySelector(".hero");
      const doel = Math.max(0, window.scrollY + hero.getBoundingClientRect().bottom + 400);
      window.scrollTo(0, doel);
      window.dispatchEvent(new Event("scroll"));
    });
    await page.waitForTimeout(360);
    const scrollOnder = await page.evaluate(() => {
      const top = document.querySelector(".topbar").getBoundingClientRect();
      return { bottom: top.bottom, hoogte: top.height, y: scrollY, appTop: document.getElementById("app").getBoundingClientRect().top };
    });
    assert.ok(scrollOnder.hoogte > 30, `${naam} ${modus}: mobiele topbar bestaat nog`);
    assert.ok(scrollOnder.bottom <= 2, `${naam} ${modus}: topbar verdwijnt volledig bij neerwaarts lezen`);
    assert.ok(scrollOnder.y > 300, `${naam} ${modus}: test staat echt diep genoeg in de pagina`);

    await page.evaluate(() => {
      window.scrollBy(0, -120);
      window.dispatchEvent(new Event("scroll"));
    });
    await page.waitForTimeout(360);
    const scrollTerug = await page.evaluate(() => {
      const top = document.querySelector(".topbar").getBoundingClientRect();
      return { top: top.top, bottom: top.bottom, hoogte: top.height };
    });
    assert.ok(scrollTerug.top >= -1, `${naam} ${modus}: topbar keert terug bij omhoog scrollen`);
    assert.ok(scrollTerug.bottom > 30, `${naam} ${modus}: teruggekeerde topbar is zichtbaar`);
  }

  assert.deepEqual(fouten, [], `${naam} ${modus}: geen page/console errors`);
}

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    for (const [type, naam] of [[chromium, "Chromium"], [webkit, "WebKit"]]) {
      const browser = await type.launch({headless:true});
      try {
        await controleer(await browser.newPage({ viewport: { width: 390, height: 844 } }), naam, "mobiel");
        await controleer(await browser.newPage({ viewport: { width: 1280, height: 900 } }), naam, "desktop");
      } finally {
        await browser.close();
      }
    }
    console.log("Browser consumer polish: Chromium en WebKit mobiel/desktop geslaagd.");
  } finally {
    server.close();
  }
})().catch(err => {
  console.error(err && err.stack || err);
  server.close();
  process.exit(1);
});