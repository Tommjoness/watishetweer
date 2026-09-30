"use strict";

const knmi = require("./knmi-neerslag.cjs")._intern;

function coord(v) {
  if (v == null || String(v).trim() === "") return NaN;
  return Number(v);
}

function landcode(v) {
  const s = String(v || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : "";
}

/* De client wacht 7,5 s op /api/neerslag. De nowcast krijgt daarom een eigen
   grens daaronder (met ~1 s marge voor netwerk en edge): blijft KNMI hangen,
   dan gaat de actuele RTCOR-waarde toch op tijd mee en vervalt alleen de
   voorspelling. */
const KNMI_NOWCAST_DEADLINE_MS = 6500;

/* Met een eigen KNMI-sleutel (Cloudflare-secret KNMI_WMS_API_KEY) gaat ieder
   verzoek naar het geregistreerde endpoint met de sleutel in de
   Authorization-header; zo heeft de site een eigen quotum in plaats van de
   wereldwijd gedeelde anonieme pot. Zonder sleutel blijft alles anoniem. De
   wrapper wordt per (sleutel, fetch) hergebruikt zodat de metadata-cache per
   fetchImpl blijft werken. */
const KNMI_ANONIEM_BASIS = "https://anonymous.api.dataplatform.knmi.nl/";
const KNMI_SLEUTEL_BASIS = "https://api.dataplatform.knmi.nl/";
const sleutelFetches = new WeakMap();
function knmiFetch(fetchImpl, sleutel) {
  const key = String(sleutel || "").trim();
  if (!key) return fetchImpl;
  let perSleutel = sleutelFetches.get(fetchImpl);
  if (!perSleutel) { perSleutel = new Map(); sleutelFetches.set(fetchImpl, perSleutel); }
  if (!perSleutel.has(key)) {
    perSleutel.set(key, (url, opties = {}) => {
      const doel = String(url).startsWith(KNMI_ANONIEM_BASIS) ? KNMI_SLEUTEL_BASIS + String(url).slice(KNMI_ANONIEM_BASIS.length) : String(url);
      return fetchImpl(doel, { ...opties, headers: { ...(opties.headers || {}), Authorization: key } });
    });
  }
  return perSleutel.get(key);
}

/* Ieder punt binnen hetzelfde KNMI-radarvak krijgt exact dezelfde waarde; het
   midden van dat vak is dus het canonieke punt voor verzoek en edge-cache. */
function knmiCanoniekPunt({ lat, lon }) {
  const vak = knmi.radarVak(lat, lon);
  return vak ? { lat: vak.lat, lon: vak.lon } : { lat, lon };
}

async function haalKnmi({ lat, lon, fetchImpl: basisFetch = fetch, nuMs = Date.now(), nowcastDeadlineMs = KNMI_NOWCAST_DEADLINE_MS, knmiSleutel = "" }) {
  const fetchImpl = knmiFetch(basisFetch, knmiSleutel);
  /* RTCOR en de numerieke WCS-nowcast worden onafhankelijk opgehaald. Alleen
     een volledige, aaneengesloten 25-puntsreeks wordt gepubliceerd; bij een
     haperende WCS blijft de bestaande Open-Meteo-kwartierforecast actief. */
  const punt = knmiCanoniekPunt({ lat, lon });
  const [actueelResultaat,nowcastResultaat]=await Promise.allSettled([
    knmi.haalActueelPunt(punt.lat,punt.lon,fetchImpl,nuMs),
    knmi.haalNowcastPunt(punt.lat,punt.lon,fetchImpl,nuMs,nowcastDeadlineMs)
  ]);
  if(actueelResultaat.status!=="fulfilled"){
    const e=actueelResultaat.reason;
    return {
      beschikbaar: false,
      provider: "knmi",
      reden: String((e && e.message) || e || "KNMI-neerslag niet beschikbaar")
    };
  }
  const actueel=actueelResultaat.value,nowcast=nowcastResultaat.status==="fulfilled"?nowcastResultaat.value:null;
  return {
    beschikbaar: true,
    provider: "knmi",
    bron: "KNMI",
    capabilities: {
      actueel: true,
      nowcast: Boolean(nowcast),
      nowcastMinuten: nowcast?120:0
    },
    actueel,
    nowcast,
    opgehaaldOp: new Date(nuMs).toISOString()
  };
}

const PROVIDERS = Object.freeze([
  Object.freeze({
    id: "knmi",
    landen: Object.freeze(["NL", "BE"]),
    capabilities: Object.freeze({ actueel: true, nowcast: true, nowcastMinuten: 120 }),
    ondersteunt({ lat, lon, land }) {
      return (!land || land === "NL" || land === "BE") && knmi.binnenKnmiDekking(lat, lon);
    },
    canoniekPunt: knmiCanoniekPunt,
    haal: haalKnmi
  })
]);

function kiesProvider({ lat, lon, land }) {
  const y = coord(lat), x = coord(lon), cc = landcode(land);
  if (!Number.isFinite(y) || !Number.isFinite(x)) return null;
  return PROVIDERS.find(p => p.ondersteunt({ lat: y, lon: x, land: cc })) || null;
}

async function haalNeerslagVoorLocatie({ lat, lon, land, fetchImpl = fetch, nuMs = Date.now(), knmiSleutel = "" }) {
  const y = coord(lat), x = coord(lon), cc = landcode(land);
  if (!Number.isFinite(y) || !Number.isFinite(x)) {
    return { beschikbaar: false, provider: null, reden: "ongeldige coördinaten" };
  }

  /* Oude productieclients sturen nog geen landcode mee en vragen deze route
     uitsluitend vanuit de toenmalige Nederlandse clientflow op. Die tijdelijke
     backwards-compatibiliteit blijft staan tijdens de rollout. Nieuwe clients
     sturen altijd de expliciete landcode mee, zodat uitbreiding per land veilig
     en controleerbaar blijft. */
  const provider = kiesProvider({ lat: y, lon: x, land: cc });
  if (!provider) {
    return { beschikbaar: false, provider: null, reden: "geen actuele neerslagprovider voor deze locatie" };
  }

  return provider.haal({ lat: y, lon: x, land: cc, fetchImpl, nuMs, knmiSleutel });
}

/* Canoniek punt voor de edge-cache: alleen een provider die zelf weet dat
   punten dezelfde data delen (KNMI: hetzelfde radarvak), mag coördinaten
   samennemen. Zonder provider blijft het punt ongewijzigd. */
function canoniekNeerslagPunt({ lat, lon, land }) {
  const y = coord(lat), x = coord(lon), cc = landcode(land);
  if (!Number.isFinite(y) || !Number.isFinite(x)) return null;
  const provider = kiesProvider({ lat: y, lon: x, land: cc });
  if (!provider || typeof provider.canoniekPunt !== "function") return { lat: y, lon: x };
  return provider.canoniekPunt({ lat: y, lon: x });
}

function providerCapabilitiesVoorLand(land) {
  const cc = landcode(land);
  return PROVIDERS
    .filter(p => p.landen.includes(cc))
    .map(p => ({ id: p.id, capabilities: { ...p.capabilities } }));
}

module.exports = {
  PROVIDERS,
  coord,
  landcode,
  kiesProvider,
  canoniekNeerslagPunt,
  haalNeerslagVoorLocatie,
  providerCapabilitiesVoorLand,
  _intern: { haalKnmi, knmiCanoniekPunt, knmiFetch, KNMI_NOWCAST_DEADLINE_MS, KNMI_ANONIEM_BASIS, KNMI_SLEUTEL_BASIS }
};
