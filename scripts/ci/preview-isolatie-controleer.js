"use strict";

/* Isolatiegrens van het PR-previewproject (SEC-02).

   PR-code wordt als Pages Functions uitgerold. Een Function leest alle variabelen, secrets en bindings van haar
   omgeving via `context.env` (Cloudflare-documentatie: "You cannot see secrets after you set them and can only
   access secrets programmatically on context.env"). Wat in de omgeving staat waarin PR-code draait, is dus voor
   PR-auteurs leesbaar en via een uitgaande fetch te exfiltreren.

   De vertrouwde deployworkflow rolt PR-code daarom uitsluitend uit naar een afzonderlijk previewproject en
   controleert vóór elke deploy, fail-closed, dat dat project:
   - bestaat en niet het productieproject is;
   - geen eigen domeinen heeft (alleen *.pages.dev achter Access), een expliciet ingestelde productiebranch heeft die
     nooit een PR-branch is, niet aan Git gekoppeld is en nog geen productiedeployment heeft;
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

/* `wrangler_config_hash` is geen binding: wrangler stuurt bij elke Pages-deploy de SHA-256 (64 hex-tekens) van het configuratiebestand
   mee en Cloudflare slaat die op in deployment_configs (scripts-bron: wrangler pages deploy; API-documentatie: "hash of the Wrangler
   configuration"). Het veld bestaat pas ná de eerste wrangler-deploy en is daarom bij het ontwerp van deze controle niet gezien. Het is
   alleen neutraal als het ontbreekt, null of een lege tekenreeks is, of precies zo'n hash (64 kleine hex-tekens) is; elke andere vorm (ook een
   leeg object, een lege lijst, false, een getal of hoofdletters) geldt nog steeds als niet-toegestane binding. */
const WRANGLER_CONFIG_HASH = /^[0-9a-f]{64}$/;

const PREVIEWBRANCH = /^pr-[1-9][0-9]*$/;

/* Productiebranch van het previewproject. Een deploy naar de productiebranch is een productiedeployment op de
   publieke projectalias <project>.pages.dev, en die valt niet onder het Access-beleid voor previews (Cloudflare-
   documentatie). Het project moet daarom EXPLICIET een branchnaam hebben die nooit een PR-branch is en waarnaar de
   workflow nooit deployt. De standaardwaarde (main) geldt niet als expliciet en wordt geweigerd. */
const PREVIEW_PRODUCTIEBRANCH = "geen-productiedeploy";

function isLeeg(waarde) {
  if (waarde === null || waarde === undefined || waarde === false || waarde === "") return true;
  if (Array.isArray(waarde)) return waarde.length === 0;
  if (typeof waarde === "object") return Object.keys(waarde).length === 0;
  return false;
}

function controleerIsolatie({ project, domeinen, productieDeployments, previewProject = PREVIEWPROJECT, productieProject = PRODUCTIEPROJECT, branch } = {}) {
  const f = [];
  if (!previewProject || previewProject === productieProject) f.push(`previewproject mag niet het productieproject (${productieProject}) zijn`);
  if (branch !== undefined && !PREVIEWBRANCH.test(String(branch))) f.push(`previewbranch moet pr-<nummer> zijn (kreeg: ${branch}); nooit de productietak`);

  if (!project || project.success !== true || !project.result) {
    f.push(`previewproject ${previewProject} bestaat niet of is niet leesbaar: maak het eerst aan (zie runbook)`);
    return f;
  }
  const r = project.result;
  if (r.name !== previewProject) f.push(`projectnaam ${r.name} komt niet overeen met het verwachte previewproject ${previewProject}`);
  /* Het .pages.dev-subdomein is wereldwijd uniek. Is de naam bij Cloudflare niet vrij, dan krijgt het project een
     toegevoegd achtervoegsel; alle hostnamen in de workflow en de Access-controle gaan dan uit van een ander adres. */
  const verwachtSubdomein = `${previewProject}.pages.dev`;
  if (r.subdomain !== verwachtSubdomein) f.push(`subdomein van het previewproject is ${r.subdomain || "onbekend"}; verwacht ${verwachtSubdomein} (naam niet vrij of niet door de API geleverd)`);

  if (typeof r.production_branch !== "string" || !r.production_branch) f.push("production_branch van het previewproject is niet leesbaar of niet ingesteld");
  else if (r.production_branch !== PREVIEW_PRODUCTIEBRANCH) f.push(`production_branch ${r.production_branch} is niet de verplichte, expliciet ingestelde ${PREVIEW_PRODUCTIEBRANCH}: een deploy naar de productiebranch is publiek bereikbaar via de projectalias (zie runbook)`);
  if (!isLeeg(r.source)) f.push("previewproject is gekoppeld aan een Git-repository; alleen Direct Upload is toegestaan (pushes zouden buiten de workflow om kunnen deployen)");
  if (!isLeeg(r.canonical_deployment)) f.push("previewproject heeft een productiedeployment (canonical_deployment); de projectalias serveert dan publiek inhoud");
  if (!productieDeployments || productieDeployments.success !== true || !Array.isArray(productieDeployments.result)) f.push("productiedeployments van het previewproject niet leesbaar");
  else if (productieDeployments.result.length) f.push(`previewproject heeft ${productieDeployments.result.length}+ productiedeployment(s); de projectalias serveert dan publiek inhoud`);

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
      if (sleutel === "wrangler_config_hash") {
        /* Alleen null, een lege tekenreeks of een SHA-256-hash is neutraal; ook {}, [] en false zijn hier GEEN geldige waarde. */
        if (waarde === null || waarde === "" || (typeof waarde === "string" && WRANGLER_CONFIG_HASH.test(waarde))) continue;
        f.push(`${omgeving}: binding ${sleutel} is niet toegestaan in het previewproject (geen geldige wrangler-configuratiehash)`);
        continue;
      }
      if (!isLeeg(waarde)) f.push(`${omgeving}: binding ${sleutel} is niet toegestaan in het previewproject`);
    }
  }
  return f;
}

async function main(env, haalFn = fetch) {
  const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_PROJECT: naam, PREVIEW_BRANCH: branch } = env;
  if (!token || !account || !naam) { console.error("CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID en CLOUDFLARE_PROJECT zijn verplicht."); return 2; }
  const basis = `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${encodeURIComponent(naam)}`;
  const haal = async url => {
    try {
      const r = await haalFn(url, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      return await r.json().catch(() => null);
    } catch { return null; }
  };
  const project = await haal(basis);
  const domeinen = await haal(basis + "/domains");
  const productieDeployments = await haal(basis + "/deployments?env=production&per_page=1");
  const fouten = controleerIsolatie({ project, domeinen, productieDeployments, previewProject: naam, branch: branch === undefined ? "" : branch });
  if (fouten.length) {
    console.error("Isolatiegrens van het previewproject NIET geborgd; er wordt geen PR-code uitgerold:");
    for (const x of fouten) console.error(`- ${x}`);
    return 1;
  }
  console.log(`Isolatiegrens van ${naam} geborgd: geen eigen domeinen, geen productiedeployment, alleen toegestane variabelen, geen bindings, branch ${branch}.`);
  return 0;
}

if (require.main === module) main(process.env).then(code => process.exit(code));

module.exports = { controleerIsolatie, main, PREVIEW_PRODUCTIEBRANCH, PRODUCTIEPROJECT, PREVIEWPROJECT, TOEGESTANE_VARIABELEN, NEUTRALE_CONFIGSLEUTELS, PREVIEWBRANCH };
