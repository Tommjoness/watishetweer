"use strict";

/* Gedeelde logica voor de gesharde testketen (P3-4, PR B).

   De bestaande keten blijft `npm test`: één lange `&&`-keten van 272 `node`-commando's in package.json. Dit bestand leidt daar een
   fase-indeling uit af, zonder een tweede lijst bij te houden:
     - bouwfase: alle commando's tot en met het laatste commando dat public/ muteert (apply-*, build-weather, platform-output-cleanup, enz.).
       Daarin staan ook de fase-gebonden tests: 8 tests van `test:built` (basisartifact) en de 14 smoke-browsertests en verify-*-scripts die tegen
       een tussentoestand van het artifact draaien en op het definitieve artifact bewezen falen (zie docs/gesharde-testketen.md). Die blijven dus
       in dezelfde volgorde in de bouwfase.
     - shardfase: alle commando's ná het laatste muterende commando. Die draaien al tegen het definitieve artifact en worden verdeeld over shards.
   Niets wordt hier aangepast of overgeslagen: elk van de 272 commando's hoort in precies één fase en wordt per testfamilie precies één keer
   uitgevoerd (verifieer-dekking.js bewijst dat vooraf en achteraf). */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..", "..");
const PUBLIC = path.join(ROOT, "public");
const RUNTIME_BRON = path.join(ROOT, ".weather-runtime-source.tmp");
const DUREN_BESTAND = path.join(__dirname, "test-duren.json");
const AANTAL_SHARDS = 4;
const FAMILIES = Object.freeze(["test", "checkpoint"]);

/* Scripts die public/ schrijven of tijdelijk vervangen. Alles wat apply-*.js heet (behalve .test.js) hoort er ook bij. */
const MUTATOR_BESTANDEN = Object.freeze(new Set([
  "build-weather.js", "inject-extra-neerslagproviders.js", "postbuild-pipeline.js", "desktop-refinement-20260829.js",
  "release-recovery-finalize.js", "platform-output-cleanup.js"
]));

function leesScripts() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).scripts;
}

/* Expandeert een npm-script naar de platte lijst commando's, in dezelfde volgorde als npm ze uitvoert. */
function expandeer(scripts, tekst) {
  const uit = [];
  for (const onderdeel of tekst.split(" && ")) {
    const c = onderdeel.trim();
    const m = /^npm run (\S+)$/.exec(c);
    if (m) {
      if (!Object.prototype.hasOwnProperty.call(scripts, m[1])) throw new Error(`npm-script ${m[1]} bestaat niet`);
      uit.push(...expandeer(scripts, scripts[m[1]]));
    } else uit.push(c);
  }
  return uit;
}

function origineleKeten(scripts = leesScripts()) {
  return expandeer(scripts, scripts.test);
}

function bestandVan(commando) {
  const m = /^node (\S+)/.exec(commando);
  if (!m) throw new Error(`geen eenvoudig node-commando: ${commando}`);
  return m[1];
}

function eenvoudig(commando) {
  return /^node [A-Za-z0-9_./@-]+(?: [A-Za-z0-9_./=:@-]+)*$/.test(commando);
}

function isMutator(commando) {
  const b = path.basename(bestandVan(commando));
  return (/^apply-.*\.js$/.test(b) && !b.endsWith(".test.js")) || MUTATOR_BESTANDEN.has(b);
}

function leesDuren() {
  try { return JSON.parse(fs.readFileSync(DUREN_BESTAND, "utf8")); } catch { return {}; }
}

/* Deterministische LPT-verdeling (zwaarste eerst, steeds naar de minst beladen shard). Gelijke gewichten: op volgorde van index.
   Onbekende commando's krijgen de mediaan van de bekende, zodat een nieuwe test nooit gewicht 0 heeft. */
function verdeel(indexen, commandos, aantal = AANTAL_SHARDS, duren = leesDuren()) {
  const bekend = Object.values(duren).filter(Number.isFinite).sort((a, b) => a - b);
  const mediaan = bekend.length ? bekend[Math.floor(bekend.length / 2)] : 1;
  const gewicht = i => (Number.isFinite(duren[commandos[i]]) ? duren[commandos[i]] : mediaan);
  const volgorde = [...indexen].sort((a, b) => gewicht(b) - gewicht(a) || a - b);
  const shards = Array.from({ length: aantal }, () => ({ indexen: [], gewicht: 0 }));
  for (const i of volgorde) {
    let k = 0;
    for (let j = 1; j < aantal; j++) if (shards[j].gewicht < shards[k].gewicht) k = j;
    shards[k].indexen.push(i);
    shards[k].gewicht += gewicht(i);
  }
  for (const s of shards) s.indexen.sort((a, b) => a - b);
  return shards;
}

