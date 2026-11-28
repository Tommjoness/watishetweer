"use strict";

const { eenForecast } = require("../openmeteo-fixture.js");

const PARK = { slug: "alde-feanen", lat: 53.1244, lon: 5.9233, land: "NL", tz: "Europe/Amsterdam" };
const VELDEN = new URLSearchParams({
  current: "temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,rain,showers,snowfall,visibility,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
  hourly: "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,uv_index,pressure_msl,is_day",
  daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,precipitation_sum,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunshine_duration",
  minutely_15: "precipitation,rain,showers,snowfall,weather_code",
  forecast_minutely_15: "16",
  past_minutely_15: "4",
  past_hours: "24",
  forecast_days: "7",
  wind_speed_unit: "kmh"
});

function verwachting(nu, bewolking, plaats = PARK) {
  const d = eenForecast(plaats.lat, plaats.lon, VELDEN, nu, plaats.tz);
  const weer = {
    temperature_2m: 10, apparent_temperature: 10, relative_humidity_2m: 65, dew_point_2m: 4,
    precipitation_probability: 0, precipitation: 0, rain: 0, showers: 0, snowfall: 0,
    visibility: 20000, weather_code: 1, cloud_cover: bewolking, wind_speed_10m: 8, wind_gusts_10m: 15
  };
  for (const [veld, waarde] of Object.entries(weer)) {
    if (veld in d.current) d.current[veld] = waarde;
    if (veld in d.hourly) d.hourly[veld].fill(waarde);
    if (veld in d.minutely_15) d.minutely_15[veld].fill(waarde);
  }
  for (const [veld, waarde] of Object.entries({
    weather_code: 1, temperature_2m_min: 10, temperature_2m_max: 10,
    precipitation_probability_max: 0, precipitation_sum: 0, wind_speed_10m_max: 8, wind_gusts_10m_max: 15
  })) d.daily[veld].fill(waarde);
  return d;
}

/* Verwachte scores uit de T02-tegenproef met de vaste provider-offset. De
   normale nacht is ook vóór de wijziging gemeten op de productieversie. */
const GEVALLEN = [
  { naam: "voorjaar", klok: "2026-03-28T12:30:00Z", offset: 3600, wolken: 25, score: 6.518986985131389, uren: 11, zonOp: "07:18", maanOnder: "06:18" },
  { naam: "najaar", klok: "2026-10-24T12:30:00Z", offset: 7200, wolken: 24, score: 6.462357363805134, uren: 14, zonOp: "07:22", maanOnder: "06:23" },
  { naam: "controle", klok: "2026-10-17T12:30:00Z", offset: 7200, wolken: 24, score: 7.561990994237837, uren: 14, zonOp: "08:09", maanOnder: "22:18", venster: "Beste periode: 19:00–08:00." },
  { naam: "eerste 02:30", klok: "2026-10-25T00:30:00Z", offset: 7200, wolken: 24, score: 6.766137903743413, uren: 7, zonOp: "07:22", maanOnder: "06:23" },
  { naam: "tweede 02:30", klok: "2026-10-25T01:30:00Z", offset: 3600, wolken: 24, score: 6.914955873840143, uren: 6, zonOp: "07:22", maanOnder: "06:23" }
];

/* Het tijdorakel gebruikt de definitie van de provider en de standaardformatter,
   onafhankelijk van de conversie in de browsercode. */
const instant = (tijd, d) => Date.parse(tijd + "Z") - d.utc_offset_seconds * 1000;
const lokaal = (ms, tz) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);

function verwachteUurlabels(d, nu) {
  const h = d.hourly, actief = d.current.is_day === 0;
  const nuIndex = h.time.findIndex(t => t.slice(0, 13) === d.current.time.slice(0, 13));
  const eerste = actief ? nuIndex + 1 : h.is_day.findIndex((v, i) => i >= nuIndex && v === 0);
  const tijden = actief ? [nu] : [];
  for (let i = eerste; h.is_day[i] === 0; i++) tijden.push(instant(h.time[i], d));
  return tijden.map(ms => lokaal(ms, d.timezone));
}

module.exports = { PARK, GEVALLEN, verwachting, instant, lokaal, verwachteUurlabels };
