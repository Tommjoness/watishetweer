"use strict";

/* MeteoAlarm-regiocode (EMMA_ID) naar gebiedsvorm.
   Veel weerdiensten (o.a. KNMI, DWD, AEMET) zetten in hun waarschuwing alleen een
   regiocode en geen polygoon. Met de vormen uit de Metadata-API van MeteoAlarm
   (CC BY 4.0, opgehaald met scripts/meteoalarm-gebieden.js) bepaalt de server of
   een plaats in zo'n regio ligt. Er is hiervoor in productie geen sleutel nodig.

   regioBevat(code, lat, lon):
     true  - de plaats ligt in de regio;
     false - de plaats ligt erbuiten;
     null  - de code is onbekend (dan bewijst hij niets). */
const data = require("./meteoalarm-gebieden-data.cjs");

const perLand = new Map();
function regios(land) {
  if (!perLand.has(land)) {
    let lijst = null;
    const ruw = data.landen && data.landen[land];
    if (ruw) {
      lijst = JSON.parse(ruw);
      for (const g of Object.values(lijst)) {
        let w = 180, z = 90, o = -180, n = -90;
        for (const poly of g.v) for (const [x, y] of poly[0]) {
          if (x < w) w = x; if (x > o) o = x; if (y < z) z = y; if (y > n) n = y;
        }
        g.kader = [w, z, o, n];
      }
    }
    perLand.set(land, lijst);
  }
  return perLand.get(land);
}

function inRing(lon, lat, ring) {
  let binnen = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) binnen = !binnen;
  }
  return binnen;
}

/* Een feed noemt dezelfde regio vaak tientallen keren (per waarschuwing en per
   taal); de uitkomst wordt per punt onthouden. */
let geheugenPunt = "";
const geheugen = new Map();

function regioBevat(code, lat, lon) {
  const c = String(code || "").trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]+$/.test(c) || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const punt = lat + "," + lon;
  if (punt !== geheugenPunt) { geheugenPunt = punt; geheugen.clear(); }
  if (geheugen.has(c)) return geheugen.get(c);
  const lijst = regios(c.slice(0, 2));
  const g = lijst && lijst[c];
  let uit = null;
  if (g) {
    const [w, z, o, n] = g.kader;
    uit = lon >= w && lon <= o && lat >= z && lat <= n
      && g.v.some(poly => inRing(lon, lat, poly[0]) && !poly.slice(1).some(gat => inRing(lon, lat, gat)));
  }
  geheugen.set(c, uit);
  return uit;
}

function regioNaam(code) {
  const c = String(code || "").trim().toUpperCase();
  const lijst = /^[A-Z]{2}/.test(c) ? regios(c.slice(0, 2)) : null;
  return lijst && lijst[c] ? lijst[c].n : null;
}

module.exports = { regioBevat, regioNaam, opgehaald: data.opgehaald, aantal: data.aantal };
