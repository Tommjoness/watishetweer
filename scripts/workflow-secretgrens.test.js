"use strict";

/* Contracttest voor de secretgrens tussen onbetrouwbare PR-code en credentials (SEC-02).

   Wat deze test bewaakt (statisch, op de tekst van .github/workflows/*.yml):
   1. Geen enkele workflow gebruikt `pull_request_target`.
   2. Workflows die op `pull_request` draaien verwijzen naar geen enkel secret en
      vragen geen schrijfrechten (PR-code mag geen credentials ontvangen).
   3. In workflows die op `workflow_run` draaien (de vertrouwde kant) mogen jobs die
      PR-code uitchecken uitsluitend het Access-servicetoken gebruiken, hebben geen
      schrijfrechten en erven geen secrets via workflow-niveau `env`.
   4. Workflows met Cloudflare-, KNMI- of MeteoAlarm-secrets draaien bij `push`
      uitsluitend voor main.
   5. De vertrouwde deployjob valideert de bundel vóór het uitrollen en gebruikt
      wrangler en wrangler.jsonc uit main (niet uit de bundel).
   6. De bundelvalidatie wijst gemanipuleerde bundels af.

   Beperking, bewust vastgelegd: een gebruiker met schrijfrechten op de repository kan
   altijd een branch pushen en een workflow_dispatch starten; dat sluit alleen een
   GitHub-omgeving met branchbeperking (accountinstelling) af. Zie het runbook. */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { valideerBundel } = require("./ci/preview-bundel-valideer.js");

const root = path.join(__dirname, "..");
const workflowDir = path.join(root, ".github", "workflows");

const HOOGWAARDIGE_SECRETS = /^(CLOUDFLARE_|METEOALARM_|KNMI_)/;
const TOEGESTAAN_VOOR_PR_CODE = new Set(["CF_ACCESS_CLIENT_ID", "CF_ACCESS_CLIENT_SECRET"]);

function ontleed(tekst) {
  const on = /^on:\s*\n((?:[ \t]+.*\n|[ \t]*\n)+)/m.exec(tekst);
  const onBlok = on ? on[1] : "";
  const triggers = new Set([...onBlok.matchAll(/^ {2}([a-z_]+):/gm)].map(m => m[1]));
  const jobsStart = tekst.search(/^jobs:\s*$/m);
  const jobs = {};
  if (jobsStart >= 0) {
    const jobsTekst = tekst.slice(jobsStart).split("\n").slice(1).join("\n");
    const delen = jobsTekst.split(/^ {2}([A-Za-z0-9_-]+):[ \t]*$/m);
    for (let i = 1; i < delen.length; i += 2) jobs[delen[i]] = delen[i + 1];
  }
  const kop = jobsStart >= 0 ? tekst.slice(0, jobsStart) : tekst;
  return { onBlok, triggers, jobs, kop };
}

