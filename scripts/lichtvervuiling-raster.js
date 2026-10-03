"use strict";
/*
 * Maakt lichtvervuiling-nl.json uit de RIVM-kaart "Berekende hemelhelderheid in de nacht,
 * zonder bewolking" (rivm_licht_20150315_gm_hhnachtonbew.tif, peildatum 15-03-2015).
 * Het bronbestand staat niet in de repository (5,9 MB); download:
 *   https://data.rivm.nl/data/ank/rivm_licht_20150315_gm_hhnachtonbew.zip
 *   (sha256 zip 567989d34aabda45b5d1fbfe26a3ccd7e5dca5ec8dda8a169558f6d9c2f123e0,
 *    tif 301fc6a538cd99adfad17965c7391b5d29d20d65ef8dc61729a2402b8ffae1d8)
 * Gebruik: node scripts/lichtvervuiling-raster.js pad/naar/rivm_licht_20150315_gm_hhnachtonbew.tif
 * Methode en onderbouwing: docs/lichtvervuiling.md.
 */
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const NATUURLIJK = 0.25, GRENS_LAAG = 0.5, GRENS_HOOG = 2;
/* Centraal 80% van (gemeten − kaart) in mag/arcsec² bij 246 Drentse SQM-puntmetingen 2015–2016. */
const RESIDU_P10 = -0.17, RESIDU_P90 = 0.67;
const RASTER = { lat0: 50.70, lon0: 3.30, dlat: 0.01, dlon: 0.015, rijen: 291, kolommen: 264 };

function leesTif(bestand) {
  const buf = fs.readFileSync(bestand);
  if (buf.toString("ascii", 0, 2) !== "II") throw new Error("Alleen little-endian TIFF wordt ondersteund.");
  const u16 = o => buf.readUInt16LE(o), u32 = o => buf.readUInt32LE(o), f64 = o => buf.readDoubleLE(o);
  const ifd = u32(4), n = u16(ifd), tags = {}, grootte = { 1: 1, 2: 1, 3: 2, 4: 4, 12: 8 };
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12, tag = u16(e), type = u16(e + 2), cnt = u32(e + 4);
    const off = (grootte[type] || 1) * cnt <= 4 ? e + 8 : u32(e + 8);
    tags[tag] = Array.from({ length: cnt }, (_, k) => type === 3 ? u16(off + k * 2) : type === 4 ? u32(off + k * 4) : type === 12 ? f64(off + k * 8) : buf[off + k]);
  }
  const W = tags[256][0], H = tags[257][0], TW = tags[322][0], TH = tags[323][0];
  if (tags[259][0] !== 1 || tags[339][0] !== 3 || tags[258][0] !== 32) throw new Error("Verwacht ongecomprimeerde float32-tegels.");
  const x0 = tags[33922][3], y0 = tags[33922][4], dx = tags[33550][0], dy = tags[33550][1];
  const offs = tags[324], perRij = Math.ceil(W / TW);
  return function waarde(x, y) {
    const c = Math.floor((x - x0) / dx), r = Math.floor((y0 - y) / dy);
    if (c < 0 || r < 0 || c >= W || r >= H) return null;
    const t = Math.floor(r / TH) * perRij + Math.floor(c / TW);
    const v = buf.readFloatLE(offs[t] + ((r % TH) * TW + (c % TW)) * 4);
    /* NoData is −3,4028e38; 0 komt alleen op zee voor (buiten het modeldomein). */
    return Number.isFinite(v) && v > 0 ? v : null;
  };
}

/* WGS84 → RD New (benadering Schreutelkamp & Strang van Hees, ~1 m). */
function naarRD(lat, lon) {
  const dF = 0.36 * (lat - 52.15517440), dL = 0.36 * (lon - 5.38720621);
  const R = [[0, 1, 190094.945], [1, 1, -11832.228], [2, 1, -114.221], [0, 3, -32.391], [1, 0, -0.705], [3, 1, -2.340], [1, 3, -0.608], [0, 2, -0.008], [2, 3, 0.148]];
  const S = [[1, 0, 309056.544], [0, 2, 3638.893], [2, 0, 73.077], [1, 2, -157.984], [3, 0, 59.788], [0, 1, 0.433], [2, 2, -6.439], [1, 1, -0.032], [0, 4, 0.092], [1, 4, -0.054]];
  let x = 155000, y = 463000;
  for (const [p, q, r] of R) x += r * dF ** p * dL ** q;
  for (const [p, q, s] of S) y += s * dF ** p * dL ** q;
  return [x, y];
}

