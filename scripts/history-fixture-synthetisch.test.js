"use strict";

/* Contract van de deterministische Open-Meteo-fixture (scripts/openmeteo-fixture.js).

   Sinds 20 november 2026 (Open-Meteo, ticket #235915) roept CI Open-Meteo niet meer live aan; de
   browsermonitors tegen preview en productie (wereldwijd, finale release, pre-sale met history- en
   cold-loadfixtures) krijgen voor de exacte productie-URL dit antwoord. Eerder gold deze test de
   synthetische terugval in run-production-pre-sale-acceptance-browser.js; die is door de gedeelde
   fixture vervangen. Dezelfde eisen gelden nu voor de fixture zelf, plus het vastgestelde
   Open-Meteo-contract:
   - dezelfde velden als de aanvraag, plaatselijke tijden op hele uren in de echte tijdzone (ook
     +05:45), de gevraagde lengtes, uur 24 is het huidige plaatselijke uur, dag 0 is vandaag;
   - alleen gevraagde velden en *_units; een onbekend veld geeft HTTP 400 zoals Open-Meteo;
   - één vaste utc_offset_seconds voor het hele antwoord, ook over een klokwissel heen;
   - poolnacht: sunrise = sunset = 00:00 van die dag; 24 uur daglicht: sunset 00:00 de dag erna;
   - timezone=auto zonder bekende plaats: GMT; meerdere coördinaten: een array;
   - deterministisch; dagwaarden volgen uit de uurwaarden (max/min, nooit uv in de nacht);
   - de runners gebruiken de fixture en halen niets live op. */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const F = require("./openmeteo-fixture.js");
const {poolDaglichtStatus} = require("./production-source-truth.js");

const url = "https://api.open-meteo.com/v1/forecast?latitude=27.7172&longitude=85.324"
  + "&current=temperature_2m,is_day,weather_code,wind_speed_10m"
  + "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,sunshine_duration"
  + "&forecast_days=7&forecast_hours=170&timezone=auto"
  + "&minutely_15=precipitation,weather_code&forecast_minutely_15=16&past_minutely_15=4"
  + "&past_hours=24&hourly=temperature_2m,precipitation,weather_code,uv_index,is_day";
const metPlaats = (u, loc) => u.replace("latitude=27.7172&longitude=85.324", `latitude=${loc.lat}&longitude=${loc.lon}`);
const antwoord = (u, loc, nu = Date.now()) => {
  const r = F.openMeteoAntwoord(u, {nu, tzVoor: () => loc.tz});
  assert.equal(r.status, 200, `${loc.name}: HTTP ${r.status} ${JSON.stringify(r.json)}`);
  return r.json;
};