/* Het plan: bouwfase (voorvoegsel van de originele keten) en shards (de rest), met alle indexen van de originele keten. */
function plan(scripts = leesScripts(), aantal = AANTAL_SHARDS, duren = leesDuren()) {
  const alle = origineleKeten(scripts);
  const laatste = alle.reduce((m, c, i) => (isMutator(c) ? i : m), -1);
  if (laatste < 0) throw new Error("geen muterend commando gevonden");
  const bouw = alle.map((_, i) => i).filter(i => i <= laatste);
  const shardbaar = alle.map((_, i) => i).filter(i => i > laatste);
  return { alle, laatsteMutator: laatste, bouw, shardbaar, shards: verdeel(shardbaar, alle, aantal, duren) };
}

/* ---------- Artifact: inhoud, checksums, scan op gevoelige gegevens ---------- */

function bestandenIn(map, voorvoegsel, uit = []) {
  if (!fs.existsSync(map)) return uit;
  for (const ent of fs.readdirSync(map, { withFileTypes: true })) {
    const p = path.join(map, ent.name);
    if (ent.isSymbolicLink()) throw new Error(`symlink in artifact niet toegestaan: ${voorvoegsel}${ent.name}`);
    if (ent.isDirectory()) bestandenIn(p, `${voorvoegsel}${ent.name}/`, uit);
    else if (ent.isFile()) uit.push({ rel: `${voorvoegsel}${ent.name}`, abs: p });
  }
  return uit;
}