const mag = L => -2.5 * Math.log10(L / 1000 / 108000);
const mcd = m => 1000 * 108000 * Math.pow(10, -0.4 * m);
const klasse = L => L <= GRENS_LAAG ? 1 : L <= GRENS_HOOG ? 2 : 3;

/* 0 = geen gegevens, 1 laag, 2 matig, 3 hoog, 4 laag tot matig, 5 matig tot hoog. */
function vakKlasse(waarde, lat, lon) {
  const [x, y] = naarRD(lat, lon), sub = [];
  for (const ox of [-375, -125, 125, 375]) for (const oy of [-375, -125, 125, 375]) { const v = waarde(x + ox, y + oy); if (v !== null) sub.push(v); }
  if (sub.length < 8) return 0;
  const m = mag(sub.reduce((s, v) => s + v, 0) / sub.length + NATUURLIJK);
  const lo = Math.min(klasse(mcd(m + RESIDU_P90)), klasse(Math.min(...sub) + NATUURLIJK));
  const hi = Math.max(klasse(mcd(m + RESIDU_P10)), klasse(Math.max(...sub) + NATUURLIJK));
  if (lo === hi) return lo;
  return lo === 1 && hi === 2 ? 4 : 5;
}

function maak(tif) {
  const waarde = leesTif(tif), { lat0, lon0, dlat, dlon, rijen, kolommen } = RASTER;
  const bytes = new Uint8Array(Math.ceil(rijen * kolommen / 2));
  for (let r = 0; r < rijen; r++) for (let k = 0; k < kolommen; k++) {
    const i = r * kolommen + k, c = vakKlasse(waarde, lat0 + (r + 0.5) * dlat, lon0 + (k + 0.5) * dlon);
    bytes[i >> 1] |= c << ((i & 1) * 4);
  }
  return {
    bron: "RIVM, Berekende hemelhelderheid in de nacht, zonder bewolking (rivm_licht_20150315_gm_hhnachtonbew.tif, peildatum 15-03-2015)",
    bronSha256: crypto.createHash("sha256").update(fs.readFileSync(tif)).digest("hex"),
    licentie: "RIVM open data, Public Domain Mark 1.0",
    peiljaar: 2015,
    methode: {
      natuurlijk: NATUURLIJK, grenzen: [GRENS_LAAG, GRENS_HOOG], eenheid: "mcd/m2",
      onzekerheid: `centraal 80% van (meting − kaart) bij 246 Drentse SQM-puntmetingen 2015–2016: ${RESIDU_P10} tot +${RESIDU_P90} mag/arcsec²; plus spreiding van de 250 m-cellen binnen het vak`,
      vak: "gemiddelde van 4×4 cellen van 250 m rond het vakmidden; minimaal 8 geldige cellen"
    },
    waarden: { 0: "geen gegevens", 1: "laag", 2: "matig", 3: "hoog", 4: "laag tot matig", 5: "matig tot hoog" },
    raster: { ...RASTER, codering: "4 bits per vak, rij voor rij vanaf lat0/lon0; even index in de lage helft van de byte" },
    klassen: Buffer.from(bytes).toString("base64")
  };
}

if (require.main === module) {
  const tif = process.argv[2];
  if (!tif) { console.error("Gebruik: node scripts/lichtvervuiling-raster.js pad/naar/rivm_licht_20150315_gm_hhnachtonbew.tif"); process.exit(1); }
  const doel = path.join(__dirname, "..", "lichtvervuiling-nl.json");
  fs.writeFileSync(doel, JSON.stringify(maak(tif)));
  console.log(`lichtvervuiling-nl.json geschreven (${fs.statSync(doel).size} B).`);
}
module.exports = { maak, vakKlasse, naarRD, RASTER };
