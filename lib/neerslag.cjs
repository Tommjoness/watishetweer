"use strict";

const { haalNeerslagVoorLocatie } = require("./neerslag-provider-registry.cjs");

async function handler(req, res) {
  const q = req.query || {};
  const resultaat = await haalNeerslagVoorLocatie({
    lat: q.lat,
    lon: q.lon,
    land: q.land
  });
  /* Zonder nowcast (bijvoorbeeld na de nowcast-deadline) blijft de response
     maar kort in de edge-cache, zodat de volledige voorspelling snel terugkomt. */
  const zonderNowcast = resultaat && resultaat.beschikbaar === true && !resultaat.nowcast;
  res.setHeader("Cache-Control", zonderNowcast
    ? "s-maxage=15, stale-while-revalidate=15"
    : "s-maxage=120, stale-while-revalidate=180");
  return res.status(200).json(resultaat);
}

module.exports = handler;
