#!/usr/bin/env node
"use strict";

/* Uitvoerder voor de gesharde testketen (P3-4, PR B).
     node scripts/ci/run-fase.js bouw                  alle commando's van `npm test` tot en met het laatste muterende commando, in volgorde
     node scripts/ci/run-fase.js shard <n> <van>       de aan shard n (1..van) toegewezen commando's, één voor één
     node scripts/ci/run-fase.js pak                   manifest (SHA-256 per bestand) + scan op gevoelige gegevens van het artifact
     node scripts/ci/run-fase.js controleer            het artifact in de werkmap tegen het manifest (fail-closed)
   Omgeving: CI_FAMILIE (test|checkpoint) en CI_RESULTAAT_MAP (standaard ci-resultaat). Er draait per runner steeds één commando tegelijk:
   geen parallelle tests binnen een runner (performance-isolatie, zoals bij `npm test`). */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const T = require("./testketen.js");

const FAMILIE = process.env.CI_FAMILIE || "lokaal";
const MAP = path.resolve(T.ROOT, process.env.CI_RESULTAAT_MAP || "ci-resultaat");
const MANIFEST = path.join(MAP, "artifact-manifest.json");

function schrijf(naam, data) {
  fs.mkdirSync(MAP, { recursive: true });
  fs.writeFileSync(path.join(MAP, naam), JSON.stringify(data, null, 1) + "\n");
}

function draai(indexen, p, rapport, bestandsnaam, stopBijFout) {
  let gefaald = 0;
  for (const i of indexen) {
    const commando = p.alle[i];
    if (!T.eenvoudig(commando)) throw new Error(`geen eenvoudig node-commando (index ${i}): ${commando}`);
    console.log(`\n▶ [${i}] ${commando}`);
    const t0 = Date.now();
    const r = spawnSync("sh", ["-c", commando], { cwd: T.ROOT, stdio: "inherit", env: process.env });
    const status = r.status === null ? 1 : r.status;
    rapport.commandos.push({ index: i, commando, status, seconden: Math.round((Date.now() - t0) / 100) / 10 });
    schrijf(bestandsnaam, rapport);
    if (status !== 0) {
      gefaald++;
      console.error(`✗ [${i}] mislukt met status ${status}: ${commando}`);
      if (stopBijFout) break;
    }
  }
  rapport.klaar = true;
  rapport.eind = new Date().toISOString();
  rapport.seconden = Math.round((Date.parse(rapport.eind) - Date.parse(rapport.begin)) / 100) / 10;
  schrijf(bestandsnaam, rapport);
  return gefaald;
}

function nieuwRapport(rol, extra) {
  return { familie: FAMILIE, rol, ...extra, node: process.version, platform: `${os.platform()}-${os.arch()}`, cpus: os.cpus().length, begin: new Date().toISOString(), commandos: [] };
}

const [, , opdracht, a1, a2] = process.argv;
const p = T.plan();

if (opdracht === "bouw") {
  /* Net als `npm test` stoppen we bij de eerste mislukking: de latere stappen bouwen voort op de eerdere. */
  const rapport = nieuwRapport("bouw", { van: 1 });
  const gefaald = draai(p.bouw, p, rapport, `${FAMILIE}-bouw.json`, true);
  process.exit(gefaald ? 1 : 0);
} else if (opdracht === "shard") {
  const n = Number(a1), van = Number(a2);
  if (!(Number.isInteger(n) && Number.isInteger(van) && van === p.shards.length && n >= 1 && n <= van)) {
    console.error(`ongeldige shard ${a1}/${a2}; het plan kent ${p.shards.length} shards`);
    process.exit(2);
  }
  /* Een shard draait al zijn tests en rapporteert alle mislukkingen (meer diagnose); de job faalt als er één mislukt. */
  const rapport = nieuwRapport("shard", { shard: n, van });
  const gefaald = draai(p.shards[n - 1].indexen, p, rapport, `${FAMILIE}-shard-${n}.json`, false);
  process.exit(gefaald ? 1 : 0);
} else if (opdracht === "pak") {
  const treffers = T.scanGevoelig();
  if (treffers.length) {
    console.error("Gevoelige gegevens of verboden bestanden in het artifact; het wordt niet gepubliceerd:");
    for (const t of treffers) console.error(`  ${t.bestand}: ${t.soort}${t.voorbeeld ? ` (${t.voorbeeld})` : ""}`);
    process.exit(1);
  }
  const manifest = T.maakManifest();
  if (!manifest.aantal || !manifest.bestanden["public/index.html"]) {
    console.error("Het artifact is leeg of mist public/index.html.");
    process.exit(1);
  }
  schrijf("artifact-manifest.json", manifest);
  console.log(`Artifact: ${manifest.aantal} bestanden, ${(manifest.bytes / 1e6).toFixed(1)} MB, boomhash ${manifest.boomhash.slice(0, 16)}; geen gevoelige gegevens gevonden.`);
} else if (opdracht === "controleer") {
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); } catch { /* fail-closed hieronder */ }
  const problemen = T.verifieerManifest(manifest);
  const treffers = problemen.length ? [] : T.scanGevoelig();
  if (problemen.length || treffers.length) {
    for (const x of problemen.slice(0, 30)) console.error(`✗ ${x}`);
    for (const t of treffers) console.error(`✗ ${t.bestand}: ${t.soort}`);
    console.error(`Het gedownloade artifact komt niet overeen met het gebouwde artifact (${problemen.length} afwijking(en), ${treffers.length} gevoelige treffer(s)).`);
    process.exit(1);
  }
  console.log(`Artifact gecontroleerd: ${manifest.aantal} bestanden, boomhash ${manifest.boomhash.slice(0, 16)} gelijk aan de bouwjob.`);
} else {
  console.error("gebruik: run-fase.js bouw | shard <n> <van> | pak | controleer");
  process.exit(2);
}