const secretsIn = tekst => [...new Set([...tekst.matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map(m => m[1]))];

/* Geeft een lijst met schendingen voor één workflowtekst. */
function controleer(naam, tekst) {
  const f = [];
  const { onBlok, triggers, jobs, kop } = ontleed(tekst);
  if (!triggers.size) f.push(`${naam}: geen on:-blok gevonden`);
  if (triggers.has("pull_request_target")) f.push(`${naam}: pull_request_target is niet toegestaan`);

  if (triggers.has("pull_request")) {
    const s = secretsIn(tekst).filter(x => x !== "GITHUB_TOKEN");
    if (s.length) f.push(`${naam}: een pull_request-workflow verwijst naar secrets: ${s.join(", ")}`);
    if (/secrets:\s*inherit/.test(tekst)) f.push(`${naam}: secrets: inherit in een pull_request-workflow`);
    if (/:\s*write\b/.test(tekst)) f.push(`${naam}: een pull_request-workflow vraagt schrijfrechten`);
  }

  if (triggers.has("workflow_run")) {
    if (secretsIn(kop).length) f.push(`${naam}: workflow-niveau env/secrets in een workflow_run-workflow (zou naar alle jobs lekken)`);
    for (const [jobNaam, blok] of Object.entries(jobs)) {
      const checktOnbetrouwbaarUit = /ref:\s*\$\{\{[^}]*(workflow_run\.head_|\benv\.SOURCE_SHA\b)/.test(blok)
        && /actions\/checkout/.test(blok);
      if (!checktOnbetrouwbaarUit) continue;
      const onverwacht = secretsIn(blok).filter(x => x !== "GITHUB_TOKEN" && !TOEGESTAAN_VOOR_PR_CODE.has(x));
      if (onverwacht.length) f.push(`${naam}/${jobNaam}: job met PR-code gebruikt secrets buiten het Access-servicetoken: ${onverwacht.join(", ")}`);
      if (/:\s*write\b/.test(blok)) f.push(`${naam}/${jobNaam}: job met PR-code vraagt schrijfrechten`);
      if (!/persist-credentials:\s*false/.test(blok)) f.push(`${naam}/${jobNaam}: checkout van PR-code zonder persist-credentials: false`);
      if (!/permissions:\s*\n\s+contents:\s*read/.test(blok)) f.push(`${naam}/${jobNaam}: job met PR-code mist expliciet permissions: contents: read`);
    }
  }

  const gebruiktHoogwaardig = secretsIn(tekst).some(x => HOOGWAARDIGE_SECRETS.test(x));
  if (gebruiktHoogwaardig && triggers.has("push")) {
    const push = /^ {2}push:\s*\n((?: {4,}.*\n)+)/m.exec(onBlok);
    const filter = push && /branches:\s*(?:\[([^\]]*)\]|\n((?: {6,}- .*\n?)+))/.exec(push[1]);
    const lijst = filter ? (filter[1] !== undefined ? filter[1] : filter[2]).split(/[\n,]/).map(x => x.replace(/^\s*-\s*/, "").trim()).filter(Boolean) : null;
    if (!lijst || lijst.length !== 1 || lijst[0] !== "main") {
      f.push(`${naam}: push-trigger met Cloudflare/KNMI/MeteoAlarm-secrets moet exact branches: [main] hebben (kreeg: ${lijst ? lijst.join(",") : "geen filter"})`);
    }
  }
  return f;
}

/* ---- 1. de echte workflows voldoen aan het contract ---- */
const bestanden = fs.readdirSync(workflowDir).filter(n => /\.ya?ml$/.test(n));
assert(bestanden.length >= 10, "workflowmap niet gevonden");
{
  const alle = [];
  for (const n of bestanden) alle.push(...controleer(n, fs.readFileSync(path.join(workflowDir, n), "utf8")));
  assert.deepStrictEqual(alle, [], `secretgrens geschonden:\n${alle.join("\n")}`);
}

/* ---- 2. het contract herkent de oorspronkelijke fout (regressieproef) ---- */
{
  const oudePreview = [
    "name: Cloudflare preview",
    "on:",
    "  pull_request:",
    "    branches: [main]",
    "jobs:",
    "  preview:",
    "    runs-on: ubuntu-latest",
    "    env:",
    "      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}",
    "    steps:",
    "      - uses: actions/checkout@v6",
    "      - run: npm run build:cloudflare",
    ""
  ].join("\n");
  const f = controleer("oud-cloudflare-preview.yml", oudePreview);
  assert(f.some(x => /pull_request-workflow verwijst naar secrets: CLOUDFLARE_API_TOKEN/.test(x)), "de oorspronkelijke opzet (secrets in een PR-job) wordt niet afgekeurd");

  const pwn = "name: x\non:\n  pull_request_target:\njobs:\n  a:\n    runs-on: ubuntu-latest\n";
  assert(controleer("pwn.yml", pwn).some(x => /pull_request_target/.test(x)), "pull_request_target wordt niet afgekeurd");

  const wfRunLek = [
    "name: x", "on:", "  workflow_run:", "    workflows: [a]", "env:", "  T: ${{ secrets.CLOUDFLARE_API_TOKEN }}", "jobs:", "  t:", "    runs-on: ubuntu-latest", "    steps:", "      - run: echo", ""
  ].join("\n");
  assert(controleer("lek.yml", wfRunLek).some(x => /workflow-niveau/.test(x)), "workflow-niveau secrets in workflow_run worden niet afgekeurd");

  const wfRunUntrusted = [
    "name: x", "on:", "  workflow_run:", "    workflows: [a]", "jobs:", "  t:", "    runs-on: ubuntu-latest",
    "    permissions:", "      contents: read", "    env:", "      K: ${{ secrets.CLOUDFLARE_API_TOKEN }}",
    "    steps:", "      - uses: actions/checkout@v6", "        with:", "          ref: ${{ github.event.workflow_run.head_sha }}", "          persist-credentials: false", ""
  ].join("\n");
  assert(controleer("untrusted.yml", wfRunUntrusted).some(x => /buiten het Access-servicetoken/.test(x)), "een Cloudflare-secret in een job met PR-code wordt niet afgekeurd");

  const pushOpen = "name: x\non:\n  push:\n    branches:\n      - main\n      - andere\njobs:\n  a:\n    env:\n      K: ${{ secrets.CLOUDFLARE_API_TOKEN }}\n";
  assert(controleer("push.yml", pushOpen).some(x => /branches: \[main\]/.test(x)), "een extra branch in een push-trigger met secrets wordt niet afgekeurd");
}

/* ---- 3. structuur van de vertrouwde deployworkflow ---- */
{
  const deploy = fs.readFileSync(path.join(workflowDir, "cloudflare-preview-deploy.yml"), "utf8");
  const bouw = fs.readFileSync(path.join(workflowDir, "cloudflare-preview.yml"), "utf8");
  const { jobs, triggers } = ontleed(deploy);
  assert(triggers.has("workflow_run"), "deployworkflow moet op workflow_run draaien");
  assert(/workflows:\s*\["Cloudflare preview"\]/.test(deploy), "deployworkflow moet op de PR-build 'Cloudflare preview' wachten");
  assert(/^name: Cloudflare preview$/m.test(bouw), "naam van de PR-build moet overeenkomen met de workflow_run-koppeling");
  assert(/head_repository\.full_name == github\.repository/.test(deploy), "forks horen niet uitgerold te worden");
  assert(/workflow_run\.event == 'pull_request'/.test(deploy) && /workflow_run\.conclusion == 'success'/.test(deploy), "alleen succesvolle pull_request-builds uitrollen");

  const preview = jobs.preview;
  assert(preview, "vertrouwde job 'preview' ontbreekt");
  assert(!/workflow_run\.head_(sha|branch)\s*\}\}\s*\n\s*persist/.test(preview) && !/actions\/checkout[\s\S]{0,200}ref:/.test(preview.split("- name: Installeer dependencies")[0]), "de vertrouwde job mag geen PR-ref uitchecken");
  const volgorde = naam => { const i = preview.indexOf(naam); assert(i >= 0, `stap ontbreekt: ${naam}`); return i; };
  assert(volgorde("scripts/ci/preview-bundel-valideer.js") < volgorde("pages deploy public"), "bundelvalidatie moet vóór de deploy staan");
  assert(volgorde("Download previewbundel") < volgorde("scripts/ci/preview-bundel-valideer.js"), "valideer pas na het downloaden");
  assert(preview.includes('cp "$GITHUB_WORKSPACE/wrangler.jsonc" wrangler.jsonc'), "wrangler.jsonc moet uit main komen");
  assert(preview.includes('node "$GITHUB_WORKSPACE/node_modules/wrangler/bin/wrangler.js" pages deploy public'), "wrangler moet uit het vertrouwde lockfile komen");
  assert(!/npx\s/.test(preview), "geen npx in de vertrouwde job (zou uit de bundel kunnen resolven)");
  assert(/CLOUDFLARE_PREVIEW_BRANCH:\s*pr-\$\{\{\s*github\.event\.workflow_run\.pull_requests\[0\]\.number\s*\}\}/.test(preview), "previewbranch komt uit de gebeurtenis, niet uit de bundel");
  assert(/--branch="\$CLOUDFLARE_PREVIEW_BRANCH"/.test(preview) && !/--branch=main/.test(preview), "previewdeploy gaat nooit naar main");

  for (const j of ["preview-worldwide", "preview-release-navigation", "preview-cwv"]) {
    assert(jobs[j] && /needs:\s*preview/.test(jobs[j]), `${j} moet op de deploy wachten`);
  }
  const status = jobs.status;
  assert(status && /skipped\) state=error/.test(status) && /cancelled\) state=error/.test(status), "een overgeslagen of geannuleerde job mag nooit als geslaagd tellen (REL-01)");
  assert(/statuses:\s*write/.test(status), "alleen de statusjob mag statussen schrijven");
}

