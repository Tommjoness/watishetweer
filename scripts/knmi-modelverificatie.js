"use strict";

/* Modelverificatie tegen KNMI-stations.
   Vergelijkt per heel uur wat het model voorspelde (Open-Meteo Historical
   Forecast API, zonder models-parameter: dezelfde best_match als de site, boven
   Nederland KNMI Harmonie) met wat de automatische KNMI-weerstations maten
   (EDR API, collectie 10-minute-in-situ-meteorological-observations).
   Het model wordt bevraagd op de coördinaten van ieder station, zodat de
   vergelijking eerlijk is: zelfde plek, zelfde uur.

   Uitkomst per station en per groep: gemiddelde afwijking (model min
   meting), gemiddelde absolute afwijking en het 95e percentiel, voor
   temperatuur, relatieve luchtvochtigheid en dauwpunt. Alleen
   geaggregeerde weerdata; geen bezoekersgegevens.
   - Dag en nacht apart, op basis van is_day van het model voor dat uur en
     die plek (zon op of onder), niet op vaste klokuren.
   - Land en zee apart. Er is geen betrouwbaar veld voor, en stationsnamen
     vastleggen is plaatsgebonden; daarom natuurkundig: een station waarvan de
     gemeten temperatuur per dag mediaan minder dan ZEE_DAGGANG graden
     schommelt, heeft zeeklimaat (platforms, lichteilanden). De indeling staat
     in de samenvatting, zodat ze te controleren is.

   Omgeving:
   - KNMI_EDR_API_KEY (verplicht): als GitHub Actions-secret, nooit in code.
   - DAGEN (standaard 14): hoeveel volledige dagen terug.
   - UITVOER (optioneel): pad voor het JSON-resultaat.
   - GITHUB_STEP_SUMMARY (in GitHub Actions): de tabel komt in de samenvatting.
   - SAMENVATTING (optioneel): pad voor dezelfde tabel als Markdown-bestand,
     voor de reactie in het resultatenissue. */

const fs = require("fs");
const path = require("path");
const { dauwpuntUit } = require("./final-consumer-polish-20260831-runtime.js");

const EDR_BASIS = "https://api.dataplatform.knmi.nl/edr/v1/collections/10-minute-in-situ-meteorological-observations";
const MODEL_BASIS = "https://historical-forecast-api.open-meteo.com/v1/forecast";
/* Europees Nederland; de BES-eilanden hebben een ander klimaat en tijdvak. */
const NL = { latMin: 50.6, latMax: 53.8, lonMin: 3.0, lonMax: 7.4 };
const STATIONS_PER_VERZOEK = 10;
const DAGEN_PER_VERZOEK = 7;
const ZEE_DAGGANG = 3.3; /* °C: mediane dagelijkse temperatuurgang van een zeestation. Gemeten september 2026: zeeplatforms 2,0-3,0 °C (AWG-1 bij Ameland het hoogst), landstations vanaf 3,6 °C (Vlieland). Een benadering: rond de grens verschuift hooguit één platform, met nauwelijks invloed op de groepscijfers. */

const wacht = ms => new Promise(r => setTimeout(r, ms));
const getal = v => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v))) ? null : Number(v);
const rond = (v, d = 1) => v === null ? null : Math.round(v * 10 ** d) / 10 ** d;

async function haalJson(url, { headers = {}, pogingen = 4, timeoutMs = 30000 } = {}) {
  let laatste = null;
  for (let poging = 1; poging <= pogingen; poging++) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: ctrl.signal });
      if (r.status === 429 || r.status >= 500) { laatste = new Error("status " + r.status); await wacht(2000 * 2 ** poging); continue; }
      if (!r.ok) {
        const tekst = (await r.text().catch(() => "")).slice(0, 300);
        const e = new Error("status " + r.status + (tekst ? ": " + tekst : "")); e.status = r.status; throw e;
      }
      return await r.json();
    } catch (e) {
      if (e.status && e.status < 500 && e.status !== 429) throw e;
      laatste = e; await wacht(2000 * 2 ** poging);
    } finally { clearTimeout(t); }
  }
  throw laatste || new Error("onbekende fout");
}

