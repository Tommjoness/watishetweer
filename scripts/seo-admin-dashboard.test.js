"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const {serviceToken,accessHeaders,protectedPreviewUrl}=require("./cloudflare-access-service-token.js");

const html=read("admin/seo/index.html");
const js=read("admin/seo/seo-dashboard.js");
const css=read("admin/seo/seo-dashboard.css");
const api=read("functions/api/admin/seo.js");
const cloudflareApi=read("functions/api/admin/seo/cloudflare.js");
const headers=read("cloudflare/_headers");
const workflow=read(".github/workflows/cloudflare-preview.yml");
const productionWorkflow=read(".github/workflows/cloudflare-production.yml");
const preload=read("scripts/cloudflare-access-preload.cjs");
const accessHelper=read("scripts/cloudflare-access-service-token.js");
const PAGES_ACCESS_AUD="ea551fbedaa6efc3ad82569d11df8f0880dc3e54406af51d648aad5ccbb38cec";

function accessAudienceFrom(source,label){
  const constant=source.match(/const PAGES_ACCESS_AUD="([^"]+)";/);
  assert(constant,`${label} mist de vaste Pages Access audience.`);
  assert.equal(constant[1],PAGES_ACCESS_AUD,`${label} gebruikt niet de verwachte Pages Access audience.`);
  const functionMatch=source.match(/function accessAudience\(env,requestUrl\)\{[\s\S]*?\n\}/);
  assert(functionMatch,`${label} mist hostgebonden Access-audience-selectie.`);
  return new Function(`const PAGES_ACCESS_AUD=${JSON.stringify(PAGES_ACCESS_AUD)};${functionMatch[0]};return accessAudience;`)();
}

for(const [label,source] of [["Search Console admin API",api],["Cloudflare admin API",cloudflareApi]]){
  const accessAudience=accessAudienceFrom(source,label);
  assert.equal(accessAudience({CF_ACCESS_AUD:"production-aud"},"https://abc123.watishetweer.pages.dev/api/admin/seo"),PAGES_ACCESS_AUD,`${label} kiest op immutable Pages-host niet de Pages audience.`);
  assert.equal(accessAudience({CF_ACCESS_AUD:"production-aud"},"https://watishetweer.pages.dev/api/admin/seo"),PAGES_ACCESS_AUD,`${label} kiest op de Pages-projecthost niet de Pages audience.`);
  assert.equal(accessAudience({CF_ACCESS_AUD:"production-aud"},"https://watishetweer.nl/api/admin/seo"),"production-aud",`${label} mag het productie-AUD-contract niet wijzigen.`);
  assert.equal(accessAudience({CF_ACCESS_AUD:"production-aud"},"https://www.watishetweer.nl/api/admin/seo"),"production-aud",`${label} mag www niet als Pages-host behandelen.`);
  assert.equal(accessAudience({CF_ACCESS_AUD:"production-aud"},"https://watishetweer.pages.dev.evil.example/api/admin/seo"),"production-aud",`${label} mag een suffix-lookalike niet als Pages-host vertrouwen.`);
  assert(source.includes("const expectedAud=accessAudience(env,context.request.url);"),`${label} gebruikt de hostgebonden audience niet in JWT-validatie.`);
  assert(source.includes("audiences.includes(expectedAud)"),`${label} moet de geselecteerde audience exact in de JWT-audclaim eisen.`);
}

