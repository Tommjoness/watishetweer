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
  const [actueelResultaat, nowcastResultaat] = await Promise.allSettled([
    knmi.haalActueelPunt(lat, lon, fetchImpl, nuMs),
    knmi.haalNowcastPunt(lat, lon, fetchImpl, nuMs)
  ]);

  const actueel = actueelResultaat.status === "fulfilled" ? actueelResultaat.value : null;
  const nowcast = nowcastResultaat.status === "fulfilled" ? nowcastResultaat.value : null;
  if (!actueel && !nowcast) {
    const redenen = [actueelResultaat, nowcastResultaat]
      .filter(x => x.status === "rejected")
      .map(x => String((x.reason && x.reason.message) || x.reason))
      .filter(Boolean);
    return {
      beschikbaar: false,
      provider: "knmi",
      reden: redenen.join("; ") || "KNMI-neerslag niet beschikbaar"
    };
  }

  return {
    beschikbaar: true,
    provider: "knmi",
    bron: "KNMI",
    capabilities: {
      actueel: !!actueel,
      nowcast: !!nowcast,
      nowcastMinuten: nowcast ? Math.round(nowcast.horizonMinuten || 0) : 0
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
