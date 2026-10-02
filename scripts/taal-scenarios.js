"use strict";

/*
 * Weersituaties voor de taalbewaker. Ieder scenario levert een volledige,
 * consistente nagebootste API-respons (data.js) plus de bijbehorende
 * lucht-, waarschuwing- en KNMI-antwoorden. Doel: zo veel mogelijk
 * verschillende teksten op het scherm krijgen, zodat een onvertaalde zin
 * altijd in minstens één scenario zichtbaar wordt.
 */

const { bouw } = require("../data.js");

const DAG0 = "2026-07-22";
function isoLokaal(uur, minuut = 0, dag = DAG0) {
  return `${dag}T${String(uur).padStart(2, "0")}:${String(minuut).padStart(2, "0")}`;
}
/* Europe/Amsterdam in juli: UTC+2. */
function nuMs(uur, minuut = 0) { return Date.UTC(2026, 6, 22, uur - 2, minuut); }

function metKwartier(d, uur, minuut, neerslag = () => 0, code = () => 0) {
  d.minutely_15 = { time: [], precipitation: [], rain: [], showers: [], snowfall: [], weather_code: [] };
  for (let i = -1; i <= 16; i++) {
    const ms = nuMs(uur, minuut - (minuut % 15)) + i * 15 * 60000;
    const t = new Date(ms + 2 * 3600000).toISOString().slice(0, 16);
    const p = neerslag(i);
    d.minutely_15.time.push(t);
    d.minutely_15.precipitation.push(p);
    d.minutely_15.rain.push(p);
    d.minutely_15.showers.push(0);
    d.minutely_15.snowfall.push(0);
    d.minutely_15.weather_code.push(code(i));
  }
  return d;
}

function afwerken(d, { uur = 14, minuut = 0, dag = true, lat = 52.35, lon = 5.26, zon = 11.5 } = {}) {
  d.current.time = isoLokaal(uur, minuut);
  d.current.interval = 900;
  d.current.is_day = dag ? 1 : 0;
  d.current.visibility = d.current.visibility ?? 16000;
  d.latitude = lat; d.longitude = lon; d.elevation = 3;
  if (!d.daily.sunshine_duration) d.daily.sunshine_duration = d.daily.time.map(() => zon * 3600);
  return d;
}

function lucht({ aqi = 25, usAqi = 35, pollen = {} } = {}) {
  return {
    current: { european_aqi: aqi, us_aqi: usAqi },
    hourly: {
      time: [isoLokaal(14)],
      alder_pollen: [pollen.els ?? 0], birch_pollen: [pollen.berk ?? 0], grass_pollen: [pollen.gras ?? 0],
      mugwort_pollen: [pollen.bijvoet ?? 0], ragweed_pollen: [pollen.ambrosia ?? 0], olive_pollen: [pollen.olijf ?? 0]
    }
  };
}

function knmiNowcast(refIso, waarden) {
  const ref = Date.parse(refIso);
  return {
    beschikbaar: true, provider: "knmi", bron: "KNMI",
    capabilities: { actueel: true, nowcast: true, nowcastMinuten: 120 },
    opgehaaldOp: refIso,
    actueel: { waarde: waarden[0], tijd: refIso, units: "mm/hr" },
    nowcast: {
      referenceTime: refIso, units: "mm/hr", horizonMinuten: 120,
      punten: Array.from({ length: 25 }, (_, i) => ({ tijd: new Date(ref + i * 300000).toISOString().replace(".000Z", "Z"), waarde: waarden[i] ?? 0 }))
    }
  };
}

const GEEN_WAARSCHUWING = { bron: "test", dekking: true, lijst: [], land: "NL" };