assert(html.includes('meta name="robots" content="noindex,nofollow,noarchive"'),"SEO admin mist noindex-meta.");
assert(html.includes('src="/admin/seo/seo-dashboard.js"'),"SEO admin mist extern script.");
assert(html.includes('href="/admin/seo/seo-dashboard.css"'),"SEO admin mist stylesheet.");
assert(!/<script(?![^>]*\ssrc=)[^>]*>/i.test(html),"SEO admin bevat inline script en botst met CSP.");
assert.doesNotThrow(()=>new Function(js),"SEO dashboard JavaScript bevat een syntaxfout.");
assert(html.includes('data-sort-table="queries"'),"Topzoektermen missen sorteerbare kolommen.");
assert(html.includes('data-sort-table="pages"'),"Toppagina's missen sorteerbare kolommen.");
assert(html.includes('class="data-table rank-table"'),"Topzoektermen/toppagina's missen vaste gedeelde kolomlayout.");
assert(html.includes('class="data-table opportunity-data-table"'),"SEO-kansen missen vaste kolomlayout.");
assert(html.includes('id="new-routes-panel"'),"SEO cockpit mist apart paneel voor de 26 nieuwe plaatsroutes.");
assert(html.includes('id="new-routes-badge"'),"Nieuwe-routepaneel mist statusbadge.");
assert(html.includes('id="new-routes-summary"'),"Nieuwe-routepaneel mist cohortsamenvatting.");
assert(html.includes('id="new-routes"'),"Nieuwe-routepaneel mist routetabel.");
assert(html.includes("Slimme selectie"),"SEO-kansenuitleg mist de nieuwe selectiecopy.");
assert(html.includes('class="cockpit-scene"'),"SEO cockpit mist de futuristische diepte-scene.");
assert(html.includes('class="cockpit-grid"'),"SEO cockpit mist het perspectivische achtergrondgrid.");
assert(html.includes('class="holo-core"'),"SEO cockpit mist de holografische headercore.");
assert(html.includes('id="fx-toggle"'),"SEO cockpit mist de expliciete 3D FX-schakelaar.");
assert(js.includes("/api/admin/seo?scope="),"Dashboard praat niet met de afgeschermde admin-API via de geselecteerde scope.");
for(const option of ['value="24h">24 uur','value="7">7 dagen','value="14">14 dagen','value="28" selected>28 dagen','value="56">56 dagen','value="90">90 dagen'])assert(html.includes(option),`SEO cockpit mist periodeselectie: ${option}`);
assert(html.includes('rel="apple-touch-icon" href="/admin/seo/icon.svg"'),"SEO cockpit mist eigen homescreen-icon.");
assert(fs.existsSync(path.join(root,"admin/seo/icon.svg")),"SEO cockpit SVG-icon ontbreekt.");
assert(js.includes('cache:"no-store"'),"Dashboardrequest moet no-store zijn.");
assert(js.includes("function buildOpportunities"),"Dashboard mist slimme SEO-kansenclassificatie.");
assert(js.includes("function renderNewRoutes"),"Dashboard mist renderer voor het nieuwe-routecohort.");
assert(js.includes('"Wachten op GSC"'),"Dashboard moet pre-launch/lag-data expliciet als nog niet meetbaar tonen.");
assert(js.includes("uitsluitend data sinds livegang"),"Dashboard moet duidelijk maken dat cohortcijfers post-launch zijn.");
assert(js.includes("settledDays"),"Dashboard moet het aantal settled post-launch dagen bepalen.");
assert(js.includes("7-dagencheck")&&js.includes("14-dagencheck"),"Dashboard mist de gecontroleerde SEO-meetcheckpoints.");
assert(js.includes("gecontroleerd title/meta-experiment"),"Dashboard mag title/meta niet als onmiddellijke globale rewrite behandelen.");
assert(js.includes('opportunityType:"near"'),"Dashboard mist bijna-pagina-1-kansen.");
assert(js.includes('opportunityType:"ctr"'),"Dashboard mist CTR-kansen.");
assert(js.includes('opportunityType:"visibility"'),"Dashboard mist zichtbaarheidkansen.");
assert(js.includes('target="_blank" rel="noopener noreferrer"'),"Toppagina's missen veilige doorklik naar productie.");
assert(js.includes("percent.format(share)"),"Apparaten/landen missen impressiepercentages.");
assert(js.includes("3 dagen vertraging voor stabiele data"),"Dashboard moet de bewuste GSC-vertraging uitleggen.");
assert(js.includes("function initCockpitFx"),"Dashboard mist de 3D cockpit-interactielaag.");
assert(js.includes("function wireTilt"),"Dashboard mist begrensde pointer-tilt per kaart.");
assert(js.includes('sessionStorage.setItem("seoCockpitFx"'),"3D FX-keuze moet sessiegebonden blijven.");
assert(js.includes('matchMedia("(prefers-reduced-motion: reduce)")'),"3D FX moet reduced-motion respecteren.");
assert(js.includes("MutationObserver"),"Dynamisch gerenderde dashboardkaarten moeten de 3D-interactie meekrijgen.");
assert(css.includes(".sort-button"),"Dashboard mist styling voor sorteerbare kolommen.");
assert(css.includes(".page-link"),"Dashboard mist styling voor klikbare landingspagina's.");
assert(css.includes(".cohort-kpis"),"Dashboard mist layout voor nieuwe-routecohort.");
assert(css.includes(".cohort-mini"),"Dashboard mist metriekkaarten voor nieuwe-routecohort.");
assert(css.includes(".cockpit-grid"),"Dashboardstylesheet mist het perspectivische grid.");
assert(css.includes(".holo-core"),"Dashboardstylesheet mist de holografische core.");
assert(css.includes("--tilt-x"),"Dashboardstylesheet mist 3D tilt-variabelen.");
assert(css.includes("transform:perspective(1200px)"),"Dashboardkaarten missen echte perspectiefdiepte.");
assert(css.includes("@media(prefers-reduced-motion:reduce)"),"Dashboardstylesheet mist reduced-motion fallback.");
assert(css.includes("body.fx-off"),"Dashboardstylesheet mist handmatige FX-off fallback.");
assert(css.includes("table-layout:fixed"),"Dashboardtabellen moeten vaste kolomgeometrie gebruiken.");
assert(css.includes("font-variant-numeric:tabular-nums"),"Dashboardcijfers moeten tabulair uitlijnen.");
assert(css.includes("minmax(145px,auto) 72px"),"Verdelingsrijen missen vaste metriektracks.");
assert(css.includes(".card,.panel{min-width:0"),"Dashboardcards moeten op smalle viewports kunnen krimpen.");
assert(css.includes(".grid-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)"),"Tweekoloms dashboardgrid mist shrink-safe tracks.");
assert(css.includes(".table-wrap{min-width:0;max-width:100%;overflow:auto"),"Brede tabellen moeten binnen hun eigen kaart scrollen in plaats van de pagina te verbreden.");
assert(css.includes(".kpis,.grid-two,.cohort-kpis,.ga4-kpis{grid-template-columns:minmax(0,1fr)}"),"Mobiele dashboardgrids, inclusief het nieuwe-routecohort, moeten één shrink-safe kolom gebruiken.");
assert(css.length>1000,"Dashboardstylesheet lijkt onvolledig.");

for(const required of [
  "Cf-Access-Jwt-Assertion",
  "crypto.subtle.verify",
  "CF_ACCESS_TEAM_DOMAIN",
  "CF_ACCESS_AUD",
  "SEO_ADMIN_EMAILS",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "webmasters.readonly",
  "analytics.readonly"
])assert(api.includes(required),`SEO admin API mist security/config-contract: ${required}`);

assert(api.includes('status:503,code:"access_not_configured"'),"API moet fail-closed zijn zolang Cloudflare Access niet is ingesteld.");
assert(api.includes('status:403,code:"access_denied"'),"API mist expliciete allowlist-deny.");
assert(api.includes('"Cache-Control":"private, no-store, max-age=0"'),"API-response mist no-store.");
assert(api.includes('grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer"'),"Google OAuth grant type wijkt af van het werkende service-accountcontract.");
assert(api.includes("function ga4Range(days)"),"GA4 mist een eigen actuele datumrange.");
assert(api.includes('raw==="24h"')&&api.includes("DAY_SCOPE_VALUES=new Set([7,14,28,56,90])"),"SEO admin API mist 24 uur/7/14/28/56/90 scopecontract.");
assert(api.includes('["hour","query"]')&&api.includes('"hourly_all"'),"24-uursweergave gebruikt niet de officiële uurlijkse Search Console-data.");
assert(api.includes("first_incomplete_hour")&&api.includes("timestamp<incomplete"),"24-uursweergave moet Search Console-onvoltooide uren uitsluiten.");
assert(api.includes("aggregateHourlyDimension"),"24-uursweergave mist dimensieaggregatie over het rolling venster.");
assert(js.includes("GSC laatste 24 voltooide uren")&&js.includes("onvoltooide uren uitgesloten"),"Dashboard moet expliciet tonen dat de 24-uursweergave alleen voltooide uren gebruikt.");
assert(api.includes('scopeUnsupported:true'),"GA4 moet de 24-uursbeperking expliciet melden in plaats van dagdata als rolling 24 uur te tonen.");
assert(api.includes('const NEW_LOCATION_COHORT=Object.freeze({'),"SEO admin API mist historisch cohort voor de nieuwe routes.");
assert(api.includes('launchDate:"2026-09-18"'),"Nieuwe-routecohort gebruikt niet de echte livegangdatum.");
assert(api.includes("function summarizeRouteCohort"),"SEO admin API mist cohortaggregatie.");
assert(api.includes('typeof row.page==="string"')&&api.includes('?rows:mapRows(rows,"page")'),"Routecohort moet zowel dagquery-rows als reeds geaggregeerde 24-uurs-paginarows accepteren.");
assert(api.includes("newLocationCohort"),"SEO admin response mist nieuwe-routecohort.");
const cohortBlock=(api.match(/const NEW_LOCATION_COHORT=Object\.freeze\(\{[\s\S]*?\n\}\);/)||[])[0]||"";
assert(cohortBlock,"Nieuwe-routecohort kon niet uit de API-bron worden gelezen.");
assert.equal((cohortBlock.match(/\{slug:"[^"]+",name:"[^"]+"\}/g)||[]).length,26,"Nieuwe-routecohort moet exact de 26 routes van 18 september bevatten.");
assert(api.includes("const currentRange=ga4Range(ranges.days);"),"GA4 gebruikt niet de actuele eigen datumrange.");
assert(api.includes("range:currentRange"),"GA4-response rapporteert zijn eigen datumrange niet.");
assert(!api.includes("const dateRanges=[ranges.current];"),"GA4 mag niet de drie dagen vertraagde Search Console-range hergebruiken.");
assert(!api.includes("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:"),"API mag de private-key-variabele niet serialiseren.");