/* Stationslijst uit de EDR-locations (GeoJSON FeatureCollection). */
function stationsUitLocaties(json) {
  const features = Array.isArray(json && json.features) ? json.features : [];
  return features.map(f => {
    const c = f && f.geometry && Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates : [];
    const p = (f && f.properties) || {};
    return { id: String(f.id ?? p.id ?? ""), naam: String(p.name ?? p.naam ?? p.label ?? f.id ?? ""), lon: getal(c[0]), lat: getal(c[1]) };
  }).filter(s => s.id && s.lat !== null && s.lon !== null
    && s.lat >= NL.latMin && s.lat <= NL.latMax && s.lon >= NL.lonMin && s.lon <= NL.lonMax);
}

/* Metingen uit een CoverageJSON-antwoord: één Coverage of een CoverageCollection.
   Iedere coverage wordt aan het dichtstbijzijnde station gekoppeld via haar
   x/y, omdat niet iedere EDR-server de locatie-id in de coverage herhaalt.
   Alleen hele uren; de 10-minutenwaarde om hh:00 is de meting van dat uur. */
function metingenUitCoverage(json, stations) {
  const coverages = json && json.type === "CoverageCollection" ? (json.coverages || []) : (json && json.type === "Coverage" ? [json] : []);
  const uit = new Map();
  for (const cov of coverages) {
    const axes = (cov.domain && cov.domain.axes) || {};
    const x = getal(axes.x && axes.x.values && axes.x.values[0]), y = getal(axes.y && axes.y.values && axes.y.values[0]);
    let station = null, d = Infinity;
    for (const s of stations) {
      const dd = (x === null || y === null) ? Infinity : (s.lon - x) ** 2 + (s.lat - y) ** 2;
      if (dd < d) { d = dd; station = s; }
    }
    if (!station || d > 0.0004) continue; /* verder dan ~2 km: geen zekere koppeling */
    const tijden = (axes.t && axes.t.values) || [];
    const reeks = n => ((cov.ranges || {})[n] || {}).values || [];
    const ta = reeks("ta"), rh = reeks("rh");
    const perUur = uit.get(station.id) || new Map();
    tijden.forEach((t, k) => {
      const ms = Date.parse(t);
      if (!Number.isFinite(ms) || ms % 3600000 !== 0) return;
      const temp = getal(ta[k]), vocht = getal(rh[k]);
      if (temp === null && vocht === null) return;
      perUur.set(new Date(ms).toISOString().slice(0, 13), { ta: temp, rh: vocht });
    });
    uit.set(station.id, perUur);
  }
  return uit;
}

/* Modelwaarden uit Open-Meteo (één object of een array bij meerdere plekken). */
function modelUitOpenMeteo(json, stations) {
  const lijst = Array.isArray(json) ? json : [json];
  const uit = new Map();
  lijst.forEach((m, k) => {
    const s = stations[k], h = (m && m.hourly) || {};
    if (!s || !Array.isArray(h.time)) return;
    const perUur = new Map();
    h.time.forEach((t, i) => perUur.set(String(t).slice(0, 13), {
      ta: getal((h.temperature_2m || [])[i]), rh: getal((h.relative_humidity_2m || [])[i]), td: getal((h.dew_point_2m || [])[i]), dag: getal((h.is_day || [])[i])
    }));
    uit.set(s.id, perUur);
  });
  return uit;
}