const SCENARIOS = [
  {
    naam: "zonnig-middag",
    url: "/?lat=52.35&lon=5.26&plaats=Almere&land=NL",
    nu: nuMs(14),
    forecast: () => afwerken(metKwartier(bouw({ wc: () => 0, wcNu: 0, cc: () => 5, ccNu: 5, pp: () => 0, pr: () => 0, som: 0, temp: u => +(18 + 7 * Math.sin((u - 8) / 24 * 2 * Math.PI)).toFixed(1) }), 14, 0)),
    lucht: lucht({ aqi: 18, pollen: { gras: 12 } }),
    knmi: knmiNowcast("2026-07-22T12:00:00Z", Array(25).fill(0))
  },
  {
    naam: "bewolkt-droog",
    url: "/?lat=52.35&lon=5.26&plaats=Almere&land=NL",
    nu: nuMs(10, 20),
    forecast: () => afwerken(metKwartier(bouw({ wc: () => 3, wcNu: 3, cc: () => 95, ccNu: 95, pp: () => 10, pr: () => 0, som: 0 }), 10, 20), { uur: 10, minuut: 20 }),
    lucht: lucht({ aqi: 42, pollen: { berk: 30 } }),
    knmi: knmiNowcast("2026-07-22T08:15:00Z", Array(25).fill(0))
  },
  {
    naam: "regen-nu",
    url: "/?lat=52.35&lon=5.26&plaats=Almere&land=NL",
    nu: nuMs(15, 10),
    forecast: () => afwerken(metKwartier(bouw({ wc: (u) => (u >= 13 && u <= 18 ? 63 : 3), wcNu: 63, cc: () => 100, ccNu: 100, pp: (u) => (u >= 12 && u <= 19 ? 90 : 30), pr: (u) => (u >= 13 && u <= 18 ? 2.4 : 0), nu: 2.1, som: 9.6 }), 15, 10, () => 0.6, () => 63), { uur: 15, minuut: 10 }),
    lucht: lucht({ aqi: 12 }),
    knmi: knmiNowcast("2026-07-22T13:05:00Z", [2.5, 3.1, 2.8, 2.2, 1.9, 1.4, 1.0, 0.6, 0.3, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  },
  {
    naam: "regen-later",
    url: "/?lat=52.35&lon=5.26&plaats=Almere&land=NL",
    nu: nuMs(13, 40),
    forecast: () => afwerken(metKwartier(bouw({ wc: (u) => (u >= 17 && u <= 21 ? 61 : 2), wcNu: 2, cc: (u) => (u >= 16 ? 90 : 40), ccNu: 40, pp: (u) => (u >= 16 && u <= 22 ? 70 : 5), pr: (u) => (u >= 17 && u <= 21 ? 0.8 : 0), nu: 0, som: 3.2 }), 13, 40), { uur: 13, minuut: 40 }),
    lucht: lucht({ aqi: 30, pollen: { gras: 45, bijvoet: 8 } }),
    knmi: knmiNowcast("2026-07-22T11:35:00Z", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.5, 0.9, 1.2, 1.1, 0.8, 0.5])
  },
  {
    naam: "onweer-storm",
    url: "/?lat=52.35&lon=5.26&plaats=Almere&land=NL",
    nu: nuMs(16),
    forecast: () => afwerken(metKwartier(bouw({ wc: (u) => (u >= 15 && u <= 20 ? 95 : 80), wcNu: 95, cc: () => 100, ccNu: 100, pp: () => 85, pr: (u) => (u >= 15 && u <= 20 ? 6 : 1), nu: 7, som: 28, ws: 45, wsNu: 50, wg: () => 95 }), 16, 0, () => 2, () => 95), { uur: 16 }),
    lucht: lucht({ aqi: 20 }),
    knmi: knmiNowcast("2026-07-22T13:55:00Z", [8, 12, 15, 11, 7, 4, 2, 1, 0.5, 0.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    waarschuwingen: { bron: "test", dekking: true, land: "NL", lijst: [
      { titel: "Code oranje: zware windstoten", tekst: "Zware windstoten tot 100 km/u.", niveau: "oranje", van: "2026-07-22T12:00:00Z", tot: "2026-07-22T23:00:00Z", gebied: "Flevoland", plaatsSpecifiek: true },
      { titel: "Code geel: onweersbuien", tekst: "Lokaal zware onweersbuien met hagel.", niveau: "geel", van: "2026-07-22T12:00:00Z", tot: "2026-07-23T02:00:00Z", gebied: "Flevoland", plaatsSpecifiek: true }
    ] }
  },
  {
    naam: "vorst-sneeuw",
    url: "/?lat=52.35&lon=5.26&plaats=Almere&land=NL",
    nu: nuMs(8, 5),
    forecast: () => {
      const d = bouw({ temp: (u) => +(-4 + 3 * Math.sin((u - 8) / 24 * 2 * Math.PI)).toFixed(1), wc: (u) => (u >= 7 && u <= 13 ? 73 : 3), wcNu: 73, cc: () => 100, ccNu: 100, pp: () => 80, pr: (u) => (u >= 7 && u <= 13 ? 0.9 : 0), nu: 0.8, som: 4.1, spreiding: 1, rh: 92 });
      d.hourly.snowfall = d.hourly.precipitation.map(v => +(v * 0.7).toFixed(2));
      d.hourly.rain = d.hourly.precipitation.map(() => 0);
      d.daily.temperature_2m_max = d.daily.time.map(() => -1);
      d.daily.temperature_2m_min = d.daily.time.map(() => -7);
      d.daily.weather_code = d.daily.time.map(() => 73);
      return afwerken(metKwartier(d, 8, 5, () => 0.3, () => 73), { uur: 8, minuut: 5 });
    },
    lucht: lucht({ aqi: 55 }),
    knmi: knmiNowcast("2026-07-22T06:00:00Z", Array(25).fill(0.4))
  },
  {
    naam: "mist-ochtend",
    url: "/?lat=52.35&lon=5.26&plaats=Almere&land=NL",
    nu: nuMs(6, 30),
    forecast: () => { const d = bouw({ wc: (u) => (u <= 10 ? 45 : 2), wcNu: 45, cc: () => 100, ccNu: 100, pp: () => 0, pr: () => 0, som: 0, zicht: 200, spreiding: 0.3, rh: 99 }); d.current.visibility = 200; return afwerken(metKwartier(d, 6, 30), { uur: 6, minuut: 30 }); },
    lucht: lucht({ aqi: 70, pollen: { els: 60 } }),
    knmi: knmiNowcast("2026-07-22T04:25:00Z", Array(25).fill(0))
  },
  {
    naam: "hitte-uv",
    url: "/?lat=52.35&lon=5.26&plaats=Almere&land=NL",
    nu: nuMs(15),
    forecast: () => {
      const d = bouw({ temp: (u) => +(26 + 9 * Math.sin((u - 9) / 24 * 2 * Math.PI)).toFixed(1), wc: () => 0, wcNu: 0, cc: () => 0, ccNu: 0, pp: () => 0, pr: () => 0, som: 0, rh: 30 });
      d.hourly.uv_index = d.hourly.uv_index.map(v => +(v * 2).toFixed(1));
      d.daily.temperature_2m_max = d.daily.time.map(() => 35);
      d.daily.uv_index_max = d.daily.time.map(() => 9);
      return afwerken(metKwartier(d, 15, 0), { uur: 15 });
    },
    lucht: lucht({ aqi: 95, usAqi: 160, pollen: { gras: 150, ambrosia: 40 } }),
    knmi: knmiNowcast("2026-07-22T12:55:00Z", Array(25).fill(0))
  },
  {
    naam: "nacht-helder",
    url: "/?lat=52.35&lon=5.26&plaats=Almere&land=NL",
    nu: nuMs(1, 45),
    forecast: () => afwerken(metKwartier(bouw({ wc: () => 0, wcNu: 0, cc: () => 0, ccNu: 0, pp: () => 0, pr: () => 0, som: 0, nacht: true }), 1, 45), { uur: 1, minuut: 45, dag: false }),
    lucht: lucht({ aqi: 15 }),
    knmi: knmiNowcast("2026-07-21T23:40:00Z", Array(25).fill(0))
  },
  {
    naam: "avond-na-zonsondergang",
    url: "/?lat=52.35&lon=5.26&plaats=Almere&land=NL",
    nu: nuMs(22, 10),
    forecast: () => afwerken(metKwartier(bouw({ wc: () => 2, wcNu: 2, cc: () => 30, ccNu: 30, pp: () => 5, pr: () => 0, som: 0, nacht: true }), 22, 10), { uur: 22, minuut: 10, dag: false }),
    lucht: lucht({ aqi: 22 }),
    knmi: knmiNowcast("2026-07-22T20:05:00Z", Array(25).fill(0))
  },
  {
    naam: "poolzon",
    url: "/?lat=69.65&lon=18.96&plaats=Troms%C3%B8&land=NO",
    nu: nuMs(12),
    forecast: () => { const d = bouw({ poolzon: true, wc: () => 2, wcNu: 2, cc: () => 30, ccNu: 30 }); d.timezone = "Europe/Oslo"; return afwerken(metKwartier(d, 12, 0), { lat: 69.65, lon: 18.96, zon: 20 }); },
    lucht: lucht({ aqi: 10 }),
    waarschuwingen: { bron: null, dekking: false, lijst: [], land: "NO", reden: "geen waarschuwingsbron voor NO" }
  },
  {
    naam: "buitenland-vs",
    url: "/?lat=40.71&lon=-74.01&plaats=New%20York&land=US",
    nu: nuMs(14),
    forecast: () => { const d = bouw({ wc: () => 61, wcNu: 61, cc: () => 90, ccNu: 90, pp: () => 60, pr: () => 0.6, nu: 0.5 }); d.timezone = "America/New_York"; d.utc_offset_seconds = -14400; return afwerken(metKwartier(d, 14, 0, () => 0.2, () => 61), { lat: 40.71, lon: -74.01 }); },
    lucht: lucht({ aqi: 60, usAqi: 110 }),
    waarschuwingen: { bron: "NWS", dekking: true, land: "US", lijst: [{ titel: "Flood Watch", tekst: "Heavy rain may cause flooding.", niveau: "geel", plaatsSpecifiek: true, van: null, tot: null }] }
  }
];

module.exports = { SCENARIOS, GEEN_WAARSCHUWING, nuMs, isoLokaal };
