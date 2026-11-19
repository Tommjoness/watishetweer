"use strict";
const assert = require("node:assert/strict");
const { TARGET, checkTarget, isAccessLoginRedirect, checkAccess } = require("./sec06-a2-access-bewijs");
const env = { CF_ACCESS_CLIENT_ID: "dummy-id", CF_ACCESS_CLIENT_SECRET: "dummy-secret", GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "2", GITHUB_SHA: "a".repeat(40) };
const login = "https://example.cloudflareaccess.com/cdn-cgi/access/login/123?redirect_url=example";
const html = '<html><meta name="weather-build-sha" content="' + "b".repeat(40) + '"></html>';
const response = (status, body = "", headers = {}) => new Response(body, { status, headers });
async function main() {
  const scenarios = [];
  const fake = async (url, options) => {
    scenarios.push({ url, options });
    if (scenarios.length === 1) return response(302, "", { location: login });
    return response(200, html);
  };
  const ok = await checkAccess({ fetchImpl: fake, env, now: () => "2026-11-19T22:00:00Z" });
  assert.equal(ok.resultaat, "SEC-06 A2 ACCESS HTTP-CONTROLE GESLAAGD");
  assert.equal(ok.run_id, "123");
  assert.equal(ok.geen_credentials_http, 302);
  assert.equal(ok.access_credentials_http, 200);
  assert.equal(ok.build_sha, "b".repeat(40));
  assert.equal(scenarios.length, 2);
  assert.equal(scenarios[0].url, TARGET);
  assert.equal(scenarios[0].options.redirect, "manual");
  assert.equal(scenarios[0].options.headers, undefined);
  assert.equal(scenarios[1].options.headers["CF-Access-Client-Secret"], env.CF_ACCESS_CLIENT_SECRET);
  for (const invalid of ["https://example.org/", "http://ab08e2cf.watishetweer.pages.dev/", "https://ab08e2cf.watishetweer.pages.dev/?x=1", "https://ab08e2cf.watishetweer.pages.dev.evil.org/"]) {
    assert.throws(() => checkTarget(invalid));
  }
  assert.equal(isAccessLoginRedirect(login, TARGET), true);
  assert.equal(isAccessLoginRedirect("https://example.com/cdn-cgi/access/login", TARGET), false);
  assert.equal(isAccessLoginRedirect("https://example.cloudflareaccess.com.evil.org/cdn-cgi/access/login", TARGET), false);
  const mustFail = async (options, expected) => assert.rejects(checkAccess(options), expected);
  await mustFail({ fetchImpl: fake, env: {} }, /ontbreekt/);
  await mustFail({ fetchImpl: async () => response(200, html), env }, /302/);
  await mustFail({ fetchImpl: async () => response(302, "", { location: "https://other.com/redirect" }), env }, /inlogpad/);
  let n = 0;
  await mustFail({ fetchImpl: async () => ++n === 1 ? response(302, "", { location: login }) : response(302, "", { location: login }), env }, /200/);
  n = 0;
  await mustFail({ fetchImpl: async () => ++n === 1 ? response(302, "", { location: login }) : response(200, "fake login page"), env }, /weather-build-sha/);
  console.log("SEC-06 A2: 11 positieve/negatieve regressiecontroles geslaagd; geen netwerkverkeer.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
