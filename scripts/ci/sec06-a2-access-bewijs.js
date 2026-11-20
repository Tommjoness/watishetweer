"use strict";
const assert = require("node:assert/strict");
const TARGET = "https://ab08e2cf.watishetweer.pages.dev/";

function checkTarget(url) {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, "https:", "alleen HTTPS toegestaan");
  assert.match(parsed.hostname, /^[a-f0-9]{8}\.watishetweer\.pages\.dev$/, "alleen immutable productieproject-host toegestaan");
  assert.equal(parsed.pathname, "/", "alleen homepage toegestaan");
  assert.equal(parsed.search, "", "queryparameters niet toegestaan");
  assert.equal(parsed.username, "", "geen URL-credentials toegestaan");
  assert.equal(parsed.password, "", "geen URL-credentials toegestaan");
  assert.equal(parsed.port, "", "geen aangepaste poort toegestaan");
  return parsed.href;
}

function isAccessLoginRedirect(location, source) {
  if (!location) return false;
  let parsed;
  try { parsed = new URL(location, source); } catch { return false; }
  return parsed.protocol === "https:" &&
    /^[a-z0-9.-]+\.cloudflareaccess\.com$/i.test(parsed.hostname) &&
    /^\/cdn-cgi\/access\/login(?:\/|$)/.test(parsed.pathname);
}

async function checkAccess({
  url = TARGET, env = process.env, fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString()
} = {}) {
  const target = checkTarget(url);
  const id = String(env.CF_ACCESS_CLIENT_ID || "").trim();
  const secret = String(env.CF_ACCESS_CLIENT_SECRET || "").trim();
  assert.ok(id && secret, "Access Client ID of Client Secret ontbreekt (waarde niet gelogd)");
  assert.equal(typeof fetchImpl, "function", "fetch ontbreekt");

  // GET 1: geen headers, cookies of redirects. Een publiek domein wordt afgekeurd.
  const denied = await fetchImpl(target, {
    method: "GET", redirect: "manual", cache: "no-store",
    signal: AbortSignal.timeout(25000)
  });
  assert.equal(denied.status, 302, "onbevoegde GET moet HTTP 302 opleveren, kreeg " + denied.status);
  assert.ok(isAccessLoginRedirect(denied.headers.get("location"), target),
    "onbevoegde GET ging niet naar het Cloudflare Access-inlogpad");

  // GET 2: alleen de huidige production-environmentsecrets op exact deze host.
  const granted = await fetchImpl(target, {
    method: "GET", redirect: "manual", cache: "no-store",
    signal: AbortSignal.timeout(25000),
    headers: { "CF-Access-Client-Id": id, "CF-Access-Client-Secret": secret }
  });
  assert.equal(granted.status, 200, "GET met Access-credentials moet HTTP 200 opleveren, kreeg " + granted.status);
  const body = await granted.text();
  const match = /<meta name="weather-build-sha" content="([0-9a-f]{40})">/i.exec(body);
  assert.ok(match, "HTTP 200 bevat geen weather-build-sha: mogelijke login-/tussenpagina");

  return {
    resultaat: "SEC-06 A2 ACCESS HTTP-CONTROLE GESLAAGD",
    utc: now(),
    run_id: String(env.GITHUB_RUN_ID || "onbekend"),
    run_attempt: String(env.GITHUB_RUN_ATTEMPT || "onbekend"),
    run_sha: String(env.GITHUB_SHA || "onbekend"),
    doel: target, geen_credentials_http: denied.status,
    access_credentials_http: granted.status, build_sha: match[1]
  };
}

if (require.main === module) {
  checkAccess().then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error("SEC-06 A2 ONVOLDOENDE BEWIJS: " + error.message);
    process.exitCode = 1;
  });
}
module.exports = { TARGET, checkTarget, isAccessLoginRedirect, checkAccess };
