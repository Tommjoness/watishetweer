/* Synthetische Visual Crossing-data voor poolnacht, pooldag en de Zuidpool, voor de tests van de reserveroute.
   Dit bestand is geen test en bevat geen data van een provider: de vorm (velden, null-patronen, iconen) volgt de
   vastgestelde vorm van een echte Timeline-respons met forecastDataset=gfs_2 voor Longyearbyen op 29 oktober 2026,
   de waarden zijn verzonnen. Een lokale test (WIW_ECHTE_VC_GFS) vergelijkt de veldvorm met de echte respons. */
import { vcPayload, epochVan } from "./klokwissel-fixtures.mjs";

const kopie = o => JSON.parse(JSON.stringify(o));
const NU = epochVan("2026-10-29T07:50:00Z"); // 08:50 lokaal (CET)

/* Longyearbyen, 29 okt 2026, poolnacht: geen zonvelden; iconen met "-day" en zonder achtervoegsel, nooit "-night";
   neerslagkans alleen in de eerste uren (0), daarna null; enkele null-waarden in de eerste uren. */
export function gfsPoolnacht({ dagen = 15, breedte = 78.2232, lengte = 15.6469, timezone = "Arctic/Longyearbyen", metCurrent = true } = {}) {
  const p = vcPayload({ timezone, nuEpochS: NU, startDatum: "2026-10-29", dagen });
  p.latitude = breedte; p.longitude = lengte; p.resolvedAddress = `${breedte},${lengte}`; p.address = p.resolvedAddress;
  p.queryCost = 1; p.tzoffset = 1;
  const suffixloos = ["cloudy", "snow", "fog", "rain"];
  let i = 0;
  for (const dag of p.days) {
    for (const k of ["sunrise", "sunriseEpoch", "sunset", "sunsetEpoch"]) delete dag[k];
    dag.datetimeEpoch = dag.hours[0].datetimeEpoch; dag.feelslike = -9; dag.dew = -8; dag.humidity = 85; dag.conditions = "Overwegend bewolkt"; dag.precipprob = i === 0 ? 0 : null; dag.preciptype = i % 2 ? ["snow"] : null; dag.icon = "snow-showers-day";
    for (const uur of dag.hours) {
      uur.icon = (i % 24) >= 3 && (i % 24) < 15 ? "partly-cloudy-day" : suffixloos[i % 4];
      uur.precipprob = i < 9 ? 0 : null;
      uur.preciptype = i % 5 === 0 ? ["snow"] : null;
      if (i < 2) { uur.precip = null; uur.snow = null; uur.uvindex = null; }
      if (i === 0) { uur.cloudcover = null; uur.windgust = null; }
      uur.conditions = "Bewolkt"; uur.temp = -5 + Math.sin(i / 9);
      i += 1;
    }
  }
  if (metCurrent) { p.currentConditions.conditions = "Licht bewolkt"; p.currentConditions.icon = "partly-cloudy-day"; p.currentConditions.precip = null; p.currentConditions.windgust = null; }
  else delete p.currentConditions;
  return p;
}

/* De standaardaanvraag (blend) voor dezelfde plaats: 8 dagen, maar uren alleen voor de eerste twee dagen (48 uurrecords). */
export function blendPoolnacht48() {
  const p = gfsPoolnacht({ dagen: 8 });
  p.days.forEach((dag, i) => { if (i >= 2) dag.hours = []; });
  return p;
}

/* De Zuidpool zoals gedocumenteerd (13 oktober): alle waarden null. */
export function zuidpoolLeeg() {
  const p = gfsPoolnacht({ dagen: 8, breedte: -90, lengte: 0, timezone: "Antarctica/Troll" });
  const leeg = o => { for (const k of Object.keys(o)) if (typeof o[k] === "number" && !/Epoch|tzoffset|latitude|longitude/.test(k)) o[k] = null; };
  for (const dag of p.days) { leeg(dag); dag.hours.forEach(leeg); }
  leeg(p.currentConditions);
  return p;
}

/* SYNTHETISCH: een volledige, geldige GFS-respons voor de Zuidpool. Bewijst alleen de logica; het is niet
   aangetoond dat Visual Crossing dit levert. */
export function zuidpoolGfsSynthetisch() {
  return gfsPoolnacht({ breedte: -90, lengte: 0, timezone: "Antarctica/Troll" });
}

/* Een gewone locatie (Amsterdam) met zonstijden en iconen met achtervoegsel, 15 dagen zoals een echte aanvraag. */
export function normaleBlend(dagen = 8) {
  return vcPayload({ timezone: "Europe/Amsterdam", nuEpochS: NU, startDatum: "2026-10-29", dagen });
}

export { kopie };
