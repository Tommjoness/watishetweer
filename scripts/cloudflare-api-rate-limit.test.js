"use strict";

const assert = require("assert");
const {
  PHASE,
  RULE_REF,
  RULE_DESCRIPTION,
  EXPRESSION,
  PERIOD_SECONDS,
  REQUESTS_PER_PERIOD,
  MITIGATION_SECONDS,
  CHARACTERISTICS,
  gewensteRegel,
  regelKlopt,
  vindEigenRegel,
  beoordeelRuleset,
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

function assertAlleMocksGebruikt(items) {
  assert.equal(items.length, 0, "alle verwachte Cloudflare-calls moeten zijn uitgevoerd");
}

{
  const regel = gewensteRegel();
  assert.equal(PHASE, "http_ratelimit");
  assert.equal(regel.ref, RULE_REF);
  assert.equal(regel.expression, EXPRESSION);
  assert.equal(regel.action, "block");
  assert.deepEqual(regel.ratelimit.characteristics, [...CHARACTERISTICS]);
  assert.deepEqual([...CHARACTERISTICS].sort(), ["cf.colo.id", "ip.src"].sort(), "IP-rate limiting bevat ook de verplichte Cloudflare-colo characteristic");
  assert.equal(regel.ratelimit.period, PERIOD_SECONDS);
  assert.equal(regel.ratelimit.requests_per_period, REQUESTS_PER_PERIOD);
  assert.equal(regel.ratelimit.mitigation_timeout, MITIGATION_SECONDS);
  assert.equal(PERIOD_SECONDS, 10);
  assert.equal(REQUESTS_PER_PERIOD, 60);
  assert.equal(MITIGATION_SECONDS, 10);
  assert.equal(regelKlopt(regel), true);
  assert.equal(regelKlopt({ ...regel, ratelimit: { ...regel.ratelimit, requests_per_period: 10 } }), false);
}

{
  const vreemdMetZelfdeBeschrijving = { id: "foreign", ref: "andere_regel", description: RULE_DESCRIPTION };
  assert.equal(vindEigenRegel([vreemdMetZelfdeBeschrijving]), null, "alleen de stabiele eigen ref bepaalt eigendom; beschrijving is nooit voldoende");
  assert.match(beoordeelRuleset({ rules: [vreemdMetZelfdeBeschrijving] }).reden, /andere rate-limitregel.*Free-planregel-slot/i);
}

(async () => {
  {
    const calls = [];
    const items = [
      ok(DOMAINS),
      ok({ id: RULESET, phase: PHASE, rules: [{ id: RULE, ...gewensteRegel() }] })
    ];
    const fetchImpl = mockQueue(items, calls);
    const uit = await borgApiRateLimit({ accountId: ACCOUNT, token: "token", fetchImpl });
    assert.equal(uit.gewijzigd, false);
    assert.equal(calls.length, 2, "correcte bestaande regel mag geen schrijfcall veroorzaken");
    assert.equal(calls.some(x => x.method !== "GET"), false);
    assertAlleMocksGebruikt(items);
  }

  {
    const calls = [];
    const items = [
      ok(DOMAINS),
      response(404, { success: false, result: null, errors: [{ message: "not found" }] }),
      ok({ id: RULESET, phase: PHASE, rules: [{ id: RULE, ...gewensteRegel() }] }),
      ok({ id: RULESET, phase: PHASE, rules: [{ id: RULE, ...gewensteRegel() }] })
    ];
    const fetchImpl = mockQueue(items, calls);
    const uit = await borgApiRateLimit({ accountId: ACCOUNT, token: "token", fetchImpl });
    assert.equal(uit.gewijzigd, true);
    const create = calls.find(x => x.method === "POST");
    assert.ok(create && create.url.endsWith(`/zones/${ZONE}/rulesets`));
    const payload = JSON.parse(create.body);
    assert.equal(payload.kind, "zone");
    assert.equal(payload.phase, "http_ratelimit");
    assert.equal(payload.rules.length, 1);
    assert.equal(regelKlopt(payload.rules[0]), true);
    assert.equal(calls.filter(x => x.url.includes(`/rulesets/phases/${PHASE}/entrypoint`) && x.method === "GET").length, 2, "na write wordt entrypoint opnieuw uitgelezen");
    assertAlleMocksGebruikt(items);
  }

  {
    const calls = [];
    const items = [
      ok(DOMAINS),
      ok({ id: RULESET, phase: PHASE, rules: [] }),
      ok({ id: RULESET, phase: PHASE, rules: [{ id: RULE, ...gewensteRegel() }] }),
      ok({ id: RULESET, phase: PHASE, rules: [{ id: RULE, ...gewensteRegel() }] })
    ];
    const fetchImpl = mockQueue(items, calls);
    const uit = await borgApiRateLimit({ accountId: ACCOUNT, token: "token", fetchImpl });
    assert.equal(uit.gewijzigd, true);
    const createRule = calls.find(x => x.method === "POST" && x.url.endsWith(`/rulesets/${RULESET}/rules`));
    assert.ok(createRule, "lege bestaande ruleset krijgt precies de eigen regel");
    assert.equal(regelKlopt(JSON.parse(createRule.body)), true);
    assertAlleMocksGebruikt(items);
  }

  {
    const calls = [];
    const afwijkend = { id: RULE, ...gewensteRegel(), ratelimit: { ...gewensteRegel().ratelimit, requests_per_period: 12 } };
    const items = [
      ok(DOMAINS),
      ok({ id: RULESET, phase: PHASE, rules: [afwijkend] }),
      ok({ id: RULESET, phase: PHASE, rules: [{ id: RULE, ...gewensteRegel() }] }),
      ok({ id: RULESET, phase: PHASE, rules: [{ id: RULE, ...gewensteRegel() }] })
    ];
    const fetchImpl = mockQueue(items, calls);
    const uit = await borgApiRateLimit({ accountId: ACCOUNT, token: "token", fetchImpl });
    assert.equal(uit.gewijzigd, true);
    const patch = calls.find(x => x.method === "PATCH");
    assert.ok(patch && patch.url.endsWith(`/rules/${RULE}`));
    assert.equal(regelKlopt(JSON.parse(patch.body)), true);
    assertAlleMocksGebruikt(items);
  }

  {
    const calls = [];
    const items = [
      ok(DOMAINS),
      ok({ id: RULESET, phase: PHASE, rules: [{ id: "foreign", ref: "andere_regel", action: "block", ratelimit: {} }] })
    ];
    const fetchImpl = mockQueue(items, calls);
    await assert.rejects(
      () => borgApiRateLimit({ accountId: ACCOUNT, token: "token", fetchImpl }),
      /andere rate-limitregel.*niet automatisch overschreven/i
    );
    assert.equal(calls.some(x => x.method !== "GET"), false, "vreemde bestaande regel blijft onaangeraakt");
    assertAlleMocksGebruikt(items);
  }

  {
    const calls = [];
    const foreignZelfdeBeschrijving = { id: "foreign", ref: "niet-van-ons", description: RULE_DESCRIPTION, action: "block", ratelimit: {} };
    const items = [
      ok(DOMAINS),
      ok({ id: RULESET, phase: PHASE, rules: [foreignZelfdeBeschrijving] })
    ];
    const fetchImpl = mockQueue(items, calls);
    await assert.rejects(
      () => borgApiRateLimit({ accountId: ACCOUNT, token: "token", fetchImpl }),
      /andere rate-limitregel.*niet automatisch overschreven/i
    );
    assert.equal(calls.some(x => x.method !== "GET"), false, "gelijke beschrijving maakt een vreemde regel niet van ons");
    assertAlleMocksGebruikt(items);
  }

  {
    const calls = [];
    const items = [
      ok(DOMAINS),
      ok({
        id: RULESET,
        phase: PHASE,
        rules: [
          { id: RULE, ...gewensteRegel() },
          { id: "foreign", ref: "andere_regel", action: "block", ratelimit: {} }
        ]
      })
    ];
    const fetchImpl = mockQueue(items, calls);
    await assert.rejects(
      () => borgApiRateLimit({ accountId: ACCOUNT, token: "token", fetchImpl }),
      /onverwachte extra rate-limitregel.*niet automatisch overschreven/i
    );
    assert.equal(calls.some(x => x.method !== "GET"), false, "ook naast een eigen regel wordt een vreemde regel nooit stil aangepast");
    assertAlleMocksGebruikt(items);
  }

  {
    const calls = [];
    const items = [
      ok(DOMAINS),
      response(403, { success: false, result: null, errors: [{ message: "request is not authorized" }] })
    ];
    const fetchImpl = mockQueue(items, calls);
    await assert.rejects(
      () => controleerApiRateLimit({ accountId: ACCOUNT, token: "token", fetchImpl }),
      /Zone > Zone WAF > Edit/i
    );
    assert.equal(calls.some(x => x.method !== "GET"), false, "permissieprobe blijft read-only");
    assertAlleMocksGebruikt(items);
  }

  {
    const calls = [];
    const items = [
      ok(DOMAINS),
      response(404, { success: false, result: null, errors: [{ message: "not found" }] })
    ];
    const fetchImpl = mockQueue(items, calls);
    const uit = await controleerApiRateLimit({ accountId: ACCOUNT, token: "token", fetchImpl });
    assert.equal(uit.actief, false);
    assert.equal(uit.reden, "http_ratelimit-ruleset ontbreekt");
    assert.equal(calls.some(x => x.method !== "GET"), false, "read-only controle schrijft nooit");
    assertAlleMocksGebruikt(items);
  }

  {
    const calls = [];
    const items = [
      ok(DOMAINS),
      ok({ id: RULESET, phase: PHASE, rules: [{ id: "foreign", ref: "andere_regel", action: "block", ratelimit: {} }] })
    ];
    const fetchImpl = mockQueue(items, calls);
    const uit = await controleerApiRateLimit({ accountId: ACCOUNT, token: "token", fetchImpl });
    assert.equal(uit.actief, false);
    assert.match(uit.reden, /andere rate-limitregel.*Free-planregel-slot/i);
    assert.equal(calls.some(x => x.method !== "GET"), false);
    assertAlleMocksGebruikt(items);
  }

  console.log("Cloudflare API rate-limit: Free-planconfig, idempotentie, strikte ref-eigendom, foreign-rule guard, post-write verificatie en permissiefout geborgd.");
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
