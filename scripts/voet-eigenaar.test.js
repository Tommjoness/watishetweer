"use strict";

/* Eén eigenaar voor nieuwe voetstijl (eigenaar, 13 oktober). De voetstijl staat
   verspreid over vijftien oudere lagen; nieuwe voetregels horen alleen nog in
   scripts/voet.css (stijlblok wiw-voet). Deze test telt per stijlblok de
   declaraties voor de voet in de gebouwde homepage en weigert:
   - meer voetdeclaraties in een oudere laag dan op 13 oktober (minder mag: dat
     is opschonen);
   - voetregels in een nieuw stijlblok anders dan wiw-voet. */

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const BASIS = {
  "zonder-id-1": 55,
  "zonder-id-3": 5,
  "zonder-id-6": 2,
  "weather-now-desktop-refinement-20260829": 8,
  "weather-final-audit-20260901": 15,
  "mobile-final-polish-style-20260910": 1,
  "wiw-final-ui-polish-20260912": 17,
  "wiw-live-screenshot-polish-20260912": 4,
  "wiw-ui-ux-audit-polish-20260913": 186,
  "wiw-first-screen-20260924": 28,
  "wiw-bediening-20260924": 3,
  "wiw-leesbaarheid-20260924": 2,
  "wiw-onderkant-20260925": 106,
  "wiw-indeling-20260925": 2,
  "wiw-desktop-premium-20260929": 12
};
const EIGENAAR = "wiw-voet";
const VOET = /(^|[\s>+~(,])footer\b|\.footer-|\.bron(?![-\w])|\.bron-|\.bronlabel|\.wiw-weergave-voet/;

function regels(css, uit) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let j = 0;
  while (j < css.length) {
    const open = css.indexOf("{", j);
    if (open < 0) break;
    const kop = css.slice(j, open).trim();
    if (kop.startsWith("@")) {
      let diepte = 1, k = open + 1;
      while (k < css.length && diepte) { if (css[k] === "{") diepte++; else if (css[k] === "}") diepte--; k++; }
      if (/^@(media|supports)/.test(kop)) regels(css.slice(open + 1, k - 1), uit);
      j = k; continue;
    }
    const sluit = css.indexOf("}", open);
    uit.push([kop, css.slice(open + 1, sluit)]);
    j = sluit + 1;
  }
  return uit;
}

function voetTelling(html) {
  const tel = {};
  const re = /<style([^>]*)>([\s\S]*?)<\/style>/g;
  let m, i = 0;
  while ((m = re.exec(html))) {
    i++;
    const naam = (m[1].match(/id="([^"]+)"/) || [])[1] || `zonder-id-${i}`;
    let n = 0;
    for (const [selector, body] of regels(m[2], [])) {
      if (!selector.split(",").some(s => VOET.test(" " + s.trim()))) continue;
      n += body.split(";").filter(d => d.includes(":") && !d.trim().startsWith("--")).length;
    }
    if (n) tel[naam] = n;
  }
  return tel;
}

const bestand = path.join(__dirname, "..", "public", "index.html");
if (!fs.existsSync(bestand)) throw new Error("public/index.html ontbreekt; draai eerst de build.");
const tel = voetTelling(fs.readFileSync(bestand, "utf8"));
const fouten = [];
for (const [blok, n] of Object.entries(tel)) {
  if (blok === EIGENAAR) continue;
  if (!(blok in BASIS)) fouten.push(`${blok}: ${n} voetdeclaraties in een nieuw stijlblok`);
  else if (n > BASIS[blok]) fouten.push(`${blok}: ${n} voetdeclaraties, was ${BASIS[blok]}`);
}
assert.deepEqual(fouten, [], "Nieuwe voetstijl hoort in scripts/voet.css (stijlblok wiw-voet):\n" + fouten.join("\n"));
assert(tel[EIGENAAR] >= 1, "de voetlaag wiw-voet bevat geen voetregels");

const oud = Object.entries(tel).filter(([b]) => b !== EIGENAAR).reduce((s, [, n]) => s + n, 0);
console.log(`Voet heeft één eigenaar: ${tel[EIGENAAR]} declaratie(s) in wiw-voet; oudere lagen samen ${oud} (niet meer dan op 13 oktober).`);
