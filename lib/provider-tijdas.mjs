/* Tijdas van een weerantwoord voor de reserveroutes.

   De site rekent met één vaste afwijking per antwoord (utc_offset_seconds), ook
   over een klokwissel heen, zoals Open-Meteo dat doet: een tijdtekst plus die
   afwijking is het echte moment, en pas bij het tonen gaat dat moment via de
   IANA-zone naar de lokale tijd van de plaats (interpretatie-engine.js,
   providerNaarMinuten en minutenNaarLokaal). Visual Crossing en WeatherAPI geven
   lokale kloktijden. Die tijden mogen niet met een vaste afwijking worden
   gecombineerd zodra het venster een klokwissel bevat: ze lopen dan een uur
   achter of voor, en het dubbele klokuur van de najaarsovergang valt samen.
   Daarom gaat ieder bronmoment (epoch) via de gekozen afwijking naar zijn
   tekst, en de afwijking is de echte afwijking van de plaats op het moment van
   opvragen.

   Alles hier is puur: dezelfde invoer geeft dezelfde uitvoer, zonder Date.now. */

const delenFormatters = new Map();

function delenFormatter(timezone) {
  let formatter = delenFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
    delenFormatters.set(timezone, formatter);
  }
  return formatter;
}

function geheelGetal(waarde) {
  if (waarde === null || waarde === undefined || waarde === "") return null;
  const n = Number(waarde);
  return Number.isFinite(n) ? n : null;
}

/* De kloktijd van een moment in de zone, als "als-UTC"-milliseconden. */
function lokaalAlsUtcMs(epochS, timezone) {
  const epoch = geheelGetal(epochS);
  if (epoch === null || !timezone) return null;
  try {
    const delen = Object.fromEntries(delenFormatter(timezone).formatToParts(new Date(Math.floor(epoch) * 1000))
      .filter(deel => deel.type !== "literal").map(deel => [deel.type, Number(deel.value)]));
    if (![delen.year, delen.month, delen.day, delen.hour, delen.minute, delen.second].every(Number.isFinite)) return null;
    return Date.UTC(delen.year, delen.month - 1, delen.day, delen.hour % 24, delen.minute, delen.second);
  } catch {
    return null;
  }
}

/* De werkelijke UTC-afwijking van de zone op dat moment, in seconden. */
export function offsetOpMoment(epochS, timezone) {
  const lokaal = lokaalAlsUtcMs(epochS, timezone);
  if (lokaal === null) return null;
  return Math.round((lokaal - Math.floor(Number(epochS)) * 1000) / 1000);
}

/* Tijdtekst "YYYY-MM-DDTHH:MM" van een moment in de tijdas met vaste afwijking. */
export function providerTijd(epochS, offsetS) {
  const epoch = geheelGetal(epochS), offset = geheelGetal(offsetS);
  if (epoch === null || offset === null) return null;
  return new Date((epoch + offset) * 1000).toISOString().slice(0, 16);
}

/* Echte lokale kloktijd "YYYY-MM-DDTHH:MM" van een moment. */
export function lokaleKlokTekst(epochS, timezone) {
  const lokaal = lokaalAlsUtcMs(epochS, timezone);
  return lokaal === null ? null : new Date(lokaal).toISOString().slice(0, 16);
}

/* Moment (epoch in seconden) van een lokale kloktijd. Bij een dubbel klokuur het
   eerste moment; een kloktijd die niet bestaat (de uren die de voorjaarsovergang
   overslaat) geeft null. */
export function epochUitLokaleTijd(datum, tijd, timezone) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(datum || "").trim());
  const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(tijd || "").trim());
  if (!m || !t || !timezone) return null;
  const alsUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2], +(t[3] || 0)) / 1000;
  const kandidaten = new Set();
  for (const verschuiving of [-86400, 86400]) {
    const offset = offsetOpMoment(alsUtc + verschuiving, timezone);
    if (offset !== null) kandidaten.add(offset);
  }
  const geldig = [...kandidaten].map(offset => alsUtc - offset).filter(epoch => lokaalAlsUtcMs(epoch, timezone) === alsUtc * 1000);
  return geldig.length ? Math.min(...geldig) : null;
}
