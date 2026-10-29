import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import worker, { _intern } from "../api/forecast.mjs";
import { normaliseerVisualCrossing, geldigeVisualCrossingForecast, _intern as adapter } from "../lib/visualcrossing-forecast.mjs";
import { gfsPoolnacht, blendPoolnacht48, zuidpoolLeeg, zuidpoolGfsSynthetisch, normaleBlend, kopie } from "./poolnacht-fixtures.mjs";

/* Poolnacht, pooldag en de Zuidpool in de reserveroute (Visual Crossing).

   Achtergrond (29 oktober 2026): voor Longyearbyen gaf de standaardaanvraag (blend) 8 dagen maar slechts 48
   uurrecords, zonder zonsopkomst/-ondergang en met "-day"-iconen midden in de poolnacht. De route wijst dat terecht
   af (zevendaagse dekking). Een tweede aanvraag met forecastDataset=gfs_2 levert wel 7x24 uur, maar eveneens zonder
   zonvelden en met iconen met "-day" of zonder achtervoegsel: is_day moet dan uit de zonshoogte komen.
   De fixtures zijn synthetisch (zie poolnacht-fixtures.mjs); de echte respons wordt alleen lokaal getest. */

const engine = createRequire(import.meta.url)("../senior-correctness-v2.js");
const { zonshoogteGraden } = adapter;
const uur = o => o.hourly.time.length;

/* 1. Zonshoogte: natuurkundige controle, onafhankelijk van een provider. */
{
  const dagMax = (ms0, breedte, lengte) => Math.max(...Array.from({ length: 144 }, (_, i) => zonshoogteGraden(ms0 + i * 600000, breedte, lengte)));
  const dagMin = (ms0, breedte, lengte) => Math.min(...Array.from({ length: 144 }, (_, i) => zonshoogteGraden(ms0 + i * 600000, breedte, lengte)));
  const declinatie = dag => -23.44 * Math.cos(2 * Math.PI * (dag + 10) / 365) ; // eenvoudige benadering, ± 1°
  const dagVanJaar = (j, m, d) => Math.round((Date.UTC(j, m - 1, d) - Date.UTC(j, 0, 0)) / 86400000);
  const ver = (waarde, verwacht, marge, tekst) => assert.ok(Math.abs(waarde - verwacht) <= marge, `${tekst}: ${waarde.toFixed(2)} wijkt af van ${verwacht.toFixed(2)}`);
  /* hoogste zonshoogte van de dag = 90 - |breedte - declinatie| */
  ver(dagMax(Date.UTC(2026, 10, 4), 78.2232, 15.6469), 90 - Math.abs(78.2232 - declinatie(dagVanJaar(2026, 11, 4))), 1.2, "Longyearbyen 4 nov: hoogste zonshoogte");
  assert.ok(dagMax(Date.UTC(2026, 10, 4), 78.2232, 15.6469) < -0.833, "Longyearbyen 4 nov: de zon komt niet boven de horizon (poolnacht)");
  ver(dagMax(Date.UTC(2026, 5, 21), 52.37, 4.9), 90 - 52.37 + 23.44, 0.7, "Amsterdam 21 jun: hoogste zonshoogte");
  assert.ok(dagMin(Date.UTC(2026, 5, 21), 78.2232, 15.6469) > -0.833, "Longyearbyen 21 jun: de zon zakt niet onder de horizon (pooldag)");
  /* Zuidpool in oktober: zon boven de horizon gedurende het hele etmaal, hoogte gelijk aan -declinatie */
  const pool = [dagMin(Date.UTC(2026, 9, 29), -90, 0), dagMax(Date.UTC(2026, 9, 29), -90, 0)];
  assert.ok(pool[0] > 10 && pool[1] < 17, `Zuidpool 29 okt: zonshoogte ${pool.map(x => x.toFixed(1))} hoort rond 13 graden te liggen`);
  assert.ok(dagMax(Date.UTC(2026, 5, 21), -90, 0) < -0.833, "Zuidpool 21 jun: poolnacht");
  /* fail-closed: zonder breedte of moment geen uitspraak */
  assert.ok(!Number.isFinite(zonshoogteGraden(Number.NaN, 78, 15)) || zonshoogteGraden(Number.NaN, 78, 15) === null);
}

