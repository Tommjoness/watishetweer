/* Realistische providerdata rond klokwissels, voor de tests van de reserveroute
   (Visual Crossing en WeatherAPI). Dit bestand is geen test.

   De data wordt bewust onafhankelijk van de adapters opgebouwd: de lokale tijd
   en de UTC-afwijking komen uit Intl met timeZoneName "longOffset" (de adapters
   rekenen met de losse onderdelen van formatToParts). Zo toetst een test echt
   het contract en niet de eigen rekenmethode van de adapter.

   Een uurrecord krijgt als temperatuur het UTC-uur van zijn moment (0 tot 23).
   Raakt een uur losgekoppeld van zijn moment, dan klopt de temperatuur niet
   meer met de tijd. Zon op staat op 07:15 en zon onder op 17:30 lokale tijd. */

const UUR = 3600;

export function offsetSeconden(epochS, timezone) {
  const naam = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" })
    .formatToParts(new Date(epochS * 1000)).find(deel => deel.type === "timeZoneName").value;
  if (naam === "GMT") return 0;
  const m = /^GMT([+-])(\d{2}):(\d{2})$/.exec(naam);
  if (!m) throw new Error(`Onbekende offsetnaam ${naam} voor ${timezone}`);
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60);
}

/* Werkelijke lokale kloktijd van een moment. */
export function lokaal(epochS, timezone) {
  const offset = offsetSeconden(epochS, timezone);
  const iso = new Date((epochS + offset) * 1000).toISOString();
  return { datum: iso.slice(0, 10), uur: iso.slice(11, 13), minuut: iso.slice(14, 16), tijd: iso.slice(0, 16), offset };
}

export function volgendeDatum(datum, dagen = 1) {
  return new Date(Date.parse(`${datum}T00:00:00Z`) + dagen * 86400000).toISOString().slice(0, 10);
}

/* Alle momenten waarop de lokale klok op een hele uur (:00) staat, op die
   lokale datum: 24 op een gewone dag, 23 bij de voorjaarsovergang, 25 bij de
   najaarsovergang (het dubbele klokuur telt twee keer). */
export function lokaleUren(datum, timezone) {
  const start = Date.parse(`${datum}T00:00:00Z`) / 1000 - 16 * UUR;
  const uren = [];
  for (let t = start; t < start + 56 * UUR; t += 900) {
    const l = lokaal(t, timezone);
    if (l.datum === datum && l.minuut === "00") uren.push(t);
  }
  return uren;
}

function sluit(waarde, stappen) { return waarde === undefined ? stappen : waarde; }

/* Visual Crossing-vorm (Timeline API, unitGroup=metric): lokale kloktijden als
   tekst, en bij ieder record het echte moment in datetimeEpoch. tzoffset in
   currentConditions volgt wat de live reserveroute op 25 oktober 2026 gaf: de
   afwijking aan het begin van de eerste lokale dag (2), terwijl de klok om 10:37
   al op +1 stond. */
export function vcPayload({ timezone, nuEpochS, startDatum, dagen = 7, tzoffsetUren, zonderUurEpoch = false, vasteChaos = null }) {
  const eersteDagUren = lokaleUren(startDatum, timezone);
  const beginOffset = offsetSeconden(eersteDagUren[0], timezone) / UUR;
  const lijst = Array.from({ length: dagen }, (_, i) => {
    const datum = volgendeDatum(startDatum, i);
    const uren = lokaleUren(datum, timezone);
    const uurRecords = uren.map(epoch => {
      const l = lokaal(epoch, timezone);
      const utcUur = new Date(epoch * 1000).getUTCHours();
      const record = {
        datetime: `${l.uur}:00:00`,
        temp: utcUur, feelslike: utcUur - 1, humidity: 72, dew: 6,
        precip: 0, precipprob: 5, preciptype: null, snow: 0,
        windgust: 30, windspeed: 18, winddir: 225, pressure: 1015, cloudcover: 45, visibility: 12,
        uvindex: 0, icon: Number(l.uur) >= 7 && Number(l.uur) < 17 ? "partly-cloudy-day" : "partly-cloudy-night"
      };
      if (!zonderUurEpoch) record.datetimeEpoch = epoch;
      return record;
    });
    const zon07 = uren.find(epoch => lokaal(epoch, timezone).uur === "07");
    const zon17 = uren.find(epoch => lokaal(epoch, timezone).uur === "17");
    return {
      datetime: datum, tempmax: 14, tempmin: 7, temp: 10, precip: 0.2, precipprob: 20, preciptype: null, snow: 0,
      windgust: 31, windspeed: 24, winddir: 225, pressure: 1015, cloudcover: 45, visibility: 12, uvindex: 2,
      icon: "partly-cloudy-day",
      sunrise: "07:15:00", sunriseEpoch: zon07 === undefined ? undefined : zon07 + 15 * 60,
      sunset: "17:30:00", sunsetEpoch: zon17 === undefined ? undefined : zon17 + 30 * 60,
      hours: uurRecords
    };
  });
  const nu = lokaal(nuEpochS, timezone);
  return {
    latitude: 52.37, longitude: 4.9, timezone,
    tzoffset: sluit(tzoffsetUren, beginOffset),
    currentConditions: {
      datetime: `${nu.uur}:${nu.minuut}:00`, datetimeEpoch: nuEpochS, tzoffset: sluit(tzoffsetUren, beginOffset),
      temp: 12, feelslike: 11, humidity: 70, dew: 6, precip: 0, precipprob: 5, preciptype: null, snow: 0,
      windgust: 29, windspeed: 17, winddir: 225, pressure: 1015, cloudcover: 45, visibility: 12, uvindex: 0,
      icon: Number(nu.uur) >= 7 && Number(nu.uur) < 17 ? "partly-cloudy-day" : "partly-cloudy-night"
    },
    days: lijst
  };
}

