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

async function haalKnmi({ lat, lon, fetchImpl = fetch, nuMs = Date.now() }) {
  /* De actuele RTCOR-puntlaag is live ruimtelijk gecontroleerd en blijft de
     autoritatieve bron voor de actuele nat/droog-vraag. De forecastlaag
     radar_forecast_2.0 wordt hier bewust NIET meer via WMS GetPointValue of
     GetFeatureInfo bevraagd: live vergelijkingen op 15 augustus 2026 leverden
     op ver uit elkaar liggende coördinaten identieke tijdreeksen en wisselende
     nul/non-nulresultaten op. Zolang er geen betrouwbare numerieke extractieroute
     voor die laag is bewezen, blijft de bestaande Open-Meteo kwartierdata de
     korte-termijnverwachting. Fail-closed voorkomt schijnprecisie. */
  let actueel;
  try {
    actueel = await knmi.haalActueelPunt(lat, lon, fetchImpl, nuMs);
  } catch (e) {
    return {
      beschikbaar: false,
      provider: "knmi",
      reden: String((e && e.message) || e || "KNMI-neerslag niet beschikbaar")
    };
  }

  return {
    beschikbaar: true,
    provider: "knmi",
    bron: "KNMI",
    capabilities: {
      actueel: true,
      nowcast: false,
      nowcastMinuten: 0
    },
    actueel,
    nowcast: null,
    opgehaaldOp: new Date(nuMs).toISOString()
  };
}

const PROVIDERS = Object.freeze([
  Object.freeze({
    id: "knmi",
    landen: Object.freeze(["NL", "BE"]),
    capabilities: Object.freeze({ actueel: true, nowcast: false, nowcastMinuten: 0 }),
    ondersteunt({ lat, lon, land }) {
      return (!land || land === "NL" || land === "BE") && knmi.binnenKnmiDekking(lat, lon);
    },
    haal: haalKnmi
  })
]);

function kiesProvider({ lat, lon, land }) {
  const y = coord(lat), x = coord(lon), cc = landcode(land);
  if (!Number.isFinite(y) || !Number.isFinite(x)) return null;
  return PROVIDERS.find(p => p.ondersteunt({ lat: y, lon: x, land: cc })) || null;
}

async function haalNeerslagVoorLocatie({ lat, lon, land, fetchImpl = fetch, nuMs = Date.now() }) {
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

  return provider.haal({ lat: y, lon: x, land: cc, fetchImpl, nuMs });
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
  haalNeerslagVoorLocatie,
  providerCapabilitiesVoorLand,
  _intern: { haalKnmi }
};