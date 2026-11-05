"use strict";

/* Eenheidstests voor de gesharde testketen: dekking van de 272 commando's, volgorde, verdeling, het artifact (manifest, wijzigingen, gevoelige
   gegevens) en vooral de fail-closed aggregatie bij ontbrekende, dubbele, onafgeronde, mislukte, overgeslagen of geannuleerde resultaten. */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const T = require("./testketen.js");

let n = 0;
const ok = (c, m) => { assert(c, m); n++; };
const gelijk = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };

/* ---------- Plan ---------- */
const p = T.plan();
gelijk(p.alle.length, 272, "de oorspronkelijke keten telt 272 commando's");
gelijk(new Set(p.alle).size, 272, "alle commando's zijn uniek");
ok(p.alle.every(T.eenvoudig), "alle commando's zijn eenvoudige node-commando's");
const geteld = new Array(272).fill(0);
p.bouw.forEach(i => geteld[i]++);
p.shards.forEach(s => s.indexen.forEach(i => geteld[i]++));
ok(geteld.every(x => x === 1), "elk commando zit in precies één fase of shard");
gelijk(p.bouw, Array.from({ length: p.laatsteMutator + 1 }, (_, i) => i), "de bouwfase is het voorvoegsel van de oorspronkelijke volgorde");
ok(p.shardbaar.every(i => !T.isMutator(p.alle[i])), "geen muterend commando in de shards");
ok(T.isMutator(p.alle[p.laatsteMutator]), "het laatste muterende commando is een mutator");
gelijk(p.shards.length, 4, "vier shards");
ok(p.shards.every(s => s.indexen.length > 0), "geen lege shard");
gelijk(p.bouw.length + p.shardbaar.length, 272, "bouw en shardbaar tellen op tot 272");
ok(p.alle.slice(0, p.laatsteMutator + 1).some(c => /run-prelaunch-isolated/.test(c)), "run-prelaunch-isolated (herstelt public/ tijdelijk) zit in de bouwfase");
for (const c of ["node scripts/platform-output-cleanup.js", "node scripts/apply-voet.js", "node scripts/apply-kleur-20261012.js runtime", "node build-weather.js"]) ok(T.isMutator(c), `${c} is een mutator`);
for (const c of ["node scripts/apply-voet.test.js", "node scripts/verify-final-27.js", "node browser-final-desktop-ui-20260902.test.js"]) ok(!T.isMutator(c), `${c} is geen mutator`);

/* Verdeling: deterministisch, gebalanceerd, elk commando één keer. */
const duren = T.leesDuren();
const v1 = T.verdeel(p.shardbaar, p.alle, 4, duren), v2 = T.verdeel(p.shardbaar, p.alle, 4, duren);
gelijk(v1, v2, "de verdeling is deterministisch");
const gewichten = v1.map(s => s.gewicht), zwaarste = Math.max(...Object.values(duren));
ok(Math.max(...gewichten) - Math.min(...gewichten) <= zwaarste, `shards zijn gebalanceerd (verschil ${Math.max(...gewichten) - Math.min(...gewichten)} s <= zwaarste test ${zwaarste} s)`);
const onbekend = T.verdeel(p.shardbaar, p.alle, 4, {});
ok(onbekend.every(s => s.indexen.length > 0) && onbekend.flatMap(s => s.indexen).length === 68, "zonder duren worden alle 68 commando's toch verdeeld");

/* ---------- Fail-closed beoordeling van uitvoerrapporten ---------- */
const rapport = (familie, rol, shard, indexen, wijzig = {}) => ({
  familie, rol, shard, van: rol === "bouw" ? 1 : 4, klaar: true, seconden: 1, node: "v22", platform: "linux-x64", cpus: 4, begin: "x", eind: "y",
  commandos: indexen.map(i => ({ index: i, commando: p.alle[i], status: 0, seconden: 1 })), ...wijzig
});
const volledig = familie => [rapport(familie, "bouw", undefined, p.bouw), ...p.shards.map((s, k) => rapport(familie, "shard", k + 1, s.indexen))];
gelijk(T.beoordeelFamilie("test", volledig("test"), p), [], "een volledige, geslaagde familie heeft geen problemen");