function statistiek(verschillen) {
  const v = verschillen.filter(x => Number.isFinite(x));
  if (!v.length) return { n: 0, bias: null, mae: null, p95: null };
  const abs = v.map(Math.abs).sort((a, b) => a - b);
  return {
    n: v.length,
    bias: v.reduce((a, b) => a + b, 0) / v.length,
    mae: abs.reduce((a, b) => a + b, 0) / abs.length,
    p95: abs[Math.min(abs.length - 1, Math.floor(0.95 * abs.length))]
  };
}

/* Paren per uur: model min meting. Het dauwpunt van de meting volgt uit
   temperatuur en luchtvochtigheid met dezelfde formule als de site (Magnus). */
function vergelijk(model, meting, past = () => true) {
  const dT = [], dRH = [], dTd = [];
  for (const [uur, g] of meting) {
    const m = model.get(uur);
    if (!m || !past(m)) continue;
    if (m.ta !== null && g.ta !== null) dT.push(m.ta - g.ta);
    if (m.rh !== null && g.rh !== null) dRH.push(m.rh - g.rh);
    const tdMeting = (g.ta !== null && g.rh !== null) ? dauwpuntUit(g.ta, g.rh) : null;
    const tdModel = m.td !== null ? m.td : ((m.ta !== null && m.rh !== null) ? dauwpuntUit(m.ta, m.rh) : null);
    if (tdMeting !== null && tdModel !== null) dTd.push(tdModel - tdMeting);
  }
  return { temperatuur: statistiek(dT), vochtigheid: statistiek(dRH), dauwpunt: statistiek(dTd) };
}

const overdag = m => m.dag === 1, snachts = m => m.dag === 0;

/* Mediane dagelijkse temperatuurgang (max min min per UTC-dag) van de
   meting; alleen dagen met minstens 20 uurwaarden tellen mee. */
function daggang(meting) {
  const perDag = new Map();
  for (const [uur, g] of meting) {
    if (g.ta === null) continue;
    const dag = uur.slice(0, 10), l = perDag.get(dag) || [];
    l.push(g.ta); perDag.set(dag, l);
  }
  const gangen = [...perDag.values()].filter(l => l.length >= 20).map(l => Math.max(...l) - Math.min(...l)).sort((a, b) => a - b);
  if (!gangen.length) return null;
  const m = Math.floor(gangen.length / 2);
  return gangen.length % 2 ? gangen[m] : (gangen[m - 1] + gangen[m]) / 2;
}
function soort(meting) { const g = daggang(meting); return g !== null && g < ZEE_DAGGANG ? "zee" : "land"; }

/* Model en meting van een groep stations samenvoegen tot één reeks. */
function samen(stations, model, metingen) {
  const m = new Map(), g = new Map();
  stations.forEach(s => {
    (model.get(s.id) || new Map()).forEach((v, k) => m.set(s.id + "|" + k, v));
    (metingen.get(s.id) || new Map()).forEach((v, k) => g.set(s.id + "|" + k, v));
  });
  return [m, g];
}

function stationsgroepen(stationsMetSoort, model, metingen) {
  const land = stationsMetSoort.filter(s => s.soort === "land"), zee = stationsMetSoort.filter(s => s.soort === "zee");
  const [ma, ga] = samen(stationsMetSoort, model, metingen), [ml, gl] = samen(land, model, metingen), [mz, gz] = samen(zee, model, metingen);
  return [
    { naam: "Alle stations", stations: stationsMetSoort.length, ...vergelijk(ma, ga) },
    { naam: "Land", stations: land.length, ...vergelijk(ml, gl) },
    { naam: "Land, overdag", stations: land.length, ...vergelijk(ml, gl, overdag) },
    { naam: "Land, 's nachts", stations: land.length, ...vergelijk(ml, gl, snachts) },
    { naam: "Zee", stations: zee.length, ...vergelijk(mz, gz) }
  ];
}

function periode(dagen, nu = Date.now()) {
  const einde = new Date(Math.floor(nu / 86400000) * 86400000); /* vandaag 00:00 UTC, exclusief */
  const start = new Date(einde.getTime() - dagen * 86400000);
  return { start, einde };
}