for(const required of ["CLOUDFLARE_ACCOUNT_ID","CLOUDFLARE_ANALYTICS_API_TOKEN","rumPageloadEventsAdaptiveGroups","bot:0","bot:1"]){
  assert(cloudflareApi.includes(required),`Cloudflare admin API mist analytics-contract: ${required}`);
}

assert(headers.includes("/admin/seo/*"),"Cloudflare headers missen adminroute.");
assert(headers.includes("/api/admin/seo"),"Cloudflare headers missen SEO admin API-route.");
assert(headers.includes("X-Robots-Tag: noindex, nofollow, noarchive"),"Cloudflare headers missen noindex voor admin.");

assert.equal(serviceToken({}),null,"Ontbrekend CI-service-token moet optioneel blijven.");
assert.throws(()=>serviceToken({CF_ACCESS_CLIENT_ID:"alleen-id"}),/onvolledig/i,"Half service-token moet hard falen.");
assert.deepEqual(accessHeaders({CF_ACCESS_CLIENT_ID:"id",CF_ACCESS_CLIENT_SECRET:"secret"}),{
  "CF-Access-Client-Id":"id",
  "CF-Access-Client-Secret":"secret"
},"Service-tokenheaders wijken af.");
assert.equal(protectedPreviewUrl("https://pr-321.watishetweer.pages.dev/"),true,"Branch-preview wordt niet herkend als beschermd.");
assert.equal(protectedPreviewUrl("https://abc123.watishetweer.pages.dev/api/forecast"),true,"Immutable preview wordt niet herkend als beschermd.");
assert.equal(protectedPreviewUrl("https://watishetweer.nl/"),false,"Productiedomein mag geen CI-service-tokenheaders krijgen.");
assert.equal(protectedPreviewUrl("https://api.open-meteo.com/v1/forecast"),false,"CI-service-token mag niet naar externe providers lekken.");
assert(!accessHelper.includes("extraHTTPHeaders"),"Browserauth mag Access-secrets niet als globale headers naar externe providers sturen.");
assert(accessHelper.includes("route.fallback"),"Browserauth mist host-begrensde requestinjectie.");
assert(accessHelper.includes("function decoratePage"),"Browserauth moet pagina-routes veilig kunnen overbruggen.");
assert(accessHelper.includes("page.goto=async"),"Browserauth moet de previewroute vlak voor navigatie opnieuw bovenop pagina-interceptie leggen.");
assert(accessHelper.includes("await addPreviewRoute(page,headers)"),"Pagina-interceptie mag de Access-route niet meer omzeilen.");
assert(preload.includes("cloudflare-access-service-token.js"),"CI-preload mist centrale Access-helper.");
for(const required of ["CF_ACCESS_CLIENT_ID","CF_ACCESS_CLIENT_SECRET","cloudflare-access-preload.cjs"]){
  assert(workflow.includes(required),`Cloudflare previewworkflow mist service-tokencontract: ${required}`);
  assert(productionWorkflow.includes(required),`Cloudflare productionworkflow mist service-tokencontract: ${required}`);
}

