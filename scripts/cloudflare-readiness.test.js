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

const wrangler = JSON.parse(lees("wrangler.jsonc"));
assert.strictEqual(wrangler.name, "watishetweer");
assert.strictEqual(wrangler.pages_build_output_dir, "./public");
assert.ok(wrangler.compatibility_date >= "2026-08-04", "Node-compatibele Workers-runtime vereist");

for (const naam of ["neerslag", "plaatsnaam", "waarschuwingen"]) {
  const functie = lees(`functions/api/${naam}.js`);
  const route = lees(`api/${naam}.mjs`);
  assert.ok(functie.includes(`../../api/${naam}.mjs`));
  assert.ok(functie.includes("export async function onRequest(context)"));
  assert.ok(!/Vercel/i.test(functie), `${naam}-functie bevat nog Vercel-compatibiliteit`);
  assert.ok(route.includes("Cloudflare-CDN-Cache-Control"), `${naam}-route mist Cloudflare-cacheheader`);
  assert.ok(!route.includes("Vercel-CDN-Cache-Control"), `${naam}-route bevat nog Vercel-cacheheader`);
}

const middleware = lees("functions/_middleware.js");
assert.ok(middleware.includes("export async function onRequest(context)"));
assert.ok(middleware.includes("X-Content-Type-Options"));
assert.ok(middleware.includes("Content-Security-Policy"));

const routes = JSON.parse(lees("cloudflare/_routes.json"));
assert.deepStrictEqual(routes, { version: 1, include: ["/api/*"], exclude: [] });

const cloudflareHeaders = lees("cloudflare/_headers");
const headerregels = cloudflareHeaders.split(/\r?\n/).map(regel => /^\s{2}([^:]+):\s*(.*)$/.exec(regel)).filter(Boolean);
assert.ok(headerregels.length >= 6, "Cloudflare mist globale securityheaders");
for (const match of headerregels) {
  const key = match[1].trim();
  const value = match[2].trim();
  assert.ok(middleware.includes(`\"${key}\"`), `Cloudflare Functions-middleware mist security header ${key}`);
  assert.ok(middleware.includes(value), `Cloudflare Functions-middleware wijkt af voor ${key}`);
}

assert.ok(!fs.existsSync(path.join(root, "vercel.json")), "vercel.json hoort niet meer in de Cloudflare-only repository");

const nietGevonden = lees("cloudflare/404.html");
assert.ok(nietGevonden.includes("<meta name=\"robots\" content=\"noindex,nofollow\">"));
assert.ok(nietGevonden.includes("Pagina niet gevonden"));
assert.ok(nietGevonden.includes("href=\"/\""));
assert.ok(lees("scripts/cloudflare-output.js").includes("404.html"));

for (const script of ["scripts/platform-output-cleanup.js", "scripts/cloudflare-output.js", "scripts/cloudflare-preview-smoke.js"]) {
  assert.ok(fs.existsSync(path.join(root, script)), `${script} ontbreekt`);
}

console.log("Cloudflare-only migratiecontract klopt.");