function blokken(start, einde) {
  const uit = [];
  for (let a = start.getTime(); a < einde.getTime(); a += DAGEN_PER_VERZOEK * 86400000) {
    uit.push([new Date(a), new Date(Math.min(einde.getTime(), a + DAGEN_PER_VERZOEK * 86400000))]);
  }
  return uit;
}

function inDelen(lijst, n) { const uit = []; for (let i = 0; i < lijst.length; i += n) uit.push(lijst.slice(i, i + n)); return uit; }

function fmt(v, eenheid) { return v === null ? "–" : (v > 0 ? "+" : "") + String(rond(v)).replace(".", ",") + eenheid; }
function fmtAbs(v, eenheid) { return v === null ? "–" : String(rond(v)).replace(".", ",") + eenheid; }

function markdown(resultaat) {
  const { periode: p, groepen: gr, stations } = resultaat;
  const r = [];
  r.push("## Modelverificatie tegen KNMI-stations");
  r.push("");
  r.push(`Periode ${p.start.slice(0, 10)} t/m ${p.eindeInclusief} (UTC), ${stations.length} stations, ieder heel uur. Afwijking = model min meting; "abs." = gemiddelde absolute afwijking; "95%" = 95% van de uren valt binnen dit verschil.`);
  r.push("");
  r.push("| Groep | Stations | Uren | Temp. afwijking | Temp. abs. | Temp. 95% | Vocht afwijking | Vocht abs. | Vocht 95% | Dauwpunt afwijking | Dauwpunt abs. |");
  r.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const g of gr) {
    const t = g.temperatuur, v = g.vochtigheid, d = g.dauwpunt;
    r.push(`| ${g.naam} | ${g.stations} | ${t.n} | ${fmt(t.bias, " °C")} | ${fmtAbs(t.mae, " °C")} | ${fmtAbs(t.p95, " °C")} | ${fmt(v.bias, " %")} | ${fmtAbs(v.mae, " %")} | ${fmtAbs(v.p95, " %")} | ${fmt(d.bias, " °C")} | ${fmtAbs(d.mae, " °C")} |`);
  }
  r.push("");
  r.push(`Dag en nacht volgen uit is_day van het model (zon op of onder). Zee = gemeten temperatuur schommelt per dag mediaan minder dan ${String(ZEE_DAGGANG).replace(".", ",")} °C.`);
  r.push("");
  r.push("Per station (gesorteerd op gemiddelde absolute temperatuurafwijking):");
  r.push("");
  r.push("| Station | Soort | Daggang | Uren | Temp. overdag | Temp. 's nachts | Temp. abs. | Vocht overdag | Vocht 's nachts | Dauwpunt afwijking |");
  r.push("|---|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const s of stations) {
    r.push(`| ${s.naam} | ${s.soort} | ${fmtAbs(s.daggang, " °C")} | ${s.temperatuur.n} | ${fmt(s.overdag.temperatuur.bias, " °C")} | ${fmt(s.snachts.temperatuur.bias, " °C")} | ${fmtAbs(s.temperatuur.mae, " °C")} | ${fmt(s.overdag.vochtigheid.bias, " %")} | ${fmt(s.snachts.vochtigheid.bias, " %")} | ${fmt(s.dauwpunt.bias, " °C")} |`);
  }
  r.push("");
  r.push("Bronnen: model via Open-Meteo Historical Forecast API (best_match); metingen KNMI, CC BY 4.0.");
  return r.join("\n");
}

