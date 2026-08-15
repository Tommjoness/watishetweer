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

function foutreden(resultaat) {
  if (!resultaat || resultaat.status !== "rejected") return null;
  return String((resultaat.reason && resultaat.reason.message) || resultaat.reason || "onbekende providerfout");
}

/*
 * KNMI RTCOR blijft de officiële bron voor de actuele nat/droog-vraag.
 *
 * De radar_forecast_2.0 WMS-timeseries wordt bewust niet meer als numerieke
 * punt-nowcast gebruikt. Live diagnose op 15 augustus 2026 liet zien dat zowel
 * GetPointValue als standaard GetFeatureInfo voor ver uit elkaar liggende
 * locaties identieke, fysiek onmogelijke reeksen kunnen teruggeven. De ruwe
 * forecastbestanden zijn lineair gekalibreerd en kunnen die negatieve waarden
 * niet direct bevatten. Zolang de semantiek/ruimtelijke sampling van deze WMS-
 * laag niet betrouwbaar is bewezen, mag die bron geen productwaarheid sturen.
 *
 * De gewone weerresponse bevat al 15-minutenneerslag van Open-Meteo en valt bij
 * afwezigheid daarvan terug op uurdata. Door hier alleen RTCOR te leveren blijft
 * die bestaande modelketen automatisch verantwoordelijk voor de komende uren.
 */
async function haalKnmi({ lat, lon, fetchImpl = fetch, nuMs = Date.now() }) {
  const actueelResultaat = await Promise.allSettled([
    knmi.haalActueelPunt(lat, lon, fetchImpl, nuMs)
  ]).then(([resultaat]) => resultaat);

  const actueel = actueelResultaat.status === "fulfilled" ? actueelResultaat.value : null;
  const actueelFout = foutreden(actueelResultaat);
  if (!actueel) {
    return {
      beschikbaar: false,
      provider: "knmi",
      reden: actueelFout || "KNMI-neerslag niet beschikbaar"
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
    degradaties: {
      nowcast: "KNMI WMS-nowcast uitgeschakeld: numerieke puntreeks is niet betrouwbaar genoeg voor productgebruik"
    },
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
  _intern: { haalKnmi, foutreden }
};