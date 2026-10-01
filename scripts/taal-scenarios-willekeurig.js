"use strict";

/*
 * Willekeurige, maar reproduceerbare weersituaties voor de taalbewaker. De
 * vaste scenario's dekken bekende gevallen; deze reeks varieert tijdstip,
 * weertype, temperatuur, wind (kracht en richting), zicht, vocht, neerslag nu
 * en straks, luchtkwaliteit, pollen, waarschuwingen en land. Zo verschijnen
 * ook zinsvarianten die niemand vooraf bedacht, en faalt de bewaker op iedere
 * nieuwe Nederlandse zin zonder Engelse vertaling.
 */

const { bouw } = require("../data.js");
const { nuMs, isoLokaal } = require("./taal-scenarios.js");

function prng(zaad) {
  let s = zaad >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const CODES = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
const NAT = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]);
const SNEEUW = new Set([71, 73, 75, 77, 85, 86]);
const PLAATSEN = [
  { plaats: "Almere", land: "NL", lat: 52.35, lon: 5.26, tz: "Europe/Amsterdam", offset: 7200, waarsch: "meteoalarm" },
  { plaats: "Gent", land: "BE", lat: 51.05, lon: 3.72, tz: "Europe/Brussels", offset: 7200, waarsch: "meteoalarm" },
  { plaats: "Denver", land: "US", lat: 39.74, lon: -104.99, tz: "America/Denver", offset: -21600, waarsch: "nws" },
  { plaats: "Reykjavík", land: "IS", lat: 64.15, lon: -21.94, tz: "Atlantic/Reykjavik", offset: 0, waarsch: "meteoalarm" },
  { plaats: "Nairobi", land: "KE", lat: -1.29, lon: 36.82, tz: "Africa/Nairobi", offset: 10800, waarsch: null }
];
/* Waarschuwingsteksten komen in het Engels uit de API (MeteoAlarm en-GB) als
   de bezoeker Engels kiest; hier daarom zinnen die de app zelf kent. */
const METEOALARM = [
  ["Code geel: onweersbuien", "Lokaal zware onweersbuien met hagel."], ["Code oranje: zware windstoten", "Zware windstoten tot 100 km/u."],
  ["Code geel: gladheid", "Lokaal zware onweersbuien met hagel."], ["Code geel: hitte", "Zware windstoten tot 100 km/u."],
  ["Code geel: mist", "Lokaal zware onweersbuien met hagel."], ["Code rood: zware windstoten", "Zware windstoten tot 100 km/u."]
];
const NWS = ["Flood Watch", "Flood Warning", "Flash Flood Warning", "Tornado Watch", "Tornado Warning", "Severe Thunderstorm Watch", "Severe Thunderstorm Warning", "Heat Advisory", "Excessive Heat Warning", "Wind Advisory", "High Wind Warning", "Winter Storm Warning", "Winter Weather Advisory", "Dense Fog Advisory", "Air Quality Alert"];

function kies(r, lijst) { return lijst[Math.floor(r() * lijst.length)]; }

function knmi(r, refIso, soort) {
  const ref = Date.parse(refIso);
  const waarden = Array.from({ length: 25 }, (_, i) => {
    if (soort === "droog") return 0;
    if (soort === "nu") return Math.max(0, +(r() * 6 * (1 - i / 12)).toFixed(1));
    if (soort === "later") return i > 10 ? +(r() * 3).toFixed(1) : 0;
    return +(r() * 0.3).toFixed(1);
  });
  return {
    beschikbaar: true, provider: "knmi", bron: "KNMI", capabilities: { actueel: true, nowcast: true, nowcastMinuten: 120 }, opgehaaldOp: refIso,
    actueel: { waarde: waarden[0], tijd: refIso, units: "mm/hr" },
    nowcast: { referenceTime: refIso, units: "mm/hr", horizonMinuten: 120, punten: waarden.map((w, i) => ({ tijd: new Date(ref + i * 300000).toISOString().replace(".000Z", "Z"), waarde: w })) }
  };
}