async function main() {
  const sleutel = process.env.KNMI_EDR_API_KEY;
  if (!sleutel) throw new Error("KNMI_EDR_API_KEY ontbreekt: zet de sleutel als GitHub Actions-secret.");
  const dagen = Math.max(1, Math.min(60, Number(process.env.DAGEN) || 14));
  const { start, einde } = periode(dagen);
  const auth = { Authorization: sleutel };

  const stations = stationsUitLocaties(await haalJson(EDR_BASIS + "/locations", { headers: auth }));
  if (!stations.length) throw new Error("De EDR API gaf geen stations in Nederland terug.");
  console.log(`${stations.length} KNMI-stations in Nederland; periode ${start.toISOString().slice(0, 10)} tot ${einde.toISOString().slice(0, 10)} (UTC).`);

  const metingen = new Map(), model = new Map();
  for (const groep of inDelen(stations, STATIONS_PER_VERZOEK)) {
    for (const [a, b] of blokken(start, einde)) {
      const url = `${EDR_BASIS}/locations/${groep.map(s => encodeURIComponent(s.id)).join(",")}?datetime=${a.toISOString().slice(0, 19)}Z/${new Date(b.getTime() - 60000).toISOString().slice(0, 19)}Z&parameter-name=ta,rh`;
      try {
        const deel = metingenUitCoverage(await haalJson(url, { headers: auth }), groep);
        for (const [id, uren] of deel) { const alles = metingen.get(id) || new Map(); uren.forEach((v, k) => alles.set(k, v)); metingen.set(id, alles); }
      } catch (e) {
        console.warn(`KNMI ${groep.map(s => s.naam).join(", ")} ${a.toISOString().slice(0, 10)}: ${e.message}`);
      }
    }
    const modelUrl = `${MODEL_BASIS}?latitude=${groep.map(s => s.lat.toFixed(4)).join(",")}&longitude=${groep.map(s => s.lon.toFixed(4)).join(",")}`
      + `&start_date=${start.toISOString().slice(0, 10)}&end_date=${new Date(einde.getTime() - 86400000).toISOString().slice(0, 10)}`
      + "&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,is_day&timezone=UTC";
    modelUitOpenMeteo(await haalJson(modelUrl), groep).forEach((v, k) => model.set(k, v));
  }

  const perStation = stations.map(s => {
    const m = model.get(s.id) || new Map(), g = metingen.get(s.id) || new Map();
    return { id: s.id, naam: s.naam, lat: s.lat, lon: s.lon, soort: soort(g), daggang: daggang(g), ...vergelijk(m, g), overdag: vergelijk(m, g, overdag), snachts: vergelijk(m, g, snachts) };
  })
    .filter(s => s.temperatuur.n + s.vochtigheid.n > 0)
    .sort((a, b) => (a.temperatuur.mae ?? 99) - (b.temperatuur.mae ?? 99));
  if (!perStation.length) throw new Error("Geen enkel uur kon worden vergeleken: controleer de sleutel en de beschikbaarheid van de KNMI-dataset.");

  const resultaat = {
    periode: { start: start.toISOString(), einde: einde.toISOString(), eindeInclusief: new Date(einde.getTime() - 86400000).toISOString().slice(0, 10) },
    zeeDaggang: ZEE_DAGGANG,
    groepen: stationsgroepen(perStation, model, metingen),
    stations: perStation
  };
  const md = markdown(resultaat);
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
  if (process.env.SAMENVATTING) { fs.mkdirSync(path.dirname(process.env.SAMENVATTING), { recursive: true }); fs.writeFileSync(process.env.SAMENVATTING, md + "\n"); }
  if (process.env.UITVOER) { fs.mkdirSync(path.dirname(process.env.UITVOER), { recursive: true }); fs.writeFileSync(process.env.UITVOER, JSON.stringify(resultaat, null, 2)); }
  return resultaat;
}

module.exports = { stationsUitLocaties, metingenUitCoverage, modelUitOpenMeteo, statistiek, vergelijk, daggang, soort, stationsgroepen, periode, blokken, markdown, ZEE_DAGGANG };
if (require.main === module) main().catch(e => { console.error("Modelverificatie mislukt: " + e.message); process.exit(1); });
