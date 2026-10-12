"use strict";

/* Maakt maan.webp, de maanfoto van /maan/, uit een beeld van NASA's Scientific
   Visualization Studio (Dial-A-Moon, volle maan, 730×730 px; NASA-beeld, vrij
   van auteursrecht). Het bronbestand staat niet in de repository:
     node scripts/maanfoto.js pad/naar/moon.jpg
   De schijf wordt uit het zwart gesneden, zodat hij het beeld precies vult; de
   runtime legt daar de fase, de schaduwgrens en de aardschijn overheen. */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const MAAT = 400;

async function main(bron) {
  if (!bron || !fs.existsSync(bron)) throw new Error("Gebruik: node scripts/maanfoto.js pad/naar/moon.jpg");
  const { data, info } = await sharp(bron).greyscale().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[y * info.width + x] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const zijde = Math.max(x1 - x0, y1 - y0) + 1, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (zijde < info.width * 0.6) throw new Error(`Geen volle maanschijf gevonden (${zijde} px).`);
  const links = Math.round(cx - zijde / 2), boven = Math.round(cy - zijde / 2);
  const doel = path.join(__dirname, "..", "maan.webp");
  await sharp(bron).extract({ left: links, top: boven, width: zijde, height: zijde })
    .resize(MAAT, MAAT, { kernel: "lanczos3" }).webp({ quality: 82, effort: 6 }).toFile(doel);
  console.log(`maan.webp geschreven (${MAAT}×${MAAT}, ${fs.statSync(doel).size} B; schijf ${zijde} px uit ${info.width}×${info.height}).`);
}

main(process.argv[2]).catch(e => { console.error(e.message); process.exit(1); });