function willekeurigeScenarios(aantal = 24, zaad = 20260930) {
  const r = prng(zaad);
  const uit = [];
  for (let n = 0; n < aantal; n++) {
    const p = PLAATSEN[n % PLAATSEN.length];
    const uur = Math.floor(r() * 24), minuut = Math.floor(r() * 4) * 15 + Math.floor(r() * 3) * 5;
    const basis = -12 + r() * 46, amp = 1 + r() * 8;
    const codeNu = kies(r, CODES), codeLater = kies(r, CODES);
    const wisselUur = Math.floor(r() * 24);
    const wc = (u) => (u >= wisselUur ? codeLater : codeNu);
    const nat = (u) => NAT.has(wc(u));
    const ws = Math.round(r() * r() * 110), wd = Math.floor(r() * 360);
    const zicht = kies(r, [150, 600, 2500, 8000, 20000, 40000]);
    const rh = Math.round(20 + r() * 80);
    const som = +(r() * r() * 40).toFixed(1);
    const d = bouw({
      temp: (u) => +(basis + amp * Math.sin((u - 8) / 24 * 2 * Math.PI)).toFixed(1),
      wc, wcNu: codeNu,
      cc: (u) => Math.round(nat(u) ? 80 + r() * 20 : r() * 100), ccNu: Math.round(r() * 100),
      pp: (u) => Math.round(nat(u) ? 40 + r() * 60 : r() * 30),
      pr: (u) => (nat(u) ? +(r() * 5).toFixed(1) : 0), nu: NAT.has(codeNu) ? +(r() * 4).toFixed(1) : 0, som,
      ws, wsNu: ws, wg: () => Math.round(ws * (1.3 + r())), zicht, rh, spreiding: +(r() * 12).toFixed(1),
      nacht: uur < 6 || uur >= 22
    });
    d.hourly.wind_direction_10m = d.hourly.wind_direction_10m.map(() => (wd + Math.round((r() - 0.5) * 90) + 360) % 360);
    d.current.wind_direction_10m = wd;
    if (SNEEUW.has(codeNu) || SNEEUW.has(codeLater)) { d.hourly.snowfall = d.hourly.precipitation.map(v => +(v * 0.7).toFixed(2)); d.hourly.rain = d.hourly.precipitation.map(() => 0); }
    d.hourly.uv_index = d.hourly.uv_index.map(v => +(v * r() * 2.5).toFixed(1));
    d.daily.temperature_2m_max = d.daily.time.map(() => Math.round(basis + amp + r() * 3));
    d.daily.temperature_2m_min = d.daily.time.map(() => Math.round(basis - amp - r() * 3));
    d.daily.weather_code = d.daily.time.map(() => kies(r, CODES));
    d.daily.precipitation_probability_max = d.daily.time.map(() => Math.round(r() * 100));
    d.daily.precipitation_sum = d.daily.time.map(() => +(r() * r() * 30).toFixed(1));
    d.daily.wind_speed_10m_max = d.daily.time.map(() => Math.round(r() * 90));
    d.daily.wind_gusts_10m_max = d.daily.time.map(() => Math.round(r() * 130));
    d.daily.wind_direction_10m_dominant = d.daily.time.map(() => Math.floor(r() * 360));
    d.daily.uv_index_max = d.daily.time.map(() => +(r() * 11).toFixed(1));
    d.timezone = p.tz; d.utc_offset_seconds = p.offset;
    d.current.time = isoLokaal(uur, minuut);
    d.current.interval = 900;
    d.current.is_day = uur >= 6 && uur < 21 ? 1 : 0;
    d.current.visibility = zicht;
    d.latitude = p.lat; d.longitude = p.lon; d.elevation = Math.round(r() * 1600);
    d.daily.sunshine_duration = d.daily.time.map(() => Math.round(r() * 14 * 3600));

    const utcMs = Date.UTC(2026, 6, 22, uur, minuut) - p.offset * 1000;
    let waarschuwingen = { bron: null, dekking: false, lijst: [], land: p.land, reden: "geen waarschuwingsbron" };
    if (p.waarsch === "meteoalarm") {
      const lijst = r() < 0.5 ? [] : [kies(r, METEOALARM)].map(([titel, tekst]) => ({ titel, tekst, niveau: /rood/.test(titel) ? "rood" : /oranje/.test(titel) ? "oranje" : "geel", van: new Date(utcMs - 3600000).toISOString(), tot: new Date(utcMs + (2 + r() * 30) * 3600000).toISOString(), gebied: p.plaats, plaatsSpecifiek: r() < 0.7 }));
      waarschuwingen = { bron: "test", dekking: true, land: p.land, lijst };
    } else if (p.waarsch === "nws") {
      const lijst = r() < 0.4 ? [] : [{ titel: kies(r, NWS), tekst: "Heavy rain may cause flooding.", niveau: "geel", plaatsSpecifiek: true, van: null, tot: null }];
      waarschuwingen = { bron: "NWS", dekking: true, land: "US", lijst };
    }
    const refIso = new Date(utcMs - 5 * 60000).toISOString().replace(".000Z", "Z");
    const knmiAntwoord = p.land === "NL" || p.land === "BE" ? knmi(r, refIso, kies(r, ["droog", "nu", "later", "druppels"])) : { beschikbaar: false, provider: null, reden: "geen actuele neerslagprovider voor deze locatie" };
    const vorm = { european_aqi: Math.round(r() * 120), us_aqi: Math.round(r() * 220) };
    uit.push({
      naam: `willekeurig-${n + 1}`,
      url: `/?lat=${p.lat}&lon=${p.lon}&plaats=${encodeURIComponent(p.plaats)}&land=${p.land}`,
      nu: utcMs,
      forecast: () => JSON.parse(JSON.stringify(d)),
      lucht: r() < 0.1 ? null : {
        current: vorm,
        hourly: { time: [isoLokaal(uur)], alder_pollen: [Math.round(r() * r() * 150)], birch_pollen: [Math.round(r() * r() * 300)], grass_pollen: [Math.round(r() * r() * 200)], mugwort_pollen: [Math.round(r() * r() * 60)], ragweed_pollen: [Math.round(r() * r() * 60)], olive_pollen: [Math.round(r() * r() * 100)] }
      },
      knmi: knmiAntwoord,
      waarschuwingen
    });
  }
  return uit;
}

module.exports = { willekeurigeScenarios, PLAATSEN };