for (const loc of [
  { name: "Kathmandu", lat: 27.7172, lon: 85.324, tz: "Asia/Kathmandu" },
  { name: "Almere", lat: 52.3508, lon: 5.2647, tz: "Europe/Amsterdam" },
  { name: "Dubai", lat: 25.2048, lon: 55.2708, tz: "Asia/Dubai" }
]) {
  const b = antwoord(metPlaats(url, loc), loc);
  assert.equal(b.timezone, loc.tz, `${loc.name}: tijdzone`);
  assert.equal(b.hourly.time.length, 24 + 170, `${loc.name}: 24 uur terug en 170 vooruit`);
  assert.equal(b.minutely_15.time.length, 4 + 16, `${loc.name}: kwartieren`);
  assert.equal(b.daily.time.length, 7, `${loc.name}: zeven dagen`);
  for (const veld of ["temperature_2m", "precipitation", "weather_code", "uv_index", "is_day"]) assert.equal(b.hourly[veld].length, b.hourly.time.length, `${loc.name}: uurreeks ${veld}`);
  for (const veld of ["temperature_2m", "is_day", "weather_code", "wind_speed_10m"]) assert(veld in b.current, `${loc.name}: current.${veld}`);
  assert.deepEqual(Object.keys(b.hourly).sort(), ["is_day", "precipitation", "temperature_2m", "time", "uv_index", "weather_code"], `${loc.name}: alleen gevraagde uurvelden`);
  assert.deepEqual(Object.keys(b.hourly_units).sort(), Object.keys(b.hourly).sort(), `${loc.name}: eenheden bij ieder uurveld`);
  assert(!("apparent_temperature" in b.current) && !("cloud_cover" in b.hourly), `${loc.name}: geen ongevraagde velden`);
  assert(b.hourly.time.every(t => /^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(t)), `${loc.name}: uurtijden op hele plaatselijke uren`);
  assert(b.minutely_15.time.every(t => /T\d{2}:(00|15|30|45)$/.test(t)), `${loc.name}: kwartiertijden`);
  const lokaalNu = new Intl.DateTimeFormat("sv-SE", { timeZone: loc.tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).format(new Date()).replace(" ", "T");
  assert.equal(b.hourly.time[24].slice(0, 13), lokaalNu.slice(0, 13), `${loc.name}: uur 24 is het huidige plaatselijke uur`);
  assert.equal(b.daily.time[0], lokaalNu.slice(0, 10), `${loc.name}: eerste dag is vandaag ter plaatse`);
  for (let d = 0; d < 6; d++) {
    const dag = b.daily.time[d], uren = b.hourly.time.map((t, i) => t.startsWith(dag) ? i : -1).filter(i => i >= 0);
    if (uren.length < 24) continue;
    assert.equal(b.daily.temperature_2m_max[d], Math.max(...uren.map(i => b.hourly.temperature_2m[i])), `${loc.name} ${dag}: dagmaximum uit de uurwaarden`);
    assert.equal(b.daily.temperature_2m_min[d], Math.min(...uren.map(i => b.hourly.temperature_2m[i])), `${loc.name} ${dag}: dagminimum uit de uurwaarden`);
  }
  b.hourly.uv_index.forEach((uv, i) => { if (b.hourly.is_day[i] === 0) assert.equal(uv, 0, `${loc.name}: geen uv in de nacht (${b.hourly.time[i]})`); });
}
const kathmandu = antwoord(url, { name: "Kathmandu", lat: 27.7172, lon: 85.324, tz: "Asia/Kathmandu" });
assert.equal(kathmandu.utc_offset_seconds, 20700, "Kathmandu: +05:45");

/* Eén vaste offset, ook over de klokwissel van 25 oktober 2026 heen (Open-Meteo-gedrag). */
{
  const nu = Date.parse("2026-10-24T12:07:00Z");
  const b = antwoord(metPlaats(url, { lat: 52.3676, lon: 4.9041 }), { name: "Amsterdam", tz: "Europe/Amsterdam" }, nu);
  assert.equal(b.utc_offset_seconds, 7200, "Amsterdam 24 oktober: CEST");
  assert.equal(b.hourly.time[24], "2026-10-24T14:00", "Amsterdam: huidig uur in de vaste offset");
  assert.equal(b.hourly.time[24 + 48], "2026-10-26T14:00", "Amsterdam: na de klokwissel blijft de offset +2 (geen dubbel of ontbrekend uur)");
  const ms = b.hourly.time.map(t => Date.parse(t + ":00Z"));
  assert(ms.every((t, i) => i === 0 || t - ms[i - 1] === 3600000), "Amsterdam: uurreeks zonder sprongen");
  const zon = b.daily.sunrise[0], onder = b.daily.sunset[0];
  assert(zon > "2026-10-24T08:00" && zon < "2026-10-24T08:45" && onder > "2026-10-24T18:05" && onder < "2026-10-24T18:45", `Amsterdam: zon op/onder plausibel (${zon} / ${onder})`);
}

/* Voorjaarsklokwissel (Amsterdam, 28 maart 2027) en zuidelijk halfrond (Sydney, 4 oktober 2026):
   ook dan één vaste offset en een uurreeks zonder sprongen. */
for (const [naam, tz, nuIso, offset] of [["Amsterdam", "Europe/Amsterdam", "2027-03-27T12:00:00Z", 3600], ["Sydney", "Australia/Sydney", "2026-10-03T02:00:00Z", 36000]]) {
  const b = antwoord(url, { name: naam, tz }, Date.parse(nuIso));
  assert.equal(b.utc_offset_seconds, offset, `${naam}: offset van nu`);
  const ms = b.hourly.time.map(t => Date.parse(t + ":00Z"));
  assert(ms.every((t, i) => i === 0 || t - ms[i - 1] === 3600000), `${naam}: geen dubbel of ontbrekend uur rond de klokwissel`);
  assert.equal(new Set(b.hourly.time).size, b.hourly.time.length, `${naam}: geen dubbele tijden`);
  assert.equal(b.daily.time.length, 7, `${naam}: zeven dagen`);
}

/* Poolgedrag zoals vastgesteld (production-source-truth.js) en GMT zonder bekende tijdzone. */
{
  const zonUrl = "https://api.open-meteo.com/v1/forecast?latitude=78.2232&longitude=15.6469&daily=sunrise,sunset&forecast_days=2&timezone=auto";
  const winter = antwoord(zonUrl, { name: "Longyearbyen", tz: "Arctic/Longyearbyen" }, Date.parse("2026-12-20T12:00:00Z"));
  assert.equal(winter.daily.sunrise[0], "2026-12-20T00:00"); assert.equal(winter.daily.sunset[0], "2026-12-20T00:00");
  assert.equal(poolDaglichtStatus(winter.daily, 0), "poolnacht", "Longyearbyen december: poolnacht");
  const zomer = antwoord(zonUrl, { name: "Longyearbyen", tz: "Arctic/Longyearbyen" }, Date.parse("2026-06-20T12:00:00Z"));
  assert.equal(poolDaglichtStatus(zomer.daily, 0), "24 uur daglicht", "Longyearbyen juni: 24 uur daglicht");
  const zuidpool = F.openMeteoAntwoord(zonUrl.replace("latitude=78.2232&longitude=15.6469", "latitude=-90&longitude=0"), { nu: Date.parse("2026-12-20T12:00:00Z"), tzVoor: () => null }).json;
  assert.equal(zuidpool.timezone, "GMT"); assert.equal(zuidpool.utc_offset_seconds, 0);
  assert.equal(poolDaglichtStatus(zuidpool.daily, 0), "24 uur daglicht", "Zuidpool december: 24 uur daglicht");
  const zuidpoolJuni = F.openMeteoAntwoord(zonUrl.replace("latitude=78.2232&longitude=15.6469", "latitude=-90&longitude=0"), { nu: Date.parse("2026-06-21T12:00:00Z"), tzVoor: () => null }).json;
  assert.equal(poolDaglichtStatus(zuidpoolJuni.daily, 0), "poolnacht", "Zuidpool juni: poolnacht");
  /* Overgang (Longyearbyen half april): iedere dag heeft een geldige volgorde, opkomst nooit na ondergang. */
  const overgang = F.openMeteoAntwoord(zonUrl.replace("forecast_days=2", "forecast_days=10"), { nu: Date.parse("2026-04-12T12:00:00Z"), tzVoor: () => "Arctic/Longyearbyen" }).json;
  overgang.daily.time.forEach((d, i) => {
    const op = overgang.daily.sunrise[i], onder = overgang.daily.sunset[i];
    assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(op) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(onder), `Longyearbyen ${d}: tijden in ISO-vorm`);
    assert(op.slice(0, 10) === d && onder >= op, `Longyearbyen ${d}: opkomst op die dag en niet na de ondergang (${op} / ${onder})`);
  });
}