/* WeatherAPI-vorm (forecast.json): lokale kloktijden als tekst ("2026-10-25
   02:00") plus time_epoch, en location.localtime_epoch voor het moment van
   opvragen. De vorm volgt de API-documentatie; WeatherAPI is hier niet live
   getest (geen sleutel). uren24 laat per dag alleen de 24 lokale klokuren
   (00 tot 23) zien, ook op een dag van 25 uur. */
export function weatherApiPayload({ timezone, nuEpochS, startDatum, dagen = 7, uren24 = false }) {
  const nu = lokaal(nuEpochS, timezone);
  const forecastday = Array.from({ length: dagen }, (_, i) => {
    const datum = volgendeDatum(startDatum, i);
    let uren = lokaleUren(datum, timezone);
    if (uren24) {
      const gezien = new Set();
      uren = uren.filter(epoch => { const u = lokaal(epoch, timezone).uur; if (gezien.has(u)) return false; gezien.add(u); return true; });
    }
    const zon07 = uren.find(epoch => lokaal(epoch, timezone).uur === "07");
    return {
      date: datum, date_epoch: Date.parse(`${datum}T00:00:00Z`) / 1000,
      day: {
        maxtemp_c: 14, mintemp_c: 7, maxwind_kph: 24, totalprecip_mm: 0.2, totalsnow_cm: 0,
        condition: { code: 1003 }, uv: 2, daily_chance_of_rain: 20, daily_chance_of_snow: 0
      },
      astro: { sunrise: "07:15 AM", sunset: "05:30 PM" },
      hour: uren.map(epoch => {
        const l = lokaal(epoch, timezone);
        const utcUur = new Date(epoch * 1000).getUTCHours();
        return {
          time_epoch: epoch, time: `${l.datum} ${l.uur}:00`,
          temp_c: utcUur, feelslike_c: utcUur - 1, humidity: 70, dewpoint_c: 6,
          chance_of_rain: 5, chance_of_snow: 0, precip_mm: 0, snow_cm: 0,
          condition: { code: 1003 }, cloud: 45, wind_kph: 18, wind_degree: 225, gust_kph: 31, vis_km: 12,
          uv: 0, pressure_mb: 1015, is_day: Number(l.uur) >= 7 && Number(l.uur) < 17 ? 1 : 0
        };
      }),
      _zon07: zon07
    };
  }).map(({ _zon07, ...dag }) => dag);
  return {
    location: {
      name: "Test", lat: 52.37, lon: 4.9, tz_id: timezone,
      localtime_epoch: nuEpochS, localtime: `${nu.datum} ${nu.uur}:${nu.minuut}`
    },
    current: {
      last_updated_epoch: nuEpochS, last_updated: `${nu.datum} ${nu.uur}:${nu.minuut}`,
      temp_c: 12, feelslike_c: 11, humidity: 70, is_day: 1, precip_mm: 0, condition: { code: 1003 },
      cloud: 45, pressure_mb: 1015, wind_kph: 17, wind_degree: 225, gust_kph: 29, vis_km: 12
    },
    forecast: { forecastday }
  };
}

/* De situaties die de adapters moeten doorstaan: elk met het moment van
   opvragen (UTC), de lokale startdatum en de afwijking die op dat moment geldt.
   uren = aantal uurrecords in de zeven dagen (23 of 25 uur op een wisseldag). */