/* 2. Adapter: Longyearbyen (GFS-vorm). */
{
  const gfs = gfsPoolnacht();
  const heeftDagIcoon = gfs.days.slice(0, 7).flatMap(d => d.hours).filter(h => /-day$/.test(h.icon)).length;
  const zonder = gfs.days.slice(0, 7).flatMap(d => d.hours).filter(h => !/-(day|night)$/.test(h.icon)).length;
  assert.ok(heeftDagIcoon > 0 && zonder > 0 && heeftDagIcoon + zonder === 168, "fixture bevat beide iconenpatronen en geen '-night'");
  const uit = normaliseerVisualCrossing(gfs);
  assert.equal(geldigeVisualCrossingForecast(uit), true, "GFS-vorm voldoet aan de volledige validatie");
  assert.equal(uur(uit), 168); assert.equal(uit.daily.time.length, 7);
  assert.deepEqual([...new Set(uit.hourly.is_day)], [0], "poolnacht: is_day is voor alle 168 uren 0");
  assert.equal(uit.current.is_day, 0);
  assert.equal(uit.hourly.precipitation_probability.filter(v => v === null).length, 159, "ontbrekende neerslagkans blijft null");
  assert.equal(uit.hourly.precipitation_probability.filter(v => v === 0).length, 9, "alleen de door de provider gegeven nullen blijven 0");
  assert.equal(engine.zonDaglichtInfo(null, null, uit.hourly.is_day.slice(0, 24)).status, "poolnacht", "de site toont poolnacht");
  /* zonder currentConditions blijft het fail-closed */
  assert.throws(() => normaliseerVisualCrossing(gfsPoolnacht({ metCurrent: false })), /onvolledige weerdata/);
  /* 48 uren van de standaardaanvraag blijven afgewezen */
  assert.throws(() => normaliseerVisualCrossing(blendPoolnacht48()), /onvolledige weerdata/);
  /* de Zuidpool met alleen null blijft afgewezen; met een (synthetische) geldige respons is het pooldag */
  assert.throws(() => normaliseerVisualCrossing(zuidpoolLeeg()), /onvolledige weerdata/);
  const zp = normaliseerVisualCrossing(zuidpoolGfsSynthetisch());
  assert.deepEqual([...new Set(zp.hourly.is_day)], [1], "Zuidpool in oktober: pooldag");
}

/* 3. Adapter: gewone locatie ongewijzigd (zonepochs en iconen met achtervoegsel blijven leidend). */
{
  const uit = normaliseerVisualCrossing(normaleBlend(7));
  assert.equal(geldigeVisualCrossingForecast(uit), true);
  assert.deepEqual(uit.hourly.is_day.slice(0, 24), Array.from({ length: 24 }, (_, h) => (h >= 7 && h < 17 ? 1 : 0)), "Amsterdam: dag van 07 tot 17 uur volgens de iconen, zoals voorheen");
  /* zonepochs aanwezig en iconen zonder achtervoegsel: de zonepochs beslissen, niet de zonshoogte */
  const p = normaleBlend(7); p.days.forEach(d => d.hours.forEach(h => { h.icon = "cloudy"; }));
  const u2 = normaliseerVisualCrossing(p);
  assert.deepEqual(u2.hourly.is_day.slice(0, 24), Array.from({ length: 24 }, (_, h) => (h >= 8 && h <= 17 ? 1 : 0)), "Amsterdam: zon op 07:15 en onder 17:30 bepalen het uur (uurbegin binnen opkomst-ondergang)");
}

/* 4. Route. */
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const trage = (ms, signal) => new Promise((res, rej) => { const t = setTimeout(res, ms); if (signal) signal.addEventListener("abort", () => { clearTimeout(t); rej(Object.assign(new Error("aborted"), { name: "AbortError" })); }); });
const WA_OFF = { location: { name: "x", tz_id: "Arctic/Longyearbyen" }, current: {}, forecast: { forecastday: [] } };
async function run({ lat, lon, vc, wa = () => json(WA_OFF), env = { VISUAL_CROSSING_API_KEY: "vc-geheim", WEATHERAPI_KEY: "wa-geheim" } }) {
  const logs = [], urls = [], oW = console.warn, oF = globalThis.fetch; console.warn = o => logs.push(o);
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url), d = new URL(u);
    if (u.includes("visualcrossing.com")) { urls.push({ p: "vc", ds: d.searchParams.get("forecastDataset"), u }); return vc(d.searchParams.get("forecastDataset"), init); }
    if (u.includes("api.weatherapi.com")) { urls.push({ p: "wa", u }); return wa(u, init); }
    return new Response("{}", { status: 500 });
  };
  const t0 = Date.now();
  try {
    const r = await worker.fetch(new Request(`https://watishetweer.nl/api/forecast?lat=${lat}&lon=${lon}`), env, { requestId: "rid-1" });
    return { r, body: await r.clone().json().catch(() => null), logs, urls, ms: Date.now() - t0 };
  } finally { console.warn = oW; globalThis.fetch = oF; }
}
const aantal = (x, p) => x.urls.filter(u => u.p === p).length;
const LYB = { lat: 78.2232, lon: 15.6469 };
const watAnders = () => { throw new Error("WeatherAPI mag niet worden aangeroepen"); };

