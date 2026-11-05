#!/usr/bin/env node
"use strict";

/* Dekkingsbewijs en aggregatie voor de gesharde testketen (P3-4, PR B).
     node scripts/ci/verifieer-dekking.js plan
         Vooraf: de 272 commando's van `npm test` zitten precies één keer in de bouwfase of in precies één shard; de bouwfase is een
         voorvoegsel in de oorspronkelijke volgorde; geen commando ná het laatste muterende commando muteert; alle commando's zijn eenvoudig.
     node scripts/ci/verifieer-dekking.js resultaten <map> [--jobs '{"naam":"success",...}']
         Achteraf: per testfamily (test, checkpoint) precies één bouwrapport en shards 1..4 aanwezig, alle 272 commando's precies één keer
         uitgevoerd, allemaal status 0; en (met --jobs) elke job `success`. Ontbrekende, dubbele, overgeslagen of geannuleerde resultaten zijn rood. */

const fs = require("fs");
const path = require("path");
const T = require("./testketen.js");

function plan() {
  const p = T.plan();
  const problemen = [];
  const alle = p.alle.length;
  const geteld = new Array(alle).fill(0);
  for (const i of p.bouw) geteld[i]++;
  p.shards.forEach(s => s.indexen.forEach(i => geteld[i]++));
  geteld.forEach((n, i) => { if (n !== 1) problemen.push(`commando #${i} zit ${n} keer in het plan: ${p.alle[i]}`); });
  if (p.bouw.join(",") !== Array.from({ length: p.laatsteMutator + 1 }, (_, i) => i).join(",")) problemen.push("de bouwfase is geen aaneengesloten voorvoegsel van de oorspronkelijke volgorde");
  if (p.alle.length !== 272) problemen.push(`verwacht 272 commando's, gevonden ${p.alle.length} (de keten is gewijzigd: werk het plan en de verwachting bewust bij)`);
  for (const i of p.shardbaar) if (T.isMutator(p.alle[i])) problemen.push(`muterend commando in een shard: #${i} ${p.alle[i]}`);
  for (const c of p.alle) if (!T.eenvoudig(c)) problemen.push(`geen eenvoudig node-commando: ${c}`);
  const alleShards = p.shards.flatMap(s => s.indexen);
  if (new Set(alleShards).size !== alleShards.length) problemen.push("een commando staat in meer dan één shard");
  if (p.shards.some(s => !s.indexen.length)) problemen.push("een shard is leeg");
  return { p, problemen };
}

function leesRapporten(map) {
  const uit = [];
  const loop = d => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, ent.name);
      if (ent.isDirectory()) loop(f);
      else if (ent.name.endsWith(".json") && ent.name !== "artifact-manifest.json") {
        try { uit.push(JSON.parse(fs.readFileSync(f, "utf8"))); } catch { uit.push(null); }
      }
    }
  };
  if (fs.existsSync(map)) loop(map);
  return uit;
}

const [, , opdracht, map, vlag, jobsJson] = process.argv;
if (opdracht === "plan") {
  const { p, problemen } = plan();
  if (problemen.length) { for (const x of problemen) console.error(`✗ ${x}`); process.exit(1); }
  const g = p.shards.map(s => `${s.indexen.length} (${Math.round(s.gewicht)} s)`).join(", ");
  console.log(`Plan: ${p.alle.length} commando's = bouwfase ${p.bouw.length} (tot en met #${p.laatsteMutator}, oorspronkelijke volgorde) + ${p.shards.length} shards [${g}]; elk commando precies één keer.`);
} else if (opdracht === "resultaten") {
  const { p, problemen } = plan();
  if (problemen.length) { for (const x of problemen) console.error(`✗ ${x}`); process.exit(1); }
  const rapporten = leesRapporten(path.resolve(map || "ci-resultaat"));
  const uit = [];
  if (rapporten.some(r => r === null)) uit.push("een resultaatbestand is onleesbaar");
  for (const familie of T.FAMILIES) {
    for (const x of T.beoordeelFamilie(familie, rapporten.filter(r => r && r.familie === familie), p)) uit.push(`[${familie}] ${x}`);
  }
  const vreemd = rapporten.filter(r => r && !T.FAMILIES.includes(r.familie));
  if (vreemd.length) uit.push(`${vreemd.length} rapport(en) van een onbekende familie`);
  if (vlag === "--jobs") {
    let jobs = null;
    try { jobs = JSON.parse(jobsJson); } catch { /* fail-closed */ }
    if (!jobs || typeof jobs !== "object") uit.push("de jobresultaten ontbreken of zijn ongeldig");
    else for (const x of T.beoordeelJobs(jobs)) uit.push(x);
  }
  const regels = ["| familie | rol | seconden | commando's | status |", "|---|---|---:|---:|---|"];
  for (const r of rapporten.filter(Boolean).sort((a, b) => `${a.familie}${a.rol}${a.shard || 0}`.localeCompare(`${b.familie}${b.rol}${b.shard || 0}`))) {
    regels.push(`| ${r.familie} | ${r.rol}${r.shard ? " " + r.shard : ""} | ${r.seconden ?? "?"} | ${(r.commandos || []).length} | ${(r.commandos || []).every(c => c.status === 0) && r.klaar ? "ok" : "NIET ok"} |`);
  }
  console.log(regels.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Shadow-testketen: uitvoering\n\n${regels.join("\n")}\n`);
  if (uit.length) {
    console.error(`\n✗ ${uit.length} probleem/problemen:`);
    for (const x of uit.slice(0, 60)) console.error(`  - ${x}`);
    process.exit(1);
  }
  console.log(`\nAlle ${p.alle.length} commando's zijn per familie (${T.FAMILIES.join(", ")}) precies één keer uitgevoerd en geslaagd.`);
} else {
  console.error("gebruik: verifieer-dekking.js plan | resultaten <map> [--jobs '<json>']");
  process.exit(2);
}