export const SCENARIOS = Object.freeze([
  { naam: "Amsterdam za 24 okt 2026 12:00, de wissel valt in het venster (najaar)", timezone: "Europe/Amsterdam", nu: "2026-10-24T10:00:00Z", start: "2026-10-24", offset: 7200, uren: 169 },
  { naam: "Amsterdam zo 25 okt 2026 02:30 CEST (eerste 02:30)", timezone: "Europe/Amsterdam", nu: "2026-10-25T00:30:00Z", start: "2026-10-25", offset: 7200, uren: 169 },
  { naam: "Amsterdam zo 25 okt 2026 02:30 CET (tweede 02:30)", timezone: "Europe/Amsterdam", nu: "2026-10-25T01:30:00Z", start: "2026-10-25", offset: 3600, uren: 169 },
  { naam: "Amsterdam zo 25 okt 2026 10:37, live gemeten fout", timezone: "Europe/Amsterdam", nu: "2026-10-25T09:37:00Z", start: "2026-10-25", offset: 3600, uren: 169 },
  { naam: "Amsterdam ma 26 okt 2026, geen wissel meer in het venster", timezone: "Europe/Amsterdam", nu: "2026-10-26T11:00:00Z", start: "2026-10-26", offset: 3600, uren: 168 },
  { naam: "Amsterdam za 27 mrt 2027 12:00, de wissel valt in het venster (voorjaar)", timezone: "Europe/Amsterdam", nu: "2027-03-27T11:00:00Z", start: "2027-03-27", offset: 3600, uren: 167 },
  { naam: "Amsterdam zo 28 mrt 2027 12:00 CEST, wisseldag zelf", timezone: "Europe/Amsterdam", nu: "2027-03-28T10:00:00Z", start: "2027-03-28", offset: 7200, uren: 167 },
  { naam: "New York za 31 okt 2026 12:00 EDT, najaarswissel in het venster", timezone: "America/New_York", nu: "2026-10-31T16:00:00Z", start: "2026-10-31", offset: -14400, uren: 169 },
  { naam: "New York zo 1 nov 2026 12:00 EST, wisseldag zelf", timezone: "America/New_York", nu: "2026-11-01T17:00:00Z", start: "2026-11-01", offset: -18000, uren: 169 },
  { naam: "New York za 13 mrt 2027 12:00 EST, voorjaarswissel in het venster", timezone: "America/New_York", nu: "2027-03-13T17:00:00Z", start: "2027-03-13", offset: -18000, uren: 167 },
  { naam: "Sydney za 3 okt 2026 12:00 AEST, zuidelijk halfrond, voorjaarssprong in het venster", timezone: "Australia/Sydney", nu: "2026-10-03T02:00:00Z", start: "2026-10-03", offset: 36000, uren: 167 },
  { naam: "Sydney zo 4 okt 2026 12:00 AEDT, wisseldag zelf", timezone: "Australia/Sydney", nu: "2026-10-04T01:00:00Z", start: "2026-10-04", offset: 39600, uren: 167 },
  { naam: "Sydney za 3 apr 2027 12:00 AEDT, najaarsovergang in het venster", timezone: "Australia/Sydney", nu: "2027-04-03T01:00:00Z", start: "2027-04-03", offset: 39600, uren: 169 },
  { naam: "Santiago za 3 apr 2027 12:00, zuidelijk halfrond, najaarsovergang in het venster", timezone: "America/Santiago", nu: "2027-04-03T15:00:00Z", start: "2027-04-03", offset: -10800, uren: 169 },
  { naam: "Lord Howe za 3 okt 2026 12:00 (zomertijd met een verschuiving van een half uur)", timezone: "Australia/Lord_Howe", nu: "2026-10-03T02:00:00Z", start: "2026-10-03", offset: 37800, uren: 167, halfuursSprong: true },
  { naam: "Tokio, geen zomertijd", timezone: "Asia/Tokyo", nu: "2026-10-25T03:00:00Z", start: "2026-10-25", offset: 32400, uren: 168 },
  { naam: "Kolkata, halfuursoffset zonder zomertijd", timezone: "Asia/Kolkata", nu: "2026-10-25T03:00:00Z", start: "2026-10-25", offset: 19800, uren: 168 },
  { naam: "Kathmandu, kwartieroffset zonder zomertijd", timezone: "Asia/Kathmandu", nu: "2026-10-25T03:00:00Z", start: "2026-10-25", offset: 20700, uren: 168 },
  { naam: "Johannesburg, geen zomertijd", timezone: "Africa/Johannesburg", nu: "2026-10-25T03:00:00Z", start: "2026-10-25", offset: 7200, uren: 168 },
  { naam: "Sao Paulo, zomertijd afgeschaft", timezone: "America/Sao_Paulo", nu: "2026-10-25T15:00:00Z", start: "2026-10-25", offset: -10800, uren: 168 },
  { naam: "Kiritimati, UTC+14", timezone: "Pacific/Kiritimati", nu: "2026-10-25T03:00:00Z", start: "2026-10-25", offset: 50400, uren: 168 },
  { naam: "UTC-12 (Etc/GMT+12)", timezone: "Etc/GMT+12", nu: "2026-10-25T15:00:00Z", start: "2026-10-25", offset: -43200, uren: 168 }
]);

export const epochVan = iso => Date.parse(iso) / 1000;