/* R1 gewone locatie: één aanvraag zonder forecastDataset, geen header, geen log */
{
  const x = await run({ lat: 52.3676, lon: 4.9041, vc: () => json(normaleBlend(8)), wa: watAnders });
  assert.equal(x.r.status, 200); assert.equal(x.body.provider, "visualcrossing");
  assert.deepEqual(x.urls.map(u => [u.p, u.ds]), [["vc", null]]);
  assert.ok(!new URL(x.urls[0].u).search.includes("forecastDataset"));
  assert.equal(x.r.headers.get("x-wiw-forecast-dataset"), null); assert.equal(x.logs.length, 0);
}
/* R2 Longyearbyen: standaard afgewezen, daarna gfs_2 */
{
  const x = await run({ ...LYB, vc: ds => json(ds === "gfs_2" ? gfsPoolnacht() : blendPoolnacht48()), wa: watAnders });
  assert.equal(x.r.status, 200); assert.equal(x.r.headers.get("x-wiw-forecast-dataset"), "gfs_2"); assert.equal(x.r.headers.get("x-wiw-weather-source"), "visualcrossing");
  assert.deepEqual(x.urls.map(u => u.ds), [null, "gfs_2"]);
  assert.deepEqual([...new Set(x.body.hourly.is_day)], [0]); assert.equal(x.body.hourly.time.length, 168);
  assert.deepEqual(x.logs.map(l => [l.provider, l.categorie, "dataset" in l]), [["visualcrossing", "dekking_afgewezen", false]]);
}
/* R2b GFS zonder currentConditions: fail-closed, WeatherAPI geprobeerd */
{
  const x = await run({ ...LYB, vc: ds => json(ds === "gfs_2" ? gfsPoolnacht({ metCurrent: false }) : blendPoolnacht48()) });
  assert.equal(x.r.status, 503); assert.equal(aantal(x, "wa"), 1);
  assert.deepEqual(x.logs.filter(l => l.provider === "visualcrossing").map(l => [l.categorie, l.dataset ?? null]), [["dekking_afgewezen", null], ["dekking_afgewezen", "gfs_2"]]);
}
/* R3 Zuidpool: standaard en GFS leeg -> 503; met synthetische geldige GFS -> 200 */
{
  const x = await run({ lat: -90, lon: 0, vc: () => json(zuidpoolLeeg()) });
  assert.equal(x.r.status, 503); assert.equal(aantal(x, "vc"), 2); assert.equal(aantal(x, "wa"), 1);
  const y = await run({ lat: -90, lon: 0, vc: ds => json(ds === "gfs_2" ? zuidpoolGfsSynthetisch() : zuidpoolLeeg()), wa: watAnders });
  assert.equal(y.r.status, 200); assert.deepEqual([...new Set(y.body.hourly.is_day)], [1]);
}
/* R4 geen GFS-poging bij andere fouten dan dekking_afgewezen */
{
  const fouten = {
    timeout: (ds, init) => trage(5000, init.signal), http500: () => new Response("{}", { status: 500 }), http429: () => new Response("{}", { status: 429 }),
    http401: () => new Response("{}", { status: 401 }), netwerk: () => { throw new TypeError("fetch failed"); },
    locatie: () => json(gfsPoolnacht({ breedte: 70 })), ongeldigeJson: () => new Response("geen json", { status: 200 })
  };
  for (const [naam, vc] of Object.entries(fouten)) {
    const x = await run({ ...LYB, vc, wa: () => new Response("{}", { status: 500 }) });
    assert.equal(aantal(x, "vc"), 1, `${naam}: onverwachte tweede Visual Crossing-aanvraag`);
  }
}
/* R5 de 25 km-controle geldt ook voor de GFS-respons; logs bevatten geen sleutels of coördinaten */
{
  const x = await run({ ...LYB, vc: ds => json(ds === "gfs_2" ? gfsPoolnacht({ breedte: 70 }) : blendPoolnacht48()) });
  assert.equal(x.r.status, 503);
  assert.deepEqual(x.logs.filter(l => l.provider === "visualcrossing").map(l => [l.categorie, l.dataset ?? null]), [["dekking_afgewezen", null], ["locatie_afwijking", "gfs_2"]]);
  const t = JSON.stringify(x.logs); for (const v of ["vc-geheim", "wa-geheim", "://", "78.2232", "15.6469", "key="]) assert.ok(!t.includes(v), v);
}
/* R6 GFS-poging zonder WeatherAPI-sleutel (alleen Visual Crossing geconfigureerd) */
{
  const x = await run({ ...LYB, env: { VISUAL_CROSSING_API_KEY: "vc-geheim" }, vc: ds => json(ds === "gfs_2" ? gfsPoolnacht() : blendPoolnacht48()) });
  assert.equal(x.r.status, 200); assert.equal(aantal(x, "wa"), 0);
}
/* R7 totaalbudget: ook als alles traag is blijft de route onder het bestaande maximum (1,6 + 2,5 + 0,4 s) en dus onder de 5 s van de browser */
{
  assert.equal(_intern.ROUTE_BUDGET_MS, 4500);
  assert.ok(_intern.ROUTE_BUDGET_MS < 5000, "routebudget blijft onder de 5 s die de browser op /api/forecast wacht");
  const x = await run({ ...LYB, vc: async (ds, init) => { if (ds === "gfs_2") await trage(10000, init.signal); await trage(1500, init.signal); return json(blendPoolnacht48()); }, wa: (u, init) => trage(10000, init.signal) });
  assert.equal(x.r.status, 503);
  assert.ok(x.ms <= _intern.ROUTE_BUDGET_MS + 250, `ongunstigste duur ${x.ms} ms is langer dan het routebudget`);
  assert.ok(x.ms < 5000, "de route antwoordt binnen het clientbudget van 5 s");
}
/* R8 het bestaande pad zonder GFS-poging (time-out van de standaardaanvraag) behoudt zijn volledige tijd voor WeatherAPI */
{
  const x = await run({ ...LYB, vc: (ds, init) => trage(10000, init.signal), wa: (u, init) => trage(10000, init.signal) });
  assert.equal(x.r.status, 503); assert.equal(aantal(x, "vc"), 1);
  assert.ok(x.ms >= 4000 && x.ms <= _intern.ROUTE_BUDGET_MS + 250, `duur ${x.ms} ms: 1,6 s Visual Crossing plus de volle 2,5 s WeatherAPI`);
  assert.equal(_intern.foutCategorie(new Error("Routebudget is op")), "budget_op");
}

