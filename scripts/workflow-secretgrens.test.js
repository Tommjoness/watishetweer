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
   7. Isolatie NA de deploy: PR-code wordt als Pages Functions uitgerold en leest alle bindings van haar omgeving
      (context.env). De vertrouwde deployjob rolt daarom alleen uit naar het afzonderlijke previewproject, bewijst
      daarvoor eerst fail-closed dat dat project geen domeinen, geen bindings en alleen toegestane variabelen heeft,
      kent geen Analytics-/GA4-/Access-admin-/Google-secrets en bewijst na de deploy dat de preview achter Access staat.
   8. De isolatiecontrole zelf wijst elk afwijkend project af (zie sectie 5).

   Beperking, bewust vastgelegd: een gebruiker met schrijfrechten op de repository kan
   altijd een branch pushen en een workflow_dispatch starten; dat sluit alleen een
   GitHub-omgeving met branchbeperking (accountinstelling) af. Zie het runbook. */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { valideerBundel } = require("./ci/preview-bundel-valideer.js");
const { controleerIsolatie, main: isolatieCli, PREVIEW_PRODUCTIEBRANCH, PRODUCTIEPROJECT, PREVIEWPROJECT } = require("./ci/preview-isolatie-controleer.js");
const { controleer: controleerAccess, beoordeel: beoordeelAccess } = require("./ci/preview-access-controleer.js");

const root = path.join(__dirname, "..");
const workflowDir = path.join(root, ".github", "workflows");

