"use strict";

const { haalNeerslagVoorLocatie } = require("./neerslag-provider-registry.cjs");

async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=180");
  const q = req.query || {};
  const resultaat = await haalNeerslagVoorLocatie({
    lat: q.lat,
    lon: q.lon,
    land: q.land
  });
  return res.status(200).json(resultaat);
}

module.exports = handler;
