"use strict";

/*
 * Zet de taalkeuze in de definitieve buildoutput:
 *   - public/taal-en-<hash>.js: vertaalkern, eenheden, woordenboek en vertaallaag;
 *   - public/taal-<hash>.js: de kleine lader die alleen bij Engels die bundel laadt;
 *   - in iedere HTML-pagina één deferred scripttag vóór de overige externe scripts,
 *     zodat de taal vaststaat voordat de app rendert.
 * Draait na de delivery-cleanup (zoals PostHog), zodat de app-runtime zelf
 * gesloten blijft voor onbekende scripts.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");
const { minify } = require("terser");

const ROOT = path.join(__dirname, "..");
const TAAL = path.join(ROOT, "taal");
const BUNDEL_DELEN = ["vertaalkern.js", "eenheden.js", "en.js", "vertaallaag.js", "start-en.js"];
const TAAL_BESTAND = /^taal-(?:en-)?[0-9a-f]{12}\.js$/;
const LADER_TAG = /<script src="\/taal-[0-9a-f]{12}\.js" defer data-taal-lader><\/script>\n?/g;

function hash12(v) { return crypto.createHash("sha256").update(v).digest("hex").slice(0, 12); }

/* Beheerpagina's (admin/) zijn alleen voor de eigenaar en blijven Nederlands. */
function htmlBestanden(dir, wortel = dir) {
  const uit = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) { if (!(dir === wortel && ent.name === "admin")) uit.push(...htmlBestanden(p, wortel)); }
    else if (ent.isFile() && ent.name.endsWith(".html")) uit.push(p);
  }
  return uit;
}

async function klein(bron, naam) {
  const r = await minify(bron, { ecma: 2019, compress: { passes: 2 }, mangle: true, format: { comments: false } });
  if (!r.code) throw new Error(`Minificatie van ${naam} gaf geen code.`);
  new vm.Script(r.code, { filename: naam });
  return r.code;
}

async function bouwBundels() {
  const bundelBron = BUNDEL_DELEN.map(d => fs.readFileSync(path.join(TAAL, d), "utf8")).join("\n;\n");
  const bundel = await klein(bundelBron, "taal-en");
  const bundelNaam = `taal-en-${hash12(bundel)}.js`;
  const laderBron = fs.readFileSync(path.join(TAAL, "lader.js"), "utf8");
  if ((laderBron.split("__TAAL_EN_BUNDEL__").length - 1) !== 1) throw new Error("Lader mist het bundelanker __TAAL_EN_BUNDEL__.");
  const { schakelaarZichtbaar } = JSON.parse(fs.readFileSync(path.join(TAAL, "instellingen.json"), "utf8"));
  if ((laderBron.split("__TAAL_SCHAKELAAR__").length - 1) !== 1) throw new Error("Lader mist het schakelaaranker __TAAL_SCHAKELAAR__.");
  const lader = await klein(laderBron.replace("__TAAL_EN_BUNDEL__", bundelNaam).replace("__TAAL_SCHAKELAAR__", schakelaarZichtbaar === true ? "ja" : "nee"), "taal-lader");
  const laderNaam = `taal-${hash12(lader)}.js`;
  return { bundel, bundelNaam, lader, laderNaam, schakelaarZichtbaar: schakelaarZichtbaar === true };
}

/* Eén ladertag, direct vóór het eerste externe script; anders vóór </body>. */
function pasHtmlAan(html, laderNaam) {
  const tag = `<script src="/${laderNaam}" defer data-taal-lader></script>`;
  let uit = String(html).replace(LADER_TAG, "");
  const eerste = uit.search(/<script\b[^>]*\bsrc=/i);
  if (eerste >= 0) uit = uit.slice(0, eerste) + tag + "\n" + uit.slice(eerste);
  else if (/<\/body>/i.test(uit)) uit = uit.replace(/<\/body>/i, tag + "\n</body>");
  else throw new Error("Geen plek voor de taallader gevonden.");
  if ((uit.split(tag).length - 1) !== 1) throw new Error("Taallader staat niet precies één keer in de pagina.");
  return uit;
}

async function pasArtifactAan(publicDir = path.join(ROOT, "public")) {
  const { bundel, bundelNaam, lader, laderNaam } = await bouwBundels();
  for (const naam of fs.readdirSync(publicDir)) if (TAAL_BESTAND.test(naam)) fs.rmSync(path.join(publicDir, naam), { force: true });
  fs.writeFileSync(path.join(publicDir, bundelNaam), bundel, "utf8");
  fs.writeFileSync(path.join(publicDir, laderNaam), lader, "utf8");
  const bestanden = htmlBestanden(publicDir);
  for (const bestand of bestanden) {
    const bron = fs.readFileSync(bestand, "utf8");
    const nieuw = pasHtmlAan(bron, laderNaam);
    if (nieuw !== bron) fs.writeFileSync(bestand, nieuw, "utf8");
  }
  return { bestanden: bestanden.length, lader: laderNaam, bundel: bundelNaam, bundelBytes: Buffer.byteLength(bundel), laderBytes: Buffer.byteLength(lader) };
}

if (require.main === module) {
  pasArtifactAan().then(r => console.log(`taal: lader ${r.lader} (${r.laderBytes} B) en bundel ${r.bundel} (${r.bundelBytes} B) in ${r.bestanden} HTML-bestanden.`))
    .catch(e => { console.error(e && e.stack || e); process.exit(1); });
}

module.exports = { BUNDEL_DELEN, TAAL_BESTAND, bouwBundels, pasHtmlAan, pasArtifactAan };