/* Ontbrekende velden en parameters, buiten bereik en eenheden. */
{
  const nu = Date.parse("2026-11-20T12:00:00Z"), loc = { name: "Utrecht", tz: "Europe/Amsterdam" };
  const alleenNu = antwoord("https://api.open-meteo.com/v1/forecast?latitude=52.09&longitude=5.12&current=temperature_2m&timezone=auto", loc, nu);
  assert(alleenNu.current && !("hourly" in alleenNu) && !("daily" in alleenNu) && !("minutely_15" in alleenNu), "zonder hourly/daily ook geen hourly/daily in het antwoord");
  const leeg = antwoord("https://api.open-meteo.com/v1/forecast?latitude=52.09&longitude=5.12&daily=&hourly=&timezone=auto", loc, nu);
  assert(!("hourly" in leeg) && !("daily" in leeg) && leeg.timezone === "Europe/Amsterdam", "lege variabelenlijst: alleen de kop");
  const standaard = antwoord("https://api.open-meteo.com/v1/forecast?latitude=52.09&longitude=5.12&daily=temperature_2m_max&hourly=temperature_2m&timezone=auto", loc, nu);
  assert.equal(standaard.daily.time.length, 7, "zonder forecast_days: 7 dagen (standaard Open-Meteo)");
  assert.equal(standaard.hourly.time.length, 7 * 24, "zonder forecast_hours: uren tot het einde van de laatste dag");
  for (const [u, reden] of [
    ["https://api.open-meteo.com/v1/forecast?longitude=5.12&current=temperature_2m", "breedtegraad ontbreekt"],
    ["https://api.open-meteo.com/v1/forecast?latitude=52.09&longitude=5.12,4.5&current=temperature_2m", "ongelijk aantal coördinaten"],
    ["https://api.open-meteo.com/v1/forecast?latitude=52.09&longitude=5.12&daily=temperature_2m_max&forecast_days=17", "forecast_days buiten bereik"],
    ["https://api.open-meteo.com/v1/forecast?latitude=52.09&longitude=5.12&hourly=temperature_2m&forecast_hours=-1", "negatief forecast_hours"],
    ["https://api.open-meteo.com/v1/forecast?latitude=52.09&longitude=5.12&current=temperature_2m&timezone=Mars%2FOlympus", "onbekende tijdzone"],
    ["https://api.open-meteo.com/v1/forecast?latitude=52.09&longitude=5.12&daily=uv_index", "uurveld als dagveld"],
    ["https://air-quality-api.open-meteo.com/v1/air-quality?latitude=52.09&longitude=5.12&current=temperature_2m", "onbekend luchtveld"]
  ]) {
    const r = F.openMeteoAntwoord(u, { nu });
    assert(r.status === 400 && r.json.error === true && typeof r.json.reason === "string" && r.json.reason.length > 5, `${reden}: HTTP 400 met reden (${r.status})`);
  }
  assert.equal(F.openMeteoAntwoord("https://api.open-meteo.com/v1/bestaatniet?latitude=1&longitude=2", { nu }).status, 404, "onbekend endpoint: 404");
  assert.throws(() => F.openMeteoAntwoord("https://api.example.com/v1/forecast?latitude=1&longitude=2", { nu }), /geen Open-Meteo-URL/, "andere host wordt niet stil beantwoord");
  const kmh = antwoord("https://api.open-meteo.com/v1/forecast?latitude=52.09&longitude=5.12&current=wind_speed_10m,wind_gusts_10m&timezone=auto", loc, nu);
  const ms = antwoord("https://api.open-meteo.com/v1/forecast?latitude=52.09&longitude=5.12&current=wind_speed_10m,wind_gusts_10m&timezone=auto&wind_speed_unit=ms", loc, nu);
  assert(kmh.current_units.wind_speed_10m === "km/h" && ms.current_units.wind_speed_10m === "m/s" && Math.abs(ms.current.wind_speed_10m - kmh.current.wind_speed_10m / 3.6) <= 0.06, "windeenheid m/s omgerekend en benoemd");
  assert(kmh.current.wind_gusts_10m >= kmh.current.wind_speed_10m, "windstoten nooit lager dan de windsnelheid");
}

