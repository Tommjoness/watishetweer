"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

const html=read("admin/seo/index.html");
const js=read("admin/seo/cloudflare-dashboard.js");
const css=read("admin/seo/cloudflare-dashboard.css");
const api=read("functions/api/admin/seo/cloudflare.js");
const reportWorkflow=read(".github/workflows/cloudflare-human-analytics-report.yml");
const setupWorkflow=read(".github/workflows/cloudflare-web-analytics.yml");
const docs=read("docs/cloudflare-web-analytics-activeren.md");

assert(html.includes('id="cloudflare-panel"'),"SEO cockpit mist Cloudflare-paneel.");
assert(html.includes('id="cloudflare-badge"'),"SEO cockpit mist Cloudflare-statusbadge.");
assert(html.includes('id="cloudflare-content"'),"SEO cockpit mist Cloudflare-contentcontainer.");
assert(html.includes('/admin/seo/cloudflare-dashboard.css'),"SEO cockpit mist Cloudflare-stylesheet.");
assert(html.includes('/admin/seo/cloudflare-dashboard.js'),"SEO cockpit mist Cloudflare-script.");
assert(html.includes("Bezoekers & bots"),"SEO cockpit mist bezoekers/bots-kop.");
assert.doesNotThrow(()=>new Function(js),"Cloudflare dashboard-JS bevat een syntaxfout.");
assert(js.includes('/api/admin/seo/cloudflare'),"Cloudflare dashboard gebruikt niet de beschermde adminroute.");
assert(js.includes('cache:"no-store"'),"Cloudflare dashboardrequest moet no-store zijn.");
assert(js.includes("bot-gefilterde visits"),"Cloudflare dashboard mist duidelijke visit-benaming.");
assert(js.includes("geen unieke personen"),"Cloudflare dashboard moet visits als sessies duiden.");
assert(js.includes("cfSampleLabel"),"Cloudflare dashboard mist samplingduiding.");
assert(css.includes(".cf-period-grid"),"Cloudflare dashboard mist periodegrid.");
assert(css.includes(".cf-share-human"),"Cloudflare dashboard mist verkeer-verdeling.");

for(const required of [
  "Cf-Access-Jwt-Assertion",
  "crypto.subtle.verify",
  "CF_ACCESS_TEAM_DOMAIN",
  "CF_ACCESS_AUD",
  "SEO_ADMIN_EMAILS",
  "CLOUDFLARE_ANALYTICS_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "rumPageloadEventsAdaptiveGroups",
  "buildFilter({start,end,bot:0})",
  "buildFilter({start,end,bot:1})",
  'requestHost:${gqlString(DOMAIN)}'
])assert(api.includes(required),`Cloudflare admin API mist contract: ${required}`);

assert(api.includes('"Cache-Control":"private, no-store, max-age=0"'),"Cloudflare admin API mist no-store.");
assert(api.includes('status:503,code:"access_not_configured"'),"Cloudflare admin API moet Access fail-closed afdwingen.");
assert(!api.includes("CLOUDFLARE_ANALYTICS_API_TOKEN:"),"Cloudflare admin API mag de token niet serialiseren.");

assert(reportWorkflow.includes("CLOUDFLARE_ANALYTICS_API_TOKEN: ${{ secrets.CLOUDFLARE_ANALYTICS_API_TOKEN }}"),"Rapportworkflow moet de read-only analytics-secret gebruiken.");
assert(reportWorkflow.includes("if: github.ref == 'refs/heads/main'"),"Production runtime-sync mag alleen op main draaien.");
assert(reportWorkflow.includes("cancel-in-progress: true"),"Een nieuw analyticsrapport moet oudere branchruns vervangen.");
assert(setupWorkflow.includes("CLOUDFLARE_ANALYTICS_SETUP_API_TOKEN: ${{ secrets.CLOUDFLARE_ANALYTICS_SETUP_API_TOKEN }}"),"Setupworkflow mist aparte setup/write-secret.");
assert(!setupWorkflow.includes("secrets.CLOUDFLARE_ANALYTICS_API_TOKEN"),"Setupworkflow mag de read-only rapportagetoken niet gebruiken voor writes.");
assert(docs.includes("Account Analytics → Read"),"Documentatie mist read-only analytics-permissie.");
assert(docs.includes("CLOUDFLARE_ANALYTICS_SETUP_API_TOKEN"),"Documentatie mist gescheiden setup-tokenrol.");

console.log("cloudflare-admin-dashboard.test.js: ok");