const HOOGWAARDIGE_SECRETS = /^(CLOUDFLARE_|METEOALARM_|KNMI_)/;
const TOEGESTAAN_VOOR_PR_CODE = new Set(["CF_ACCESS_PREVIEW_CLIENT_ID", "CF_ACCESS_PREVIEW_CLIENT_SECRET"]);
/* Previewcredentials horen uitsluitend in de previewdeployworkflow; productiecredentials daar nooit. */
const PREVIEWSECRETS = /^(CLOUDFLARE_PREVIEW_|CF_ACCESS_PREVIEW_)/;
const PRODUCTIESECRETS_IN_PREVIEW = /secrets\.(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|CLOUDFLARE_ANALYTICS_API_TOKEN|CLOUDFLARE_ANALYTICS_SETUP_API_TOKEN|CF_ACCESS_CLIENT_ID|CF_ACCESS_CLIENT_SECRET|KNMI_EDR_API_KEY|METEOALARM_API_TOKEN)\b/;

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

  /* Isolatie na deploy (SEC-02, regel 7). */
  const toegestaneSecrets = new Set(["CLOUDFLARE_PREVIEW_API_TOKEN", "CLOUDFLARE_PREVIEW_ACCOUNT_ID", "CF_ACCESS_PREVIEW_CLIENT_ID", "CF_ACCESS_PREVIEW_CLIENT_SECRET"]);
  const alleSecrets = secretsIn(deploy);
  assert.deepStrictEqual(alleSecrets.filter(x => !toegestaneSecrets.has(x)), [], "de previewdeploy mag geen andere secrets kennen dan de previewcredentials (deploytoken, account-id en Access-servicetoken van het previewaccount)");
  const zonderCommentaar = deploy.split("\n").filter(l => !/^\s*#/.test(l)).join("\n");
  for (const verboden of ["ANALYTICS", "GA4", "GOOGLE", "SEO_ADMIN", "CF_ACCESS_AUD", "CF_ACCESS_TEAM_DOMAIN"]) {
    assert(!zonderCommentaar.includes(verboden), `de previewdeploy mag ${verboden} niet kennen: dat hoort niet in het previewproject`);
  }
  assert(!/cloudflare-admin-analytics-runtime/.test(zonderCommentaar), "de previewdeploy mag geen Analytics-bindings naar het previewproject synchroniseren");
  assert(new RegExp(`CLOUDFLARE_PROJECT:\\s*${PREVIEWPROJECT}\\s*$`, "m").test(preview), "de previewdeploy gebruikt uitsluitend het afzonderlijke previewproject");
  assert(!new RegExp(`CLOUDFLARE_PROJECT:\\s*${PRODUCTIEPROJECT}\\s*$`, "m").test(deploy), "PR-code mag nooit naar het productieproject");
  assert(volgorde("scripts/ci/preview-isolatie-controleer.js") < volgorde("pages deploy public"), "de isolatiecontrole moet vóór de deploy staan");
  assert(volgorde("scripts/ci/preview-bundel-valideer.js") < volgorde("scripts/ci/preview-isolatie-controleer.js"), "valideer de bundel vóór de isolatiecontrole en deploy");
  assert(volgorde("Bewijs dat de preview achter Cloudflare Access staat") < volgorde("scripts/cloudflare-functions-readiness.js"), "de Access-controle moet vóór de eerste verzoeken en de tests staan");
  assert(volgorde("Noteer preview-URL") < volgorde("Bewijs dat de preview achter Cloudflare Access staat"), "de Access-controle gebruikt de preview-URL");
  assert(volgorde("scripts/ci/preview-isolatie-controleer.js") < volgorde("scripts/ci/preview-access-controleer.js"), "de Access-controle komt na de isolatiecontrole");
  const naDeploy = preview.indexOf("scripts/ci/preview-isolatie-controleer.js", volgorde("pages deploy public"));
  assert(naDeploy > 0 && naDeploy < volgorde("Noteer preview-URL"), "na de deploy bewijst dezelfde isolatiecontrole dat de PR-deploy geen productiedeployment is");
  assert(!/continue-on-error/.test(preview.slice(preview.lastIndexOf("- name:", naDeploy), volgorde("Noteer preview-URL"))), "die controle na de deploy mag niet genegeerd worden");
  const vooraf = volgorde("Bewijs vooraf dat Cloudflare Access de previewhosts beschermt");
  assert(vooraf < volgorde("pages deploy public"), "Access moet VOOR de deploy van PR-code aantoonbaar actief zijn (fail-closed)");
  assert(volgorde("scripts/ci/preview-isolatie-controleer.js") < vooraf, "isolatiecontrole vóór de Access-controle vooraf");
  const voorafStap = preview.slice(vooraf, volgorde("Deploy preview naar Cloudflare Pages"));
  assert(/preview-access-controleer\.js --project "\$CLOUDFLARE_PROJECT" --branch "\$CLOUDFLARE_PREVIEW_BRANCH"\s*$/m.test(voorafStap), "de controle vooraf gebruikt project en branch van de gebeurtenis, zonder --url");
  assert(!/continue-on-error/.test(voorafStap) && !/\bif:/.test(voorafStap), "de controle vooraf mag niet overgeslagen of genegeerd worden");
  /* Afzonderlijk previewaccount: previewcredentials strikt gescheiden van productiecredentials. */
  assert(!PRODUCTIESECRETS_IN_PREVIEW.test(zonderCommentaar), "de previewdeploy mag geen productiesecrets kennen (afzonderlijk previewaccount)");
  assert(/CLOUDFLARE_API_TOKEN:\s*\$\{\{\s*secrets\.CLOUDFLARE_PREVIEW_API_TOKEN\s*\}\}/.test(preview), "deploytoken moet uit het previewaccount-secret komen");
  assert(/CLOUDFLARE_ACCOUNT_ID:\s*\$\{\{\s*secrets\.CLOUDFLARE_PREVIEW_ACCOUNT_ID\s*\}\}/.test(preview), "account-id moet uit het previewaccount-secret komen");
  assert(/^ {4}environment:\s*pr-preview\s*$/m.test(preview), "de vertrouwde deployjob moet in de beschermde omgeving pr-preview draaien");
  for (const j of ["preview-worldwide", "preview-release-navigation", "preview-cwv", "status"]) {
    assert(!/^\s*environment:/m.test(jobs[j]), `${j} draait PR-code of schrijft statussen en mag niet in de deployomgeving draaien`);
    assert(!/CLOUDFLARE_PREVIEW_/.test(jobs[j]), `${j} mag het Pages-deploytoken van het previewaccount niet kennen`);
  }
  {
    const anderen = bestanden.filter(n => n !== "cloudflare-preview-deploy.yml");
    for (const n of anderen) {
      const t = fs.readFileSync(path.join(workflowDir, n), "utf8");
      assert(!secretsIn(t).some(x => PREVIEWSECRETS.test(x)), `${n} mag geen previewcredentials gebruiken: alleen cloudflare-preview-deploy.yml`);
    }
  }
  const naStap = preview.slice(volgorde("Bewijs dat de preview achter Cloudflare Access staat"), volgorde("Wacht tot Pages Functions actief zijn"));
  assert(/preview-access-controleer\.js .*--url "\$PREVIEW_URL"/.test(naStap) && !/continue-on-error/.test(naStap), "ook na de deploy wordt de werkelijke URL gecontroleerd");
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

/* ---- 5. isolatiecontrole van het previewproject ---- */
{
  const goedProject = () => ({
    success: true,
    result: {
      name: PREVIEWPROJECT,
      subdomain: `${PREVIEWPROJECT}.pages.dev`,
      production_branch: PREVIEW_PRODUCTIEBRANCH,
      source: null,
      canonical_deployment: null,
      deployment_configs: {
        preview: { env_vars: { VISUAL_CROSSING_API_KEY: { type: "secret_text" }, WEATHERAPI_KEY: { type: "secret_text" } }, kv_namespaces: {}, d1_databases: {}, r2_buckets: {}, compatibility_date: "2026-08-26", compatibility_flags: [], fail_open: true, usage_model: "standard", placement: {} },
        production: { env_vars: {}, kv_namespaces: {}, durable_object_namespaces: {}, service_bindings: {}, compatibility_flags: [] }
      }
    }
  });
  const geenDomeinen = { success: true, result: [] };
  const geenProductie = { success: true, result: [] };
  const check = (mut, opties = {}) => {
    const p = goedProject(); if (mut) mut(p);
    return controleerIsolatie({ project: p, domeinen: opties.domeinen || geenDomeinen, productieDeployments: "prod" in opties ? opties.prod : geenProductie, branch: opties.branch !== undefined ? opties.branch : "pr-594", previewProject: opties.previewProject });
  };
  assert.deepStrictEqual(check(), [], "een correct previewproject voldoet");
  assert.deepStrictEqual(check(p => { p.result.deployment_configs.preview.env_vars = {}; }), [], "een previewproject zonder variabelen is toegestaan");

  const faalt = (naam, f, verwacht, opties) => assert(f.some(x => verwacht.test(x)), `${naam}: verwachtte ${verwacht}, kreeg ${JSON.stringify(f)}`);
  faalt("ontbrekend project", controleerIsolatie({ project: { success: false }, domeinen: geenDomeinen, branch: "pr-1" }), /bestaat niet/);
  faalt("productieproject", controleerIsolatie({ project: goedProject(), domeinen: geenDomeinen, previewProject: PRODUCTIEPROJECT, branch: "pr-1" }), /productieproject/);
  faalt("verkeerde naam", check(p => { p.result.name = "iets-anders"; }), /komt niet overeen/);
  faalt("eigen domein", check(null, { domeinen: { success: true, result: [{ name: "watishetweer.nl" }] } }), /eigen domeinen/);
  faalt("domeinen onleesbaar", check(null, { domeinen: { success: false } }), /niet leesbaar/);
  for (const naam of ["CLOUDFLARE_ANALYTICS_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "GA4_PROPERTY_ID", "SEO_ADMIN_EMAILS", "CF_ACCESS_AUD", "CF_ACCESS_TEAM_DOMAIN", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "GSC_SITE_URL"]) {
    faalt(`variabele ${naam} in preview`, check(p => { p.result.deployment_configs.preview.env_vars[naam] = { type: "secret_text" }; }), new RegExp(`preview: variabele ${naam} is niet toegestaan`));
    faalt(`variabele ${naam} in production`, check(p => { p.result.deployment_configs.production.env_vars[naam] = { type: "secret_text" }; }), new RegExp(`production: variabele ${naam} is niet toegestaan`));
  }
  faalt("providersleutel als platte tekst", check(p => { p.result.deployment_configs.preview.env_vars.WEATHERAPI_KEY = { type: "plain_text" }; }), /secret_text/);
  for (const binding of ["kv_namespaces", "d1_databases", "r2_buckets", "durable_object_namespaces", "service_bindings", "ai_bindings", "queue_producers", "hyperdrive_bindings", "onbekende_nieuwe_binding"]) {
    faalt(`binding ${binding}`, check(p => { p.result.deployment_configs.preview[binding] = { MIJN: { id: "x" } }; }), new RegExp(`binding ${binding} is niet toegestaan`));
    faalt(`binding ${binding} (lijst)`, check(p => { p.result.deployment_configs.production[binding] = [{ naam: "x" }]; }), new RegExp(`binding ${binding} is niet toegestaan`));
  }
  /* Subdomein (afzonderlijk previewaccount): exact <project>.pages.dev, anders zijn alle hostnamen onjuist. */
  faalt("subdomein met achtervoegsel", check(p => { p.result.subdomain = "watishetweer-preview-4kx.pages.dev"; }), /subdomein van het previewproject is watishetweer-preview-4kx\.pages\.dev; verwacht watishetweer-preview\.pages\.dev/);
  faalt("ander subdomein", check(p => { p.result.subdomain = "iets-anders.pages.dev"; }), /verwacht watishetweer-preview\.pages\.dev/);
  faalt("subdomein ontbreekt", check(p => { delete p.result.subdomain; }), /subdomein van het previewproject is onbekend/);
  faalt("subdomein is productie", check(p => { p.result.subdomain = "watishetweer.pages.dev"; }), /verwacht watishetweer-preview\.pages\.dev/);
  /* Productiebranch en projectalias (SEC-02): een deploy naar de productiebranch is publiek via <project>.pages.dev. */
  assert.notStrictEqual(PREVIEW_PRODUCTIEBRANCH, "main", "de verplichte productiebranch is niet de standaardwaarde");
  assert(!/^pr-[1-9][0-9]*$/.test(PREVIEW_PRODUCTIEBRANCH), "de verplichte productiebranch kan nooit een PR-branch zijn");
  for (const pb of ["main", "master", "production", "pr-594", "pr-12", "preview", "Main"]) {
    faalt(`productiebranch ${pb}`, check(p => { p.result.production_branch = pb; }, { branch: "pr-12" }), new RegExp(`production_branch ${pb} is niet de verplichte, expliciet ingestelde ${PREVIEW_PRODUCTIEBRANCH}`));
  }
  faalt("productiebranch ontbreekt", check(p => { delete p.result.production_branch; }), /niet leesbaar of niet ingesteld/);
  faalt("productiebranch leeg", check(p => { p.result.production_branch = ""; }), /niet leesbaar of niet ingesteld/);
  faalt("productiebranch geen tekst", check(p => { p.result.production_branch = null; }), /niet leesbaar of niet ingesteld/);
  faalt("gekoppeld aan Git", check(p => { p.result.source = { type: "github", config: { owner: "x", repo_name: "y", production_branch: PREVIEW_PRODUCTIEBRANCH } }; }), /Git-repository/);
  faalt("canonical_deployment bestaat", check(p => { p.result.canonical_deployment = { id: "abc", url: "https://abc.watishetweer-preview.pages.dev" }; }), /canonical_deployment/);
  faalt("productiedeployment in lijst", check(null, { prod: { success: true, result: [{ id: "abc", environment: "production" }] } }), /productiedeployment\(s\)/);
  faalt("productiedeployments onleesbaar", check(null, { prod: { success: false } }), /productiedeployments .* niet leesbaar/);
  faalt("productiedeployments ontbreken in invoer", check(null, { prod: undefined }), /productiedeployments .* niet leesbaar/);
  faalt("productiedeployments geen lijst", check(null, { prod: { success: true, result: null } }), /productiedeployments .* niet leesbaar/);
  assert.deepStrictEqual(check(p => { delete p.result.source; delete p.result.canonical_deployment; }), [], "een net aangemaakt Direct Upload-project zonder deployments, met expliciete productiebranch, voldoet");
  faalt("ontbrekende omgeving", check(p => { delete p.result.deployment_configs.production; }), /ontbreekt/);
  for (const branch of ["main", "release-candidate", "pr-0", "pr-", "pr-5x", "feature", "pr-1; rm -rf", ""]) {
    faalt(`branch ${JSON.stringify(branch)}`, check(null, { branch }), /pr-<nummer>/);
  }
  assert.deepStrictEqual(check(null, { branch: "pr-594" }), [], "pr-<nummer> is een geldige previewbranch");
}

/* ---- 5b. CLI-gedrag, ook voor een net aangemaakt project zonder deployments ---- */
(async () => {
  const env = { CLOUDFLARE_API_TOKEN: "t", CLOUDFLARE_ACCOUNT_ID: "acc", CLOUDFLARE_PROJECT: PREVIEWPROJECT, PREVIEW_BRANCH: "pr-594" };
  const projectJson = over => ({ success: true, result: Object.assign({ name: PREVIEWPROJECT, subdomain: `${PREVIEWPROJECT}.pages.dev`, production_branch: PREVIEW_PRODUCTIEBRANCH, source: null, canonical_deployment: null, latest_deployment: null, deployment_configs: { preview: { env_vars: {}, compatibility_flags: [] }, production: { env_vars: {}, compatibility_flags: [] } } }, over) });
  const haalMet = (project, prodLijst, aangeroepen = []) => async url => {
    aangeroepen.push(String(url));
    const body = /\/deployments\?env=production/.test(url) ? prodLijst : /\/domains$/.test(url) ? { success: true, result: [] } : project;
    return { json: async () => body };
  };
  const stil = async f => { const e = console.error, l = console.log; console.error = console.log = () => {}; try { return await f(); } finally { console.error = e; console.log = l; } };

  const aangeroepen = [];
  assert.strictEqual(await stil(() => isolatieCli(env, haalMet(projectJson(), { success: true, result: [] }, aangeroepen))), 0, "net aangemaakt project (geen deployments, expliciete productiebranch): slaagt");
  assert(aangeroepen.some(u => /\/pages\/projects\/watishetweer-preview\/deployments\?env=production/.test(u)), "de CLI vraagt de productiedeployments expliciet op");
  assert.strictEqual(await stil(() => isolatieCli(env, haalMet(projectJson({ production_branch: "main" }), { success: true, result: [] }))), 1, "standaardproductiebranch main: geblokkeerd");
  assert.strictEqual(await stil(() => isolatieCli(env, haalMet(projectJson(), { success: true, result: [{ id: "x" }] }))), 1, "bestaande productiedeployment: geblokkeerd");
  assert.strictEqual(await stil(() => isolatieCli(env, haalMet(projectJson(), null))), 1, "onleesbaar antwoord over deployments: geblokkeerd (fail-closed)");
  assert.strictEqual(await stil(() => isolatieCli(env, async () => { throw new Error("netwerk"); })), 1, "netwerkfout: geblokkeerd (fail-closed)");
  assert.strictEqual(await stil(() => isolatieCli({ ...env, PREVIEW_BRANCH: "main" }, haalMet(projectJson(), { success: true, result: [] }))), 1, "branch main: geblokkeerd");
  console.log("workflow-secretgrens: productiebranch en projectalias (fail-closed) geslaagd");
})().catch(e => { console.error(e); process.exit(1); });

/* ---- 6. Access vooraf: ontbrekende beveiliging blokkeert de deploy (fail-closed) ---- */
(async () => {
  const toegang = "https://team.cloudflareaccess.com/cdn-cgi/access/login/x?kid=1";
  const antwoord = (status, location) => ({ status, headers: { get: n => (n.toLowerCase() === "location" ? location || null : null) } });
  const stub = regels => async url => {
    const host = new URL(url).hostname;
    const r = regels(host);
    if (r instanceof Error) throw r;
    return r;
  };
  const project = PREVIEWPROJECT;
  const alias = `pr-594.${project}.pages.dev`;
  const isProjectalias = h => h === `${project}.pages.dev`;
  const stil = f => f();
  const run = (regels, extra = {}) => stil(() => controleerAccess({ project, branch: "pr-594", haal: stub(regels), hash: "deadbeef", log: () => {}, ...extra }));
  const blokkeert = (naam, fouten, verwacht) => assert(fouten.length && fouten.some(x => verwacht.test(x)), `${naam}: verwachtte blokkade ${verwacht}, kreeg ${JSON.stringify(fouten)}`);

  assert.deepStrictEqual(await run(h => (isProjectalias(h) ? antwoord(404) : antwoord(302, toegang))), [], "Access actief op alias en hash-host, projectalias zonder inhoud: bewezen");
  assert.deepStrictEqual(await run(h => (isProjectalias(h) ? antwoord(302, toegang) : antwoord(302, toegang))), [], "projectalias achter Access is ook toegestaan");

  /* Regressie: dit is de oude toestand (Access pas na de deploy gecontroleerd). Een project zonder beleid geeft op een
     nog niet bestaande host geen Access-redirect; de workflow moet dan stoppen vóór er iets is uitgerold. */
  blokkeert("geen Access: Pages geeft 404", await run(h => antwoord(404)), /stuurt niet door naar Cloudflare Access \(status 404\)/);
  blokkeert("publiek: 200 op de branchalias", await run(h => (h === alias ? antwoord(200) : antwoord(302, toegang))), new RegExp(`branchalias \\(https://${alias}/\\): stuurt niet door`));
  blokkeert("alleen de hash-host onbeschermd", await run(h => (h === `deadbeef.${project}.pages.dev` ? antwoord(200) : isProjectalias(h) ? antwoord(404) : antwoord(302, toegang))), /deployment-URL \(vorm\)/);
  blokkeert("redirect naar een andere host", await run(h => antwoord(302, "https://evil.example.com/cdn-cgi/access/login")), /stuurt niet door naar Cloudflare Access/);
  blokkeert("nep-Access-host", await run(h => antwoord(302, "https://cloudflareaccess.com.evil.example/")), /stuurt niet door naar Cloudflare Access/);
  blokkeert("redirect zonder Location", await run(h => antwoord(302)), /stuurt niet door naar Cloudflare Access/);
  blokkeert("projectalias toont inhoud", await run(h => (isProjectalias(h) ? antwoord(200) : antwoord(302, toegang))), /projectalias .*toont publiek inhoud/);
  blokkeert("projectalias stuurt elders heen", await run(h => (isProjectalias(h) ? antwoord(301, "https://watishetweer.nl/") : antwoord(302, toegang))), /iets anders dan Cloudflare Access/);
  blokkeert("netwerkfout is geen bewijs", await run(h => new Error("getaddrinfo ENOTFOUND")), /niet te controleren/);
  blokkeert("serverfout is geen bewijs", await run(h => antwoord(503)), /stuurt niet door naar Cloudflare Access \(status 503\)/);

  /* Na de deploy: de werkelijke onveranderlijke URL moet ook beschermd zijn. */
  const url = `https://0a1b2c3d.${project}.pages.dev`;
  assert.deepStrictEqual(await run(h => (isProjectalias(h) ? antwoord(404) : antwoord(302, toegang)), { url }), [], "na de deploy: alle routes beschermd");
  blokkeert("onveranderlijke URL publiek", await run(h => (h === `0a1b2c3d.${project}.pages.dev` ? antwoord(200) : isProjectalias(h) ? antwoord(404) : antwoord(302, toegang)), { url }), /deployment-URL \(https:\/\/0a1b2c3d/);
  blokkeert("URL van een ander project", await run(h => antwoord(302, toegang), { url: "https://abc123.watishetweer.pages.dev" }), /hoort niet bij project/);

  /* Ongeldige invoer wordt geweigerd zonder netwerk. */
  const geenNetwerk = async () => { throw new Error("mag niet worden aangeroepen"); };
  blokkeert("productieproject", await stil(() => controleerAccess({ project: PRODUCTIEPROJECT, branch: "pr-1", haal: geenNetwerk, log: () => {} })), /productieproject/);
  for (const branch of ["main", "pr-0", "pr-1.evil", ""]) blokkeert(`branch ${JSON.stringify(branch)}`, await stil(() => controleerAccess({ project, branch, haal: geenNetwerk, log: () => {} })), /pr-<nummer>/);
  blokkeert("ongeldige projectnaam", await stil(() => controleerAccess({ project: "a.b", branch: "pr-1", haal: geenNetwerk, log: () => {} })), /ongeldige projectnaam/);
  assert.deepStrictEqual(beoordeelAccess([]), [], "geen waarnemingen: geen fouten (aanroeper levert altijd routes)");

  console.log("workflow-secretgrens: Access vooraf (fail-closed) geslaagd");
})().catch(e => { console.error(e); process.exit(1); });

process.stdout.write("workflow-secretgrens: contract, bundelvalidatie en previewisolatie geslaagd\n");