/* Meerdere coördinaten, past_days, onbekend veld, determinisme, overige endpoints. */
{
  const nu = Date.parse("2026-12-24T10:00:00Z");
  const m = F.openMeteoAntwoord("https://api.open-meteo.com/v1/forecast?latitude=52.1,51.9&longitude=5.1,4.5&daily=temperature_2m_max,snowfall_sum&hourly=snow_depth&timezone=Europe%2FAmsterdam&forecast_days=3&past_days=1", { nu });
  assert(m.status === 200 && Array.isArray(m.json) && m.json.length === 2, "meerdere coördinaten geven een array");
  assert.deepEqual(m.json[0].daily.time, ["2026-12-23", "2026-12-24", "2026-12-25", "2026-12-26"], "past_days=1 begint gisteren");
  assert.equal(m.json[0].hourly.time.length, 4 * 24, "uurreeks over past_days + forecast_days");
  const fout = F.openMeteoAntwoord("https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2&hourly=bestaatniet", { nu });
  assert(fout.status === 400 && fout.json.error === true && /bestaatniet/.test(fout.json.reason), "onbekend veld: HTTP 400 met reden");
  assert.equal(F.openMeteoAntwoord("https://api.open-meteo.com/v1/forecast?latitude=95&longitude=2&current=temperature_2m", { nu }).status, 400, "ongeldige breedtegraad: HTTP 400");
  assert.equal(JSON.stringify(F.openMeteoAntwoord(url, { nu })), JSON.stringify(F.openMeteoAntwoord(url, { nu })), "deterministisch");
  const lucht = F.openMeteoAntwoord("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=35.68&longitude=139.69&current=european_aqi,us_aqi&hourly=grass_pollen&forecast_days=1&timezone=auto", { nu }).json;
  assert(Number.isFinite(lucht.current.european_aqi) && lucht.hourly.time.length === 24 && lucht.hourly.grass_pollen.every(v => v === null), "luchtkwaliteit: AQI overal, pollen buiten Europa null");
  const ams = F.openMeteoAntwoord("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=52.37&longitude=4.89&hourly=grass_pollen&forecast_days=1&timezone=auto", { nu }).json;
  assert(ams.hourly.grass_pollen.every(Number.isFinite), "luchtkwaliteit: pollen in Europa");
  const zoek = F.openMeteoAntwoord("https://geocoding-api.open-meteo.com/v1/search?name=Tokyo&count=5&language=nl&format=json").json;
  assert(zoek.results && zoek.results[0].country_code === "JP" && zoek.results[0].timezone === "Asia/Tokyo", "geocoding: bekende plaats");
  assert(!("results" in F.openMeteoAntwoord("https://geocoding-api.open-meteo.com/v1/search?name=Xyzzy&count=5").json), "geocoding: onbekende plaats zonder results");
  assert.equal(F.openMeteoAntwoord("https://api.open-meteo.com/v1/elevation?latitude=52.1&longitude=5.1").json.elevation.length, 1, "hoogte: één waarde per coördinaat");
}