const mutaties = {
  "ontbrekende shard": r => r.filter(x => x.shard !== 3),
  "ontbrekend bouwrapport": r => r.filter(x => x.rol !== "bouw"),
  "dubbele shard": r => [...r, r[2]],
  "dubbel bouwrapport": r => [...r, r[0]],
  "mislukt commando": r => r.map((x, i) => (i === 2 ? { ...x, commandos: x.commandos.map((c, k) => (k === 0 ? { ...c, status: 1 } : c)) } : x)),
  "onafgeronde shard": r => r.map((x, i) => (i === 1 ? { ...x, klaar: false } : x)),
  "shard mist een commando": r => r.map((x, i) => (i === 4 ? { ...x, commandos: x.commandos.slice(1) } : x)),
  "commando in twee shards": r => r.map((x, i) => (i === 1 ? { ...x, commandos: [...x.commandos, r[2].commandos[0]] } : x)),
  "bouwfase in andere volgorde": r => r.map((x, i) => (i === 0 ? { ...x, commandos: [...x.commandos].reverse() } : x)),
  "bouwfase mist het laatste commando": r => r.map((x, i) => (i === 0 ? { ...x, commandos: x.commandos.slice(0, -1) } : x)),
  "afwijkend commando": r => r.map((x, i) => (i === 3 ? { ...x, commandos: x.commandos.map((c, k) => (k === 0 ? { ...c, commando: "node iets-anders.js" } : c)) } : x)),
  "extra shard 5": r => [...r, rapport("test", "shard", 5, [])],
  "rapport van andere familie": r => [...r, rapport("checkpoint", "shard", 1, p.shards[0].indexen)],
  "onleesbaar rapport": r => [...r, null],
  "rapport zonder commandolijst": r => r.map((x, i) => (i === 2 ? { ...x, commandos: undefined } : x)),
  "shard voor een ander aantal shards": r => r.map((x, i) => (i === 2 ? { ...x, van: 5 } : x)),
  "alles leeg": () => []
};
for (const [naam, f] of Object.entries(mutaties)) ok(T.beoordeelFamilie("test", f(volledig("test")), p).length > 0, `fail-closed: ${naam} wordt afgekeurd`);

/* Jobresultaten van GitHub: alleen success telt. */
gelijk(T.beoordeelJobs({ a: "success", b: "success" }), [], "alle jobs success is groen");
for (const slecht of ["failure", "cancelled", "skipped", "", undefined]) ok(T.beoordeelJobs({ a: "success", b: slecht }).length === 1, `job met resultaat ${JSON.stringify(slecht)} is rood`);
ok(T.beoordeelJobs({}).length === 1, "geen jobresultaten is rood");

/* ---------- Artifact ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wiw-ci-artifact-"));
try {
  fs.mkdirSync(path.join(tmp, "public", "sub"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "public", "index.html"), "<html>ok</html>");
  fs.writeFileSync(path.join(tmp, "public", "sub", "a.js"), "var a=1;");
  fs.writeFileSync(path.join(tmp, ".weather-runtime-source.tmp"), "bron");
  const m = T.maakManifest(tmp);
  gelijk(m.aantal, 3, "manifest telt drie bestanden");
  gelijk(T.verifieerManifest(m, tmp), [], "ongewijzigd artifact klopt met het manifest");
  fs.writeFileSync(path.join(tmp, "public", "sub", "a.js"), "var a=2;");
  ok(T.verifieerManifest(m, tmp).some(x => x.startsWith("afwijkend: public/sub/a.js")), "gewijzigd bestand wordt gezien");
  fs.writeFileSync(path.join(tmp, "public", "sub", "a.js"), "var a=1;");
  fs.writeFileSync(path.join(tmp, "public", "extra.txt"), "x");
  ok(T.verifieerManifest(m, tmp).some(x => x === "extra: public/extra.txt"), "extra bestand wordt gezien");
  fs.unlinkSync(path.join(tmp, "public", "extra.txt"));
  fs.unlinkSync(path.join(tmp, ".weather-runtime-source.tmp"));
  ok(T.verifieerManifest(m, tmp).some(x => x === "ontbreekt: .weather-runtime-source.tmp"), "ontbrekend bestand wordt gezien");
  ok(T.verifieerManifest(null, tmp).length > 0 && T.verifieerManifest({ versie: 1, aantal: 0, bestanden: {} }, tmp).length > 0, "ontbrekend of leeg manifest is rood");
  fs.writeFileSync(path.join(tmp, ".weather-runtime-source.tmp"), "bron");
  gelijk(T.scanGevoelig(tmp), [], "schoon artifact heeft geen gevoelige treffers");
  /* geplante geheimen */
  const gevaar = {
    "public/a1.js": "const k='-----BEGIN RSA PRIVATE KEY-----';",
    "public/a2.js": "var s='AKIAABCDEFGHIJKLMNOP';",
    "public/a3.js": "x='ghp_" + "a".repeat(36) + "';",
    "public/a4.json": '{"client_secret":"' + "q".repeat(24) + '"}',
    "public/a5.html": "<a href='https://gebruiker:wachtwoord123@host.example/pad'>",
    "public/.env": "A=1"
  };
  for (const [f, inh] of Object.entries(gevaar)) fs.writeFileSync(path.join(tmp, f), inh);
  const tr = T.scanGevoelig(tmp);
  for (const f of Object.keys(gevaar)) ok(tr.some(x => x.bestand === f), `gevoelige inhoud/naam in ${f} wordt gevonden`);
  for (const f of Object.keys(gevaar)) fs.unlinkSync(path.join(tmp, f));
  fs.symlinkSync("/etc/hostname", path.join(tmp, "public", "link.txt"));
  assert.throws(() => T.maakManifest(tmp), /symlink/, "symlink in het artifact wordt geweigerd"); n++;
  fs.unlinkSync(path.join(tmp, "public", "link.txt"));
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