/* ---- 4. bundelvalidatie ---- */
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bundel-"));
  const SHA = "a".repeat(40);
  const maak = naam => {
    const dir = path.join(tmp, naam);
    fs.mkdirSync(path.join(dir, "public"), { recursive: true });
    for (const n of ["index.html", "_headers", "_routes.json", "404.html"]) fs.writeFileSync(path.join(dir, "public", n), "x");
    for (const m of ["functions", "api", "lib"]) fs.cpSync(path.join(root, m), path.join(dir, m), { recursive: true });
    fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ pr: 7, sha: SHA }));
    return dir;
  };
  const goed = maak("goed");
  assert.deepStrictEqual(valideerBundel(goed, { pr: 7, sha: SHA }), [], "een gewone bundel (met de echte bronmappen) moet slagen");

  const mislukt = (naam, verander, verwacht, opties = { pr: 7, sha: SHA }) => {
    const dir = maak(naam);
    verander(dir);
    const f = valideerBundel(dir, opties);
    assert(f.some(x => verwacht.test(x)), `${naam}: verwachtte afwijzing ${verwacht}, kreeg ${JSON.stringify(f)}`);
  };
  mislukt("symlink", d => fs.symlinkSync("/etc/passwd", path.join(d, "public", "link")), /symbolische link/);
  mislukt("extra-top", d => fs.writeFileSync(path.join(d, "wrangler.jsonc"), "{}"), /onverwacht item op topniveau/);
  mislukt("verkeerde-sha", d => {}, /sha .* komt niet overeen/, { pr: 7, sha: "b".repeat(40) });
  mislukt("verkeerde-pr", d => {}, /pr 7 komt niet overeen/, { pr: 8, sha: SHA });
  mislukt("meta-extra", d => fs.writeFileSync(path.join(d, "meta.json"), JSON.stringify({ pr: 7, sha: SHA, branch: "main" })), /exact pr en sha/);
  mislukt("geen-index", d => fs.rmSync(path.join(d, "public", "index.html")), /public\/index\.html ontbreekt/);
  mislukt("ts-in-functions", d => fs.writeFileSync(path.join(d, "functions", "x.ts"), "x"), /alleen \.js, \.mjs en \.cjs/);
  mislukt("package-in-lib", d => fs.writeFileSync(path.join(d, "lib", "package.json"), "{}"), /configuratiebestand niet toegestaan/);
  mislukt("node-modules", d => fs.mkdirSync(path.join(d, "api", "node_modules")), /node_modules niet toegestaan/);
  mislukt("verborgen", d => fs.writeFileSync(path.join(d, "public", ".env"), "x"), /verborgen bestand/);
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("workflow-secretgrens: contract en bundelvalidatie geslaagd");
