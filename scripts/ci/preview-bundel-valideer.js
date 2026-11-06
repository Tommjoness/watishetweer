"use strict";

/* Valideert de previewbundel die de secretloze PR-build aflevert (SEC-02).

   De bundel komt uit onbetrouwbare PR-code. De vertrouwde deployworkflow behandelt
   hem daarom uitsluitend als gegevens: eerst deze controle, daarna pas uitrollen.
   Dit script voert niets uit uit de bundel en leest alleen bestandsmetadata en
   meta.json. Het hoort bij de vertrouwde kant (draait vanuit main). */

const fs = require("fs");
const path = require("path");

const TOEGESTANE_TOPNIVEAU = Object.freeze(["api", "functions", "lib", "meta.json", "public"]);
const BRONMAPPEN = Object.freeze(["api", "functions", "lib"]);
const BRON_EXTENSIES = Object.freeze([".js", ".mjs", ".cjs"]);
const VERPLICHT_IN_PUBLIC = Object.freeze(["index.html", "_headers", "_routes.json", "404.html"]);
const MAX_BESTANDEN = 20000;
const MAX_BESTAND_BYTES = 30 * 1024 * 1024;
const MAX_TOTAAL_BYTES = 300 * 1024 * 1024;

function loop(dir, bezoek, relatief = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = relatief ? `${relatief}/${entry.name}` : entry.name;
    bezoek(entry, rel, path.join(dir, entry.name));
    if (entry.isDirectory() && !entry.isSymbolicLink()) loop(path.join(dir, entry.name), bezoek, rel);
  }
}

function valideerBundel(dir, verwacht = {}) {
  const fouten = [];
  const fout = tekst => fouten.push(tekst);

  let topniveau;
  try {
    topniveau = fs.readdirSync(dir);
  } catch {
    return [`bundelmap onleesbaar: ${dir}`];
  }
  for (const naam of topniveau) {
    if (!TOEGESTANE_TOPNIVEAU.includes(naam)) fout(`onverwacht item op topniveau: ${naam}`);
  }
  for (const naam of TOEGESTANE_TOPNIVEAU) {
    if (!topniveau.includes(naam)) fout(`verplicht item ontbreekt: ${naam}`);
  }

  let aantal = 0;
  let totaal = 0;
  loop(dir, (entry, rel, volledig) => {
    aantal += 1;
    if (entry.isSymbolicLink()) { fout(`symbolische link niet toegestaan: ${rel}`); return; }
    if (!entry.isDirectory() && !entry.isFile()) { fout(`alleen gewone bestanden en mappen toegestaan: ${rel}`); return; }
    if (entry.name.startsWith(".")) fout(`verborgen bestand niet toegestaan: ${rel}`);
    if (entry.name === "node_modules") fout(`node_modules niet toegestaan: ${rel}`);
    if (entry.isFile()) {
      const grootte = fs.statSync(volledig).size;
      totaal += grootte;
      if (grootte > MAX_BESTAND_BYTES) fout(`bestand te groot (${grootte} bytes): ${rel}`);
      const [eerste] = rel.split("/");
      if (BRONMAPPEN.includes(eerste)) {
        if (!BRON_EXTENSIES.includes(path.extname(entry.name))) fout(`alleen .js, .mjs en .cjs in ${eerste}/: ${rel}`);
      }
      if (/^(wrangler\.|package(-lock)?\.json$|tsconfig)/i.test(entry.name)) fout(`configuratiebestand niet toegestaan in de bundel: ${rel}`);
    }
  });
  if (aantal > MAX_BESTANDEN) fout(`te veel items (${aantal})`);
  if (totaal > MAX_TOTAAL_BYTES) fout(`bundel te groot (${totaal} bytes)`);

  for (const naam of VERPLICHT_IN_PUBLIC) {
    if (!fs.existsSync(path.join(dir, "public", naam))) fout(`public/${naam} ontbreekt`);
  }

  let meta = null;
  try {
    meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
  } catch {
    fout("meta.json ontbreekt of is geen geldige JSON");
  }
  if (meta) {
    const sleutels = Object.keys(meta).sort().join(",");
    if (sleutels !== "pr,sha") fout(`meta.json moet exact pr en sha bevatten (kreeg: ${sleutels})`);
    if (!Number.isInteger(meta.pr) || meta.pr <= 0) fout("meta.json: pr is geen positief geheel getal");
    if (!/^[0-9a-f]{40}$/.test(String(meta.sha || ""))) fout("meta.json: sha is geen volledige SHA");
    if (verwacht.pr !== undefined && String(meta.pr) !== String(verwacht.pr)) fout(`meta.json: pr ${meta.pr} komt niet overeen met de gebeurtenis (${verwacht.pr})`);
    if (verwacht.sha !== undefined && meta.sha !== verwacht.sha) fout(`meta.json: sha ${meta.sha} komt niet overeen met de gebeurtenis (${verwacht.sha})`);
  }
  return fouten;
}

function main(argv) {
  const dir = argv[0];
  const opt = {};
  for (let i = 1; i < argv.length; i += 2) opt[argv[i].replace(/^--/, "")] = argv[i + 1];
  if (!dir || !opt.sha || !opt.pr) {
    console.error("Gebruik: preview-bundel-valideer.js <map> --sha <40-hex> --pr <nummer>");
    return 2;
  }
  const fouten = valideerBundel(dir, { sha: opt.sha, pr: opt.pr });
  if (fouten.length) {
    console.error("Previewbundel afgewezen:");
    for (const f of fouten) console.error(`- ${f}`);
    return 1;
  }
  console.log(`Previewbundel gevalideerd (PR ${opt.pr}, ${opt.sha.slice(0, 8)}).`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { valideerBundel, TOEGESTANE_TOPNIVEAU, BRONMAPPEN };