/* Het artifact bestaat uit precies public/ en .weather-runtime-source.tmp (door release-bundle-consistency gelezen). */
function artifactBestanden(root = ROOT) {
  const lijst = bestandenIn(path.join(root, "public"), "public/");
  const bron = path.join(root, ".weather-runtime-source.tmp");
  if (fs.existsSync(bron)) lijst.push({ rel: ".weather-runtime-source.tmp", abs: bron });
  return lijst.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

function sha256(abs) {
  return crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}

function maakManifest(root = ROOT) {
  const bestanden = {};
  let bytes = 0;
  for (const { rel, abs } of artifactBestanden(root)) {
    bestanden[rel] = sha256(abs);
    bytes += fs.statSync(abs).size;
  }
  const boom = crypto.createHash("sha256");
  for (const rel of Object.keys(bestanden)) boom.update(`${rel}\0${bestanden[rel]}\n`);
  return { versie: 1, aantal: Object.keys(bestanden).length, bytes, boomhash: boom.digest("hex"), bestanden };
}

/* Fail-closed: ieder ontbrekend, extra of afwijkend bestand is een probleem; een leeg artifact ook. */
function verifieerManifest(manifest, root = ROOT) {
  const problemen = [];
  if (!manifest || manifest.versie !== 1 || !manifest.bestanden) return ["manifest ontbreekt of is ongeldig"];
  if (!manifest.aantal) problemen.push("manifest bevat geen bestanden");
  if (!manifest.bestanden["public/index.html"]) problemen.push("public/index.html ontbreekt in het manifest");
  const nu = maakManifest(root);
  for (const rel of Object.keys(manifest.bestanden)) {
    if (!(rel in nu.bestanden)) problemen.push(`ontbreekt: ${rel}`);
    else if (nu.bestanden[rel] !== manifest.bestanden[rel]) problemen.push(`afwijkend: ${rel}`);
  }
  for (const rel of Object.keys(nu.bestanden)) if (!(rel in manifest.bestanden)) problemen.push(`extra: ${rel}`);
  if (!problemen.length && nu.boomhash !== manifest.boomhash) problemen.push("boomhash komt niet overeen");
  return problemen;
}

const VERBODEN_NAMEN = [/(^|\/)\.env(\.|$)/i, /\.pem$/i, /\.p12$/i, /\.pfx$/i, /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i, /(^|\/)\.npmrc$/i, /(^|\/)\.git(\/|$)/, /(^|\/)node_modules(\/|$)/, /\.key$/i];
const GEVOELIGE_INHOUD = [
  ["privésleutel", /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY(?: BLOCK)?-----/],
  ["AWS-toegangssleutel", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub-token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b/],
  ["Slack-token", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ["Google-API-sleutel", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["Stripe-sleutel", /\b[sr]k_live_[0-9A-Za-z]{16,}\b/],
  ["Cloudflare API-token", /\bcf[a-z]{0,3}_[A-Za-z0-9_-]{36,}\b/],
  ["bearer-token", /\bBearer\s+[A-Za-z0-9._~+/-]{30,}={0,2}/],
  ["URL met wachtwoord", /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@"']+:[^\s/@"']{6,}@[^\s/"']+/i],
  ["toegewezen geheim", /\b(?:client[_-]?secret|api[_-]?secret|secret[_-]?key|access[_-]?token|auth[_-]?token|password|passwd)\b["']?\s*[:=]\s*["'][A-Za-z0-9+/_=-]{16,}["']/i]
];

/* Scant op bestandsnamen en inhoud van gevoelige gegevens. Tekstbestanden worden volledig gelezen; binaire bestanden alleen op naam. */
function scanGevoelig(root = ROOT) {
  const treffers = [];
  const TEKST = /\.(?:html?|js|mjs|cjs|css|json|txt|xml|svg|webmanifest|map|tmp|md|csv)$/i;
  for (const { rel, abs } of artifactBestanden(root)) {
    for (const re of VERBODEN_NAMEN) if (re.test(rel)) treffers.push({ bestand: rel, soort: "verboden bestandsnaam" });
    if (!TEKST.test(rel) && rel !== ".weather-runtime-source.tmp") continue;
    const inhoud = fs.readFileSync(abs, "utf8");
    for (const [soort, re] of GEVOELIGE_INHOUD) {
      const m = re.exec(inhoud);
      if (m) treffers.push({ bestand: rel, soort, voorbeeld: m[0].slice(0, 6) + "…" });
    }
  }
  return treffers;
}

/* ---------- Beoordeling van uitvoerresultaten: fail-closed ---------- */

/* resultaten: array van uitvoerrapporten ({familie, rol, shard, van, commandos:[{index,commando,status}]}) van één testfamily.
   Verwacht: precies één bouwrapport en precies shards 1..aantal; alle commando's van de originele keten precies één keer, allemaal status 0. */
function beoordeelFamilie(familie, resultaten, p = plan()) {
  const problemen = [];
  const bouw = resultaten.filter(r => r && r.rol === "bouw");
  const shards = resultaten.filter(r => r && r.rol === "shard");
  const vreemd = resultaten.filter(r => !r || (r.rol !== "bouw" && r.rol !== "shard"));
  if (vreemd.length) problemen.push(`${vreemd.length} onherkenbaar(e) resultaatbestand(en)`);
  for (const r of resultaten) if (r && r.familie !== familie) problemen.push(`rapport met familie ${r.familie} in de familie ${familie}`);
  if (bouw.length !== 1) problemen.push(`${bouw.length} bouwrapporten (verwacht 1)`);
  const aantal = p.shards.length;
  for (let n = 1; n <= aantal; n++) {
    const s = shards.filter(r => r.shard === n);
    if (s.length !== 1) problemen.push(`${s.length} rapporten voor shard ${n} (verwacht 1)`);
    else if (s[0].van !== aantal) problemen.push(`shard ${n} is gemaakt voor ${s[0].van} shards (verwacht ${aantal})`);
  }
  for (const r of shards) if (!(r.shard >= 1 && r.shard <= aantal)) problemen.push(`onverwachte shard ${r.shard}`);
  const geteld = new Map();
  for (const r of [...bouw, ...shards]) {
    if (!Array.isArray(r.commandos)) { problemen.push(`rapport zonder commandolijst (${r.rol} ${r.shard || ""})`); continue; }
    if (r.klaar !== true) problemen.push(`rapport ${r.rol} ${r.shard || ""} is niet afgerond (de job is onderbroken of afgebroken)`);
    for (const c of r.commandos) {
      geteld.set(c.index, (geteld.get(c.index) || 0) + 1);
      if (c.status !== 0) problemen.push(`gefaald (status ${c.status}): #${c.index} ${c.commando}`);
      if (c.commando !== p.alle[c.index]) problemen.push(`commando #${c.index} wijkt af van package.json: ${c.commando}`);
    }
    if (r.rol === "bouw") {
      const verwacht = p.bouw.join(",");
      if (r.commandos.map(c => c.index).join(",") !== verwacht) problemen.push("bouwfase is niet precies de verwachte reeks commando's in de oorspronkelijke volgorde");
    } else if (r.rol === "shard" && r.shard >= 1 && r.shard <= aantal) {
      if (r.commandos.map(c => c.index).join(",") !== p.shards[r.shard - 1].indexen.join(",")) problemen.push(`shard ${r.shard} voerde niet precies de toegewezen commando's uit`);
    }
  }
  for (let i = 0; i < p.alle.length; i++) {
    const n = geteld.get(i) || 0;
    if (n !== 1) problemen.push(`commando #${i} is ${n} keer uitgevoerd (verwacht 1): ${p.alle[i]}`);
  }
  for (const i of geteld.keys()) if (!(i >= 0 && i < p.alle.length)) problemen.push(`onbekend commando-index ${i}`);
  return problemen;
}

/* Aggregatie over jobresultaten van GitHub (needs.<job>.result): alleen "success" telt; skipped, cancelled, failure en ontbrekend zijn rood. */
function beoordeelJobs(jobs) {
  const problemen = [];
  const namen = Object.keys(jobs);
  if (!namen.length) problemen.push("geen jobresultaten ontvangen");
  for (const n of namen) if (jobs[n] !== "success") problemen.push(`job ${n}: ${jobs[n] === undefined || jobs[n] === "" ? "geen resultaat" : jobs[n]} (verwacht success)`);
  return problemen;
}

module.exports = {
  ROOT, PUBLIC, RUNTIME_BRON, AANTAL_SHARDS, FAMILIES, DUREN_BESTAND,
  leesScripts, expandeer, origineleKeten, bestandVan, eenvoudig, isMutator, leesDuren, verdeel, plan,
  artifactBestanden, maakManifest, verifieerManifest, scanGevoelig, beoordeelFamilie, beoordeelJobs
};