/* ---------- Command-line: dekkingsbewijs en aggregatie ---------- */
const cli = (...args) => spawnSync("node", [path.join(__dirname, "verifieer-dekking.js"), ...args], { encoding: "utf8" });
gelijk(cli("plan").status, 0, "verifieer-dekking plan slaagt op de echte keten");
const map = fs.mkdtempSync(path.join(os.tmpdir(), "wiw-ci-res-"));
try {
  const schrijf = (naam, o) => fs.writeFileSync(path.join(map, naam), JSON.stringify(o));
  for (const fam of T.FAMILIES) volledig(fam).forEach((r, i) => schrijf(`${fam}-${i}.json`, r));
  const alleSuccess = JSON.stringify({ "test-bouw": "success", "test-shards": "success", "checkpoint-bouw": "success", "checkpoint-shards": "success" });
  gelijk(cli("resultaten", map, "--jobs", alleSuccess).status, 0, "volledige resultaten met alle jobs success zijn groen");
  gelijk(cli("resultaten", map).status, 0, "zonder --jobs worden alleen de uitvoerresultaten beoordeeld");
  ok(cli("resultaten", map, "--jobs", JSON.stringify({ "test-bouw": "success", "test-shards": "skipped" })).status === 1, "een overgeslagen job is rood");
  ok(cli("resultaten", map, "--jobs", JSON.stringify({ "test-bouw": "cancelled" })).status === 1, "een geannuleerde job is rood");
  ok(cli("resultaten", map, "--jobs", "geen-json").status === 1, "ongeldige jobresultaten zijn rood");
  ok(cli("resultaten", map, "--jobs").status === 1, "ontbrekende jobresultaten zijn rood");
  fs.unlinkSync(path.join(map, "checkpoint-3.json"));
  ok(cli("resultaten", map, "--jobs", alleSuccess).status === 1, "een ontbrekend shardresultaat is rood, ook als alle jobs success meldden");
  fs.writeFileSync(path.join(map, "checkpoint-3.json"), "{kapot");
  ok(cli("resultaten", map, "--jobs", alleSuccess).status === 1, "een onleesbaar resultaatbestand is rood");
  fs.rmSync(map, { recursive: true, force: true });
  fs.mkdirSync(map);
  ok(cli("resultaten", map, "--jobs", alleSuccess).status === 1, "een lege resultatenmap is rood");
  ok(cli("resultaten", path.join(map, "bestaat-niet"), "--jobs", alleSuccess).status === 1, "een niet-bestaande resultatenmap is rood");
} finally { fs.rmSync(map, { recursive: true, force: true }); }

/* ---------- run-fase schoon: schrijfacties buiten de verwachte plekken ---------- */
{
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "wiw-ci-schoon-"));
  try {
    const g = (...a) => spawnSync("git", ["-c", "user.email=a@b.c", "-c", "user.name=x", ...a], { cwd: repo, encoding: "utf8" });
    g("init", "-q"); fs.writeFileSync(path.join(repo, ".gitignore"), "public/\nci-resultaat/\n"); fs.writeFileSync(path.join(repo, "a.txt"), "1");
    g("add", "-A"); g("commit", "-q", "-m", "x");
    const schoon = () => spawnSync("git", ["-c", "safe.directory=*", "status", "--porcelain", "--untracked-files=all"], { cwd: repo, encoding: "utf8" }).stdout.trim();
    fs.mkdirSync(path.join(repo, "public")); fs.writeFileSync(path.join(repo, "public", "x.html"), "g");
    gelijk(schoon(), "", "genegeerde bestanden (public/) tellen niet als schrijfactie");
    fs.writeFileSync(path.join(repo, "a.txt"), "2");
    ok(schoon() !== "", "een gewijzigd gevolgd bestand wordt gezien");
    fs.writeFileSync(path.join(repo, "a.txt"), "1"); fs.writeFileSync(path.join(repo, "nieuw.txt"), "n");
    ok(schoon() !== "", "een nieuw niet-genegeerd bestand wordt gezien");
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
}
const schoonCli = spawnSync("node", [path.join(__dirname, "run-fase.js"), "schoon"], { cwd: path.join(__dirname, "..", ".."), encoding: "utf8" });
ok([0, 1].includes(schoonCli.status), "run-fase schoon draait (0 = schoon, 1 = er staan wijzigingen in de werkmap)");

console.log(`Gesharde testketen: ${n} controles geslaagd (plan van 272 commando's, volgorde, verdeling, artifact, gevoelige gegevens, fail-closed aggregatie).`);
