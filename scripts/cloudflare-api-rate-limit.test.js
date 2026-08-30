"use strict";

const assert = require("assert");
const {
  PHASE,
  RULE_REF,
  EXPRESSION,
  PERIOD_SECONDS,
  REQUESTS_PER_PERIOD,
  MITIGATION_SECONDS,
  CHARACTERISTICS,
  gewensteRegel,
  regelKlopt,
  controleerApiRateLimit,
  borgApiRateLimit
} = require("./cloudflare-api-rate-limit.js");

const ACCOUNT = "a".repeat(32);
const ZONE = "b".repeat(32);
const RULESET = "c".repeat(32);
const RULE = "d".repeat(32);
const DOMAINS = [
  { name: "watishetweer.nl", zone_tag: ZONE },
  { name: "www.watishetweer.nl", zone_tag: ZONE }
];

function response(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function ok(result) {
  return response(200, { success: true, result, errors: [], messages: [] });
}

function mockQueue(items, calls) {
  return async (url, options = {}) => {
    calls.push({ url: String(url), method: String(options.method || "GET"), body: options.body || null });
    const item = items.shift();
    assert.ok(item, `onverwachte Cloudflare-call: ${options.method || "GET"} ${url}`);
    return typeof item === "function" ? item(url, options) : item;
  };
}

{
  const regel = gewensteRegel();
  assert.equal(PHASE, "http_ratelimit");
  assert.equal(regel.ref, RULE_REF);
  assert.equal(regel.expression, EXPRESSION);
  assert.equal(regel.action, "block");
  assert.deepEqual(regel.ratelimit.characteristics, [...CHARACTERISTICS]);
  assert.equal(regel.ratelimit.period, PERIOD_SECONDS);
  assert.equal(regel.ratelimit.requests_per_period, REQUESTS_PER_PERIOD);
  assert.equal(regel.ratelimit.mitigation_timeout, MITIGATION_SECONDS);
  assert.equal(regelKlopt(regel), true);
  assert.equal(regelKlopt({ ...regel, ratelimit: { ...regel.ratelimit, requests_per_period: 10 } }), false);
}

(async () => {
  {
    const calls = [];
    const bestaand = { id: RULE, ...gewensteRegel() };
    const fetchImpl = mockQueue([
      ok(DOMAINS),
      ok({ id: RULESET, phase: PHASE, rules: [bestaand] })
    ], calls);
    const uit = await borgApiRateLimit({ accountId: ACCOUNT, token: "token", fetchImpl });
    assert.equal(uit.gewijzigd, false);
    assert.equal(calls.length, 2, "correcte bestaande regel mag geen schrijfcall veroorzaken");
  }

  {
    const calls = [];
    const fetchImpl = mockQueue([
      ok(DOMAINS),
      response(404, { success: false, result: null, errors: [{ message: "not found" }] }),
      ok({ id: RULESET, phase: PHASE, rules: [{ id: RULE, ...gewensteRegel() }] }),
      ok({ id: RULESET, phase: PHASE, rules: [{ id: RULE, ...gewensteRegel() }] })
    ], calls);
    const uit = await borgApiRateLimit({ accountId: ACCOUNT, token: "token", fetchImpl });
    assert.equal(uit.gewijzigd, true);
    const create = calls.find(x => x.method === "POST");
    assert.ok(create && create.url.endsWith(`/zones/${ZONE}/rulesets`));
    const payload = JSON.parse(create.body);
    assert.equal(payload.kind, "zone");
    assert.equal(payload.phase, "http_ratelimit");
    assert.equal(payload.rules.length, 1);
    assert.equal(regelKlopt(payload.rules[0]), true);
  }

  {
    const calls = [];
    const afwijkend = { id: RULE, ...gewensteRegel(), ratelimit: { ...gewensteRegel().ratelimit, requests_per_period: 12 } };
    const fetchImpl = mockQueue([
      ok(DOMAINS),
      ok({ id: RULESET, phase: PHASE, rules: [afwijkend] }),
      ok({ id: RULESET, phase: PHASE, rules: [{ id: RULE, ...gewensteRegel() }] }),
      ok({ id: RULESET, phase: PHASE, rules: [{ id: RULE, ...gewensteRegel() }] })
    ], calls);
    const uit = await borgApiRateLimit({ accountId: ACCOUNT, token: "token", fetchImpl });
    assert.equal(uit.gewijzigd, true);
    const patch = calls.find(x => x.method === "PATCH");
    assert.ok(patch && patch.url.endsWith(`/rules/${RULE}`));
    assert.equal(regelKlopt(JSON.parse(patch.body)), true);
  }

  {
    const calls = [];
    const fetchImpl = mockQueue([
      ok(DOMAINS),
      ok({ id: RULESET, phase: PHASE, rules: [{ id: "foreign", ref: "andere_regel", action: "block", ratelimit: {} }] })
    ], calls);
    await assert.rejects(
      () => borgApiRateLimit({ accountId: ACCOUNT, token: "token", fetchImpl }),
      /andere Cloudflare rate-limitregel.*niet automatisch overschreven/i
    );
    assert.equal(calls.some(x => x.method !== "GET"), false, "vreemde bestaande regel blijft onaangeraakt");
  }

  {
    const calls = [];
    const fetchImpl = mockQueue([
      ok(DOMAINS),
      response(403, { success: false, result: null, errors: [{ message: "request is not authorized" }] })
    ], calls);
    await assert.rejects(
      () => controleerApiRateLimit({ accountId: ACCOUNT, token: "token", fetchImpl }),
      /WAF\/Rulesets read\+write/i
    );
  }

  {
    const calls = [];
    const fetchImpl = mockQueue([
      ok(DOMAINS),
      response(404, { success: false, result: null, errors: [{ message: "not found" }] })
    ], calls);
    const uit = await controleerApiRateLimit({ accountId: ACCOUNT, token: "token", fetchImpl });
    assert.equal(uit.actief, false);
    assert.equal(uit.reden, "http_ratelimit-ruleset ontbreekt");
    assert.equal(calls.some(x => x.method !== "GET"), false, "read-only controle schrijft nooit");
  }

  console.log("Cloudflare API rate-limit: Free-planconfig, idempotentie, veilige foreign-rule guard en permissiefout geborgd.");
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
