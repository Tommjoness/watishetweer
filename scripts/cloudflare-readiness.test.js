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
  const bron = lees(`functions/api/${naam}.js`);
  assert.ok(bron.includes(`../../api/${naam}.mjs`));
  assert.ok(bron.includes("export async function onRequest(context)"));
  assert.ok(bron.includes("Cloudflare-CDN-Cache-Control"));
  assert.ok(bron.includes("headers.delete(\"Vercel-CDN-Cache-Control\")"));
}

const routes = JSON.parse(lees("cloudflare/_routes.json"));
assert.deepStrictEqual(routes, { version: 1, include: ["/api/*"], exclude: [] });

const vercel = JSON.parse(lees("vercel.json"));
const cloudflareHeaders = lees("cloudflare/_headers");
const globaleHeaders = vercel.headers.find(regel => regel.source === "/(.*)");
assert.ok(globaleHeaders && Array.isArray(globaleHeaders.headers));
for (const header of globaleHeaders.headers) {
  assert.ok(
    cloudflareHeaders.includes(`${header.key}: ${header.value}`),
    `Cloudflare mist security header ${header.key}`
  );
}

for (const script of ["scripts/platform-output-cleanup.js", "scripts/cloudflare-output.js"]) {
  assert.ok(fs.existsSync(path.join(root, script)), `${script} ontbreekt`);
}

console.log("Cloudflare migratiecontract klopt.");
