"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const lees=bestand=>fs.readFileSync(path.join(root,bestand),"utf8");
const readme=lees("README.md");
const runbook=lees("docs/overdracht-runbook.md");
const audit=lees("docs/sale-readiness-audit-2026-08-31.md");
const preview=lees(".github/workflows/cloudflare-preview.yml");

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

console.log("Transfer-readiness: runbook, auditbewijs en generieke Cloudflare-preview zijn geborgd.");