/* 5. Alleen lokaal: de echte, niet in de repository opgenomen Visual Crossing-respons (WIW_ECHTE_VC_GFS=<pad>). */
const echt = process.env.WIW_ECHTE_VC_GFS;
if (echt && fs.existsSync(echt)) {
  const p = JSON.parse(fs.readFileSync(echt, "utf8"));
  const vorm = o => Object.keys(o).sort().join(",");
  assert.equal(vorm(gfsPoolnacht().days[0].hours[0]), vorm(p.days[0].hours[0]), "uurvelden van de fixture komen overeen met de echte respons");
  assert.equal(vorm(Object.fromEntries(Object.entries(gfsPoolnacht().days[0]).filter(([k]) => k !== "hours"))), vorm(Object.fromEntries(Object.entries(p.days[0]).filter(([k]) => k !== "hours"))), "dagvelden komen overeen");
  assert.deepEqual(Object.keys(p.currentConditions).filter(k => !(k in gfsPoolnacht().currentConditions)), [], "currentConditions: geen velden in de echte respons die de fixture mist");
  const uit = normaliseerVisualCrossing(p);
  assert.equal(geldigeVisualCrossingForecast(uit), true, "echte respons: volledige validatie");
  assert.equal(uur(uit), 168); assert.deepEqual([...new Set(uit.hourly.is_day)], [0]); assert.equal(uit.current.is_day, 0);
  const standaard = kopie(p); standaard.days = standaard.days.slice(0, 8); standaard.days.forEach((d, i) => { if (i >= 2) d.hours = []; });
  const x = await run({ lat: p.latitude, lon: p.longitude, vc: ds => json(ds === "gfs_2" ? p : standaard), wa: watAnders });
  assert.equal(x.r.status, 200); assert.equal(x.r.headers.get("x-wiw-forecast-dataset"), "gfs_2");
  console.log("Lokaal: echte GFS-respons (168 uren, poolnacht) door adapter en route: geldig, 200, is_day overal 0.");
}
console.log("Visual Crossing poolnacht: zonshoogte, GFS-vorm, 48-uursblend afgewezen, Zuidpool fail-closed, gewone locaties ongewijzigd, route met één GFS-poging en totaalbudget groen.");