/* Dagvelden volgen het vastgestelde Open-Meteo-venster: de tijdstempels 00:00-23:00 van de datum
   (scripts/openmeteo-daggrens-contract.js stelde dat live vast voor precipitation_probability_max;
   de app rekent zelf met de uren 00-24 en gebruikt het dagveld alleen als terugval). */
{
  const nu = Date.parse("2026-11-20T09:00:00Z");
  const b = antwoord("https://api.open-meteo.com/v1/forecast?latitude=52.37&longitude=4.89&hourly=precipitation_probability,precipitation&daily=precipitation_probability_max,precipitation_sum&timezone=auto&forecast_days=7", { name: "Amsterdam", tz: "Europe/Amsterdam" }, nu);
  b.daily.time.forEach((datum, di) => {
    const uren = b.hourly.time.map((t, i) => (t.startsWith(datum) ? i : -1)).filter(i => i >= 0);
    assert.equal(uren.length, 24, `${datum}: 24 tijdstempels 00:00-23:00`);
    assert.equal(b.daily.precipitation_probability_max[di], Math.max(...uren.map(i => b.hourly.precipitation_probability[i])), `${datum}: precipitation_probability_max = maximum over de tijdstempels 00:00-23:00`);
    assert(Math.abs(b.daily.precipitation_sum[di] - uren.reduce((s, i) => s + b.hourly.precipitation[i], 0)) < 0.051, `${datum}: precipitation_sum = som over dezelfde tijdstempels`);
  });
}

