"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const lees = p => fs.readFileSync(path.join(root, p), "utf8");

const pkg = JSON.parse(lees("package.json"));
assert.strictEqual(pkg.scripts["build:cloudflare"], "npm run build && node scripts/cloudflare-output.js");
assert.ok(pkg.scripts.postbuild.includes("scripts/platform-output-cleanup.js"));
assert.ok(pkg.scripts["test:prebuild"].includes("scripts/cloudflare-readiness.test.js"));
assert.ok(!fs.existsSync(path.join(root, "vercel.json")), "vercel.json hoort niet meer in de Cloudflare-only repository");

const wrangler = JSON.parse(lees("wrangler.jsonc"));
assert.strictEqual(wrangler.name, "watishetweer");
assert.strictEqual(wrangler.pages_build_output_dir, "./public");
assert.ok(wrangler.compatibility_date >= "2026-08-04", "Node-compatibele Workers-runtime vereist");

for (const naam of ["neerslag", "plaatsnaam", "waarschuwingen"]) {
  const bron = lees(`api/${naam}.mjs`);
  const wrapper = lees(`functions/api/${naam}.js`);
  assert.ok(bron.includes("Cloudflare-CDN-Cache-Control"), `${naam} mist Cloudflare CDN-cachecontract`);
  assert.ok(!bron.includes("Vercel-CDN-Cache-Control"), `${naam} bevat nog Vercel-cachelogica`);
  assert.ok(wrapper.includes(`../../api/${naam}.mjs`));
  assert.ok(wrapper.includes("../../lib/cloudflare-edge-cache.mjs"));
  assert.ok(wrapper.includes("export async function onRequest(context)"));
  assert.ok(wrapper.includes(`metEdgeCache(context, "${naam}", () => worker.fetch(context.request))`), `${naam}-wrapper omzeilt de veilige edge-cache of de bestaande handler`);
  assert.ok(!wrapper.includes("Vercel-CDN-Cache-Control"), `${naam}-wrapper bevat nog Vercel-vertaling`);
}

const edgeCache = lees("lib/cloudflare-edge-cache.mjs");
assert.ok(edgeCache.includes("globalThis.caches.default"));
assert.ok(edgeCache.includes("X-WIW-Edge-Cache"));
assert.ok(edgeCache.includes("cache.match(key)"));
assert.ok(edgeCache.includes("cache.put(key, kopie)"));

const middleware = lees("functions/_middleware.js");
assert.ok(middleware.includes("export async function onRequest(context)"));
assert.ok(middleware.includes("X-Content-Type-Options"));
assert.ok(middleware.includes("Content-Security-Policy"));
assert.ok(middleware.includes('new URL(context.request.url).pathname==="/sw.js"'), "middleware herkent uitsluitend de serviceworkerroute");
assert.ok(middleware.includes("context.env.ASSETS.fetch(context.request)"), "serviceworker moet de exact gebouwde Pages-asset serveren");
assert.ok(middleware.includes('headers.set("Cache-Control","public, no-store, max-age=0, must-revalidate")'), "serviceworker mist een function-level bypass- en revalidatiecontract");

const routes = JSON.parse(lees("cloudflare/_routes.json"));
assert.deepStrictEqual(routes, { version: 1, include: ["/api/*", "/sw.js"], exclude: [] });

const cloudflareHeaders = lees("cloudflare/_headers");
const headerMap = {};
for (const regel of cloudflareHeaders.split(/\r?\n/)) {
  const tekst = regel.trim();
  if (!tekst || !/^\s/.test(regel)) continue;
  const i = tekst.indexOf(":");
  assert.ok(i > 0, `Ongeldige Cloudflare-headerregel: ${tekst}`);
  headerMap[tekst.slice(0, i).toLowerCase()] = tekst.slice(i + 1).trim();
}
for (const sleutel of ["x-content-type-options", "referrer-policy", "x-frame-options", "strict-transport-security", "permissions-policy", "content-security-policy"]) {
  assert.ok(headerMap[sleutel], `Cloudflare mist security header ${sleutel}`);
  const echteNaam = cloudflareHeaders.split(/\r?\n/).map(r => r.trim()).find(r => r.toLowerCase().startsWith(`${sleutel}:`))?.split(":", 1)[0];
  assert.ok(echteNaam && middleware.toLowerCase().includes(`\"${sleutel}\"`), `Cloudflare Functions-middleware mist security header ${sleutel}`);
}

const nietGevonden = lees("cloudflare/404.html");
assert.ok(nietGevonden.includes("<meta name=\"robots\" content=\"noindex,nofollow\">"));
assert.ok(nietGevonden.includes("Pagina niet gevonden"));
assert.ok(nietGevonden.includes("href=\"/\""));
assert.ok(lees("scripts/cloudflare-output.js").includes("404.html"));

for (const script of ["scripts/platform-output-cleanup.js", "scripts/cloudflare-output.js", "scripts/cloudflare-preview-smoke.js", "scripts/cloudflare-edge-cache-smoke.js"]) {
  assert.ok(fs.existsSync(path.join(root, script)), `${script} ontbreekt`);
}

console.log("Cloudflare-only migratiecontract klopt.");