assert(workflow.includes('CLOUDFLARE_ANALYTICS_API_TOKEN: ${{ secrets.CLOUDFLARE_ANALYTICS_API_TOKEN }}'),"Previewworkflow mist de dedicated Analytics-secret.");
assert(workflow.includes('token:process.env.CLOUDFLARE_ANALYTICS_API_TOKEN'),"Previewworkflow moet de dedicated Analytics-token read-only bewijzen zonder deploytokenfallback.");
assert(workflow.includes('Sync Cloudflare admin analytics preview-bindings'),"Previewworkflow synchroniseert Analytics-bindings niet vóór deploy.");
assert(workflow.includes('CLOUDFLARE_DEPLOYMENT_ENV: preview'),"Previewworkflow moet de gedeelde runtime-sync expliciet op preview richten.");
assert(workflow.includes('run: node scripts/cloudflare-admin-analytics-runtime.js'),"Previewworkflow gebruikt niet de gedeelde veilige runtime-sync.");
assert(workflow.includes('.result.deployment_configs.preview.env_vars.CLOUDFLARE_ANALYTICS_API_TOKEN.type == "secret_text"'),"Post-deploy gate mist de Analytics-tokenbinding.");
assert(workflow.includes('.result.deployment_configs.preview.env_vars.CLOUDFLARE_ACCOUNT_ID.type == "secret_text"'),"Post-deploy gate mist de account-idbinding.");
assert(workflow.includes('.result.deployment_configs.preview.env_vars.GA4_PROPERTY_ID.type == "secret_text"'),"Post-deploy gate mist de duurzame GA4-binding.");

assert(productionWorkflow.includes('run: node scripts/cloudflare-admin-analytics-runtime.js'),"Productionworkflow gebruikt niet de gedeelde veilige runtime-sync.");
assert(productionWorkflow.includes('.result.deployment_configs.production.env_vars.GA4_PROPERTY_ID.type == "secret_text"'),"Production post-deploy gate mist de duurzame GA4-binding.");
assert.equal((productionWorkflow.match(/NODE_OPTIONS: --require=\.\/scripts\/cloudflare-access-preload\.cjs/g)||[]).length,2,"Production moet readiness en immutable smoke via de host-begrensde Access-preload uitvoeren.");
assert(productionWorkflow.includes("Cloudflare Access service token is onvolledig."),"Production moet een half Access service token fail-closed weigeren.");

console.log("SEO admin dashboard contract OK");