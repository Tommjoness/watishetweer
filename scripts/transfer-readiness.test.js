"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const lees=bestand=>fs.readFileSync(path.join(root,bestand),"utf8");
const readme=lees("README.md");
const runbook=lees("docs/overdracht-runbook.md");
const audit=lees("docs/sale-readiness-audit-2026-08-31.md");
const baseline=lees("docs/commerciele-baseline-2026-08-31.md");
const preview=lees(".github/workflows/cloudflare-preview.yml");
const analyticsWorkflow=lees(".github/workflows/cloudflare-web-analytics.yml");
const production=lees(".github/workflows/cloudflare-production.yml");
const packageJson=JSON.parse(lees("package.json"));

assert(readme.includes("docs/overdracht-runbook.md"),"README moet naar het overdrachtsrunbook verwijzen");
for(const onderdeel of [
  "## Product en eigendom",
  "## Architectuur",
  "## Databronnen en afhankelijkheden",
  "## Configuratie en secrets",
  "## Ontwikkelen, testen en deployen",
  "## Monitoring en alarmen",
  "## Kosten en limieten",
  "## Incident en herstel",
  "## Hoe wijzig ik X?",
  "## Overdrachtschecklist"
])assert(runbook.includes(onderdeel),`overdrachtsrunbook mist ${onderdeel}`);

for(const naam of ["CLOUDFLARE_API_TOKEN","CLOUDFLARE_ACCOUNT_ID","NOMINATIM_BASE_URL"]){
  assert(runbook.includes(`\`${naam}\``),`overdrachtsrunbook mist configuratienaam ${naam}`);
}
assert(!/Authorization:\s*Bearer\s+[^<\s`]+/i.test(runbook),"overdrachtsrunbook mag geen Bearer-token bevatten");
assert(audit.includes("98 | 100 | 100 | 100 | 2/2"),"auditrapport mist de vastgelegde mobiele PageSpeed-score");
assert(audit.includes("100 | 100 | 100 | 100 | 2/2"),"auditrapport mist de vastgelegde desktop PageSpeed-score");

assert(!preview.includes("migrate/cloudflare-pages-20260826"),"previewworkflow mag niet meer aan de oude migratiebranch vastzitten");
assert(!preview.includes("pr-164"),"previewworkflow mag geen oude PR-preview hardcoden");
assert(preview.includes("CLOUDFLARE_PREVIEW_BRANCH: pr-${{ github.event.pull_request.number || github.run_id }}"),"previewworkflow moet per PR of handmatige run een eigen branch gebruiken");
assert(preview.includes("cancel-in-progress: true"),"verouderde previewruns moeten worden geannuleerd");
assert(preview.includes("node scripts/production-worldwide-browser.js"),"preview moet de wereldwijde browsercontrole behouden");

/* Analytics is een aparte, idempotente accountmutatie. De normale productieflow
   mag die instelling niet bij iedere deploy terug uitzetten of opnieuw schrijven. */
assert(runbook.includes(".github/workflows/cloudflare-web-analytics.yml"),"runbook mist de aparte Web Analytics-workflow");
assert(runbook.includes("scripts/cloudflare-web-analytics-setup.js"),"runbook mist het idempotente Web Analytics-setupscript");
assert(runbook.includes("Account Settings Read/Write"),"runbook mist de minimale aanvullende Cloudflare analyticsrechten");
assert(runbook.includes("docs/commerciele-baseline-2026-08-31.md"),"runbook mist de commerciële baseline");
assert(analyticsWorkflow.includes("node scripts/cloudflare-web-analytics-setup.js"),"analyticsworkflow voert setupscript niet uit");
assert(analyticsWorkflow.includes("Wacht tot dezelfde SHA publiek live staat"),"analyticsworkflow mag accountconfig niet voor de bijbehorende productie activeren");
assert(!production.includes("cloudflare-disable-web-analytics.js"),"productiedeploy mag Web Analytics niet meer terug uitzetten");
assert(!production.includes("cloudflare-disable-rum.js"),"productiedeploy mag geen algemene RUM-blokkade meer instellen");
assert(packageJson.scripts["test:prebuild"].includes("cloudflare-web-analytics-setup.test.js"),"prebuild mist analytics-setupregressietest");
assert(packageJson.scripts.postbuild.includes("apply-cloudflare-web-analytics-csp.js"),"postbuild mist analytics-CSP-artifactstap");

for(const contract of [
  "historische 90-dagenbezoekersbaseline kan",
  "18 van 37",
  "28 augustus 2026",
  "T0 + 7 dagen",
  "T0 + 30 dagen",
  "T0 + 60 dagen",
  "T0 + 90 dagen",
  "minimaal €250 aantoonbare nettowinst per maand",
  "Geen historische analytics betekent geen historische nul"
])assert(baseline.includes(contract),`commerciële baseline mist contract: ${contract}`);

console.log("Transfer-readiness: runbook, auditbewijs, commerciële baseline, generieke Cloudflare-preview en fail-safe Web Analytics-setup zijn geborgd.");