/* Contractvergelijking (vergelijkContract): vindt iedere vormwijziging tussen een echt antwoord en de
   fixture. Een echt antwoord met null-waarden is toegestaan; een gewijzigd contract niet. */
{
  const nu = Date.parse("2026-11-20T09:00:00Z"), loc = { name: "Amsterdam", tz: "Europe/Amsterdam" };
  const appUrl = url.replace("latitude=27.7172&longitude=85.324", "latitude=52.37&longitude=4.89");
  const fix = antwoord(appUrl, loc, nu), kopie = () => JSON.parse(JSON.stringify(fix));
  assert.deepEqual(F.vergelijkContract(kopie(), fix), [], "identiek antwoord: geen verschillen");
  const metNull = kopie(); metNull.hourly.uv_index[3] = null; metNull.current.weather_code = null; metNull.daily.sunshine_duration[6] = null;
  assert.deepEqual(F.vergelijkContract(metNull, fix), [], "null-waarden in het echte antwoord zijn toegestaan");
  for (const [naam, wijzig, verwacht] of [
    ["hernoemd uurveld", e => { e.hourly.precip = e.hourly.precipitation; delete e.hourly.precipitation; }, /hourly: variabelen/],
    ["andere eenheid", e => { e.hourly_units.temperature_2m = "°F"; }, /hourly_units\.temperature_2m/],
    ["andere lengte", e => { for (const k of Object.keys(e.hourly)) e.hourly[k].pop(); }, /tijdstappen echt/],
    ["ander begin", e => { e.daily.time[0] = "2026-11-19"; }, /daily: begint echt/],
    ["andere offset", e => { e.utc_offset_seconds = 7200; }, /utc_offset_seconds/],
    ["ander kwartierinterval", e => { e.current.interval = 3600; }, /current\.interval/],
    ["ontbrekend blok", e => { delete e.minutely_15; delete e.minutely_15_units; }, /minutely_15: ontbreekt in het echte antwoord/],
    ["nieuw kopveld", e => { e.model_run = "x"; }, /onbekende velden/],
    ["tekst in plaats van getal", e => { e.hourly.temperature_2m[0] = "12"; }, /hourly\.temperature_2m: waardetypes/],
    ["ander tijdformaat", e => { e.hourly.time = e.hourly.time.map(t => t + ":00"); }, /hourly\.time: onverwachte tijdvorm/],
    ["sprong in de uurreeks", e => { e.hourly.time[10] = e.hourly.time[11]; }, /tijdstap is niet overal/],
    ["meerdere plaatsen tegen één", e => [e, e], /lijst met 2 plaatsen/]
  ]) {
    const e = kopie(), uit = wijzig(e) || e;
    const verschillen = F.vergelijkContract(uit, fix);
    assert(verschillen.some(v => verwacht.test(v)), `contractvergelijking mist: ${naam} (${JSON.stringify(verschillen)})`);
  }
  /* Alleen lokaal of in de monitoring buiten CI: een echt Open-Meteo-antwoord dat daar is opgehaald
     (niet in de repository), met de URL en het moment van ophalen. Geen netwerk in deze test. */
  if (process.env.WIW_ECHTE_OPENMETEO) {
    const echt = JSON.parse(fs.readFileSync(process.env.WIW_ECHTE_OPENMETEO, "utf8"));
    const echtUrl = process.env.WIW_ECHTE_OPENMETEO_URL, echtNu = Date.parse(process.env.WIW_ECHTE_OPENMETEO_NU || "");
    assert(echtUrl && Number.isFinite(echtNu), "WIW_ECHTE_OPENMETEO_URL en WIW_ECHTE_OPENMETEO_NU (ISO-moment van ophalen) zijn nodig");
    const tz = Array.isArray(echt) ? null : echt.timezone;
    const r = F.openMeteoAntwoord(echtUrl, { nu: echtNu, tzVoor: () => tz });
    const verschillen = F.vergelijkContract(echt, r.json);
    assert.deepEqual(verschillen, [], "echt Open-Meteo-antwoord wijkt af van de fixture:\n" + verschillen.join("\n"));
    console.log("Echt Open-Meteo-antwoord en fixture hebben hetzelfde contract.");
  }
}

/* De runners gebruiken de fixture en halen niets live op. */
for (const bestand of ["run-production-pre-sale-acceptance-browser.js", "production-pre-sale-acceptance-browser.js"]) {
  const bron = fs.readFileSync(path.join(__dirname, bestand), "utf8");
  assert(bron.includes('require("./openmeteo-fixture.js")') && bron.includes("openMeteoAntwoord("), `${bestand}: gebruikt de Open-Meteo-fixture niet`);
  assert(!/\bfetch\(/.test(bron), `${bestand}: haalt nog zelf iets live op`);
  assert(!/route\.continue\(\)/.test(bron), `${bestand}: route.continue() laat Open-Meteo-verkeer naar het netwerk`);
}

console.log("Open-Meteo-fixture: velden en lengtes zoals gevraagd, tijdzone (ook +05:45), plaatselijke uren, vaste offset over de klokwissel, poolnacht en 24 uur daglicht, GMT, array bij meerdere plaatsen, HTTP 400 bij een onbekend veld, deterministisch; luchtkwaliteit, geocoding en hoogte; runners zonder live ophaling.");
