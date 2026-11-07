"use strict";

/* Isolatiegrens van het PR-previewproject (SEC-02).

   PR-code wordt als Pages Functions uitgerold. Een Function leest alle variabelen, secrets en bindings van haar
   omgeving via `context.env` (Cloudflare-documentatie: "You cannot see secrets after you set them and can only
   access secrets programmatically on context.env"). Wat in de omgeving staat waarin PR-code draait, is dus voor
   PR-auteurs leesbaar en via een uitgaande fetch te exfiltreren.

   De vertrouwde deployworkflow rolt PR-code daarom uitsluitend uit naar een afzonderlijk previewproject en
   controleert vóór elke deploy, fail-closed, dat dat project:
   - bestaat en niet het productieproject is;
   - geen eigen domeinen heeft (alleen *.pages.dev achter Access);
   - in preview én production uitsluitend toegestane variabelen heeft (geen Analytics-token, account-id, Access-
     of admin-configuratie, Google-serviceaccount);
   - geen KV-, D1-, R2-, Durable Object-, service- of andere bindings heeft.

   Een afwijking stopt de previewdeployment; er wordt dan niets uitgerold. Dit bestand is puur (geen netwerk) zodat
   het testbaar is; de CLI onderaan haalt de projectgegevens op met het vertrouwde token. */

const PRODUCTIEPROJECT = "watishetweer";
const PREVIEWPROJECT = "watishetweer-preview";

/* Alleen providersleutels en niet-geheime providerconfiguratie. Deze sleutels zijn voor PR-auteurs leesbaar:
   gebruik hier uitsluitend afzonderlijke, quotabegrensde previewsleutels (nooit de productiesleutels). */
const TOEGESTANE_VARIABELEN = Object.freeze(["VISUAL_CROSSING_API_KEY", "WEATHERAPI_KEY", "KNMI_WMS_API_KEY", "NOMINATIM_BASE_URL"]);
const GEHEIM_VERPLICHT = Object.freeze(["VISUAL_CROSSING_API_KEY", "WEATHERAPI_KEY", "KNMI_WMS_API_KEY"]);

/* Sleutels van een deployment_configs-omgeving die geen binding zijn. Alles daarbuiten moet leeg zijn. */
const NEUTRALE_CONFIGSLEUTELS = Object.freeze([
  "env_vars", "compatibility_date", "compatibility_flags", "fail_open", "usage_model", "placement",
  "build_image_major_version", "always_use_latest_compatibility_date", "limits"
]);

const PREVIEWBRANCH = /^pr-[1-9][0-9]*$/;

function isLeeg(waarde) {
  if (waarde === null || waarde === undefined || waarde === false || waarde === "") return true;
  if (Array.isArray(waarde)) return waarde.length === 0;
  if (typeof waarde === "object") return Object.keys(waarde).length === 0;
  return false;
}

function controleerIsolatie({ project, domeinen, previewProject = PREVIEWPROJECT, productieProject = PRODUCTIEPROJECT, branch } = {}) {
  const f = [];
  if (!previewProject || previewProject === productieProject) f.push(`previewproject mag niet het productieproject (${productieProject}) zijn`);
  if (branch !== undefined && !PREVIEWBRANCH.test(String(branch))) f.push(`previewbranch moet pr-<nummer> zijn (kreeg: ${branch}); nooit de productietak`);

  if (!project || project.success !== true || !project.result) {
    f.push(`previewproject ${previewProject} bestaat niet of is niet leesbaar: maak het eerst aan (zie runbook)`);
    return f;
  }
  const r = project.result;
  if (r.name !== previewProject) f.push(`projectnaam ${r.name} komt niet overeen met het verwachte previewproject ${previewProject}`);

  if (!domeinen || domeinen.success !== true || !Array.isArray(domeinen.result)) f.push("domeinen van het previewproject niet leesbaar");
  else if (domeinen.result.length) f.push(`previewproject heeft eigen domeinen (${domeinen.result.map(d => d && d.name).join(", ")}); alleen *.pages.dev is toegestaan`);

  const configs = r.deployment_configs || {};
  for (const omgeving of ["preview", "production"]) {
    const c = configs[omgeving];
    if (!c) { f.push(`deployment_configs.${omgeving} ontbreekt in het API-antwoord`); continue; }
    const vars = c.env_vars || {};
    for (const [naam, waarde] of Object.entries(vars)) {
      if (!TOEGESTANE_VARIABELEN.includes(naam)) f.push(`${omgeving}: variabele ${naam} is niet toegestaan in het previewproject (PR-code kan haar lezen)`);
      else if (GEHEIM_VERPLICHT.includes(naam) && (!waarde || waarde.type !== "secret_text")) f.push(`${omgeving}: ${naam} moet als secret_text zijn ingesteld`);
    }
    for (const [sleutel, waarde] of Object.entries(c)) {
      if (NEUTRALE_CONFIGSLEUTELS.includes(sleutel)) continue;
      if (!isLeeg(waarde)) f.push(`${omgeving}: binding ${sleutel} is niet toegestaan in het previewproject`);
    }
  }
  return f;
}

async function main(env) {
  const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_PROJECT: naam, PREVIEW_BRANCH: branch } = env;
  if (!token || !account || !naam) { console.error("CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID en CLOUDFLARE_PROJECT zijn verplicht."); return 2; }
  const basis = `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${encodeURIComponent(naam)}`;
  const haal = async url => {
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      return await r.json().catch(() => null);
    } catch { return null; }
  };
  const project = await haal(basis);
  const domeinen = await haal(basis + "/domains");
  const fouten = controleerIsolatie({ project, domeinen, previewProject: naam, branch: branch === undefined ? "" : branch });
  if (fouten.length) {
    console.error("Isolatiegrens van het previewproject NIET geborgd; er wordt geen PR-code uitgerold:");
    for (const x of fouten) console.error(`- ${x}`);
    return 1;
  }
  console.log(`Isolatiegrens van ${naam} geborgd: geen eigen domeinen, alleen toegestane variabelen, geen bindings, branch ${branch}.`);
  return 0;
}

if (require.main === module) main(process.env).then(code => process.exit(code));

module.exports = { controleerIsolatie, PRODUCTIEPROJECT, PREVIEWPROJECT, TOEGESTANE_VARIABELEN, NEUTRALE_CONFIGSLEUTELS, PREVIEWBRANCH };
