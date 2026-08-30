"use strict";

const {
  PROJECT,
  DOMAIN,
  authHeaders,
  haalZoneTag
} = require("./cloudflare-disable-rum.js");

const PHASE = "http_ratelimit";
const RULE_REF = "watishetweer_api_rate_limit";
const RULE_DESCRIPTION = "Bescherm watishetweer API tegen request floods";
const EXPRESSION = '(starts_with(http.request.uri.path, "/api/"))';
const PERIOD_SECONDS = 10;
const REQUESTS_PER_PERIOD = 60;
const MITIGATION_SECONDS = 10;
const CHARACTERISTICS = Object.freeze(["cf.colo.id", "ip.src"]);

function gewensteRegel() {
  return {
    action: "block",
    expression: EXPRESSION,
    description: RULE_DESCRIPTION,
    ref: RULE_REF,
    enabled: true,
    ratelimit: {
      characteristics: [...CHARACTERISTICS],
      period: PERIOD_SECONDS,
      requests_per_period: REQUESTS_PER_PERIOD,
      mitigation_timeout: MITIGATION_SECONDS
    }
  };
}

function zelfdeKenmerken(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  return [...a].sort().join("|") === [...b].sort().join("|");
}

function regelKlopt(regel) {
  const limiet = regel && regel.ratelimit;
  return Boolean(
    regel
    && regel.ref === RULE_REF
    && regel.action === "block"
    && regel.enabled !== false
    && regel.expression === EXPRESSION
    && limiet
    && zelfdeKenmerken(limiet.characteristics, CHARACTERISTICS)
    && Number(limiet.period) === PERIOD_SECONDS
    && Number(limiet.requests_per_period) === REQUESTS_PER_PERIOD
    && Number(limiet.mitigation_timeout) === MITIGATION_SECONDS
  );
}

function foutUitBody(status, body) {
  const melding = Array.isArray(body && body.errors)
    ? body.errors.map(x => x && x.message).filter(Boolean).join("; ")
    : "";
  const permissieHint = Number(status) === 403
    ? " De Cloudflare-token mist voor deze zone de permissie Zone > Zone WAF > Edit."
    : "";
  return new Error(`Cloudflare Rate Limiting API faalde (HTTP ${status})${melding ? `: ${melding}` : ""}.${permissieHint}`);
}

async function apiRequest(url, options, fetchImpl = fetch) {
  const response = await fetchImpl(url, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {}
  return { status: Number(response.status), ok: Boolean(response.ok), body };
}

async function haalEntrypoint({ zoneTag, headers, fetchImpl = fetch }) {
  const url = `https://api.cloudflare.com/client/v4/zones/${zoneTag}/rulesets/phases/${PHASE}/entrypoint`;
  const resultaat = await apiRequest(url, { method: "GET", headers }, fetchImpl);
  if (resultaat.status === 404) return null;
  if (!resultaat.ok || !resultaat.body || resultaat.body.success !== true) {
    throw foutUitBody(resultaat.status, resultaat.body);
  }
  return resultaat.body.result;
}

async function apiJson(url, options, fetchImpl = fetch) {
  const resultaat = await apiRequest(url, options, fetchImpl);
  if (!resultaat.ok || !resultaat.body || resultaat.body.success !== true) {
    throw foutUitBody(resultaat.status, resultaat.body);
  }
  return resultaat.body.result;
}

async function maakEntrypoint({ zoneTag, headers, fetchImpl = fetch }) {
  const url = `https://api.cloudflare.com/client/v4/zones/${zoneTag}/rulesets`;
  return apiJson(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "watishetweer API rate limiting",
      description: "Rate limiting voor publieke watishetweer API-routes",
      kind: "zone",
      phase: PHASE,
      rules: [gewensteRegel()]
    })
  }, fetchImpl);
}

function vindEigenRegel(rules) {
  if (!Array.isArray(rules)) return null;
  return rules.find(regel => regel && regel.ref === RULE_REF) || null;
}

function vreemdeRegels(rules) {
  if (!Array.isArray(rules)) return [];
  return rules.filter(regel => regel && regel.ref !== RULE_REF);
}

function beoordeelRuleset(ruleset) {
  if (!ruleset) {
    return {
      actief: false,
      reden: "http_ratelimit-ruleset ontbreekt",
      regel: null,
      vreemd: []
    };
  }

  const rules = Array.isArray(ruleset.rules) ? ruleset.rules : [];
  const regel = vindEigenRegel(rules);
  const vreemd = vreemdeRegels(rules);
  if (vreemd.length > 0) {
    return {
      actief: false,
      reden: regel
        ? "onverwachte extra rate-limitregel naast de eigen regel"
        : "een andere rate-limitregel gebruikt het beschikbare Free-planregel-slot",
      regel,
      vreemd
    };
  }

  return {
    actief: regelKlopt(regel),
    reden: regel ? (regelKlopt(regel) ? null : "eigen rate-limitregel wijkt af") : "eigen rate-limitregel ontbreekt",
    regel,
    vreemd
  };
}

async function controleerApiRateLimit({ accountId, token, project = PROJECT, fetchImpl = fetch }) {
  const headers = authHeaders(token);
  const zoneTag = await haalZoneTag({ accountId, token, project, fetchImpl });
  const ruleset = await haalEntrypoint({ zoneTag, headers, fetchImpl });
  const status = beoordeelRuleset(ruleset);
  return {
    actief: status.actief,
    reden: status.reden,
    zoneTag,
    rulesetId: ruleset && ruleset.id || null,
    ruleId: status.regel && status.regel.id || null
  };
}

function assertGeenVreemdeRegels(ruleset) {
  const status = beoordeelRuleset(ruleset);
  if (status.vreemd.length > 0) {
    throw new Error(`${status.reden}. Die wordt bewust niet automatisch overschreven.`);
  }
  return status.regel;
}

async function borgApiRateLimit({ accountId, token, project = PROJECT, fetchImpl = fetch }) {
  const headers = authHeaders(token);
  const zoneTag = await haalZoneTag({ accountId, token, project, fetchImpl });
  let ruleset = await haalEntrypoint({ zoneTag, headers, fetchImpl });

  if (!ruleset) {
    await maakEntrypoint({ zoneTag, headers, fetchImpl });
  } else {
    const bestaand = assertGeenVreemdeRegels(ruleset);
    if (bestaand && regelKlopt(bestaand)) {
      console.log(`Cloudflare API rate limit staat al correct op ${REQUESTS_PER_PERIOD} requests per ${PERIOD_SECONDS}s per IP.`);
      return { gewijzigd: false, zoneTag, rulesetId: ruleset.id || null, ruleId: bestaand.id || null };
    }

    const rulesetId = String(ruleset.id || "").trim();
    if (!rulesetId) throw new Error("Cloudflare http_ratelimit-ruleset mist een ID.");
    const basis = `https://api.cloudflare.com/client/v4/zones/${zoneTag}/rulesets/${rulesetId}`;
    if (bestaand && bestaand.id) {
      await apiJson(`${basis}/rules/${bestaand.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(gewensteRegel())
      }, fetchImpl);
    } else {
      await apiJson(`${basis}/rules`, {
        method: "POST",
        headers,
        body: JSON.stringify(gewensteRegel())
      }, fetchImpl);
    }
  }

  ruleset = await haalEntrypoint({ zoneTag, headers, fetchImpl });
  const bevestigd = assertGeenVreemdeRegels(ruleset);
  if (!regelKlopt(bevestigd)) throw new Error("Cloudflare API rate limit is na schrijven niet correct actief.");
  if (!Array.isArray(ruleset.rules) || ruleset.rules.length !== 1) {
    throw new Error("Cloudflare Free-plan rate-limitregels bevatten na schrijven onverwacht meer dan de ene bedoelde regel.");
  }
  console.log(`Cloudflare API rate limit actief: ${REQUESTS_PER_PERIOD} requests per ${PERIOD_SECONDS}s per IP, ${MITIGATION_SECONDS}s block.`);
  return { gewijzigd: true, zoneTag, rulesetId: ruleset.id || null, ruleId: bevestigd.id || null };
}

if (require.main === module) {
  borgApiRateLimit({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    token: process.env.CLOUDFLARE_API_TOKEN,
    project: process.env.CLOUDFLARE_PROJECT || PROJECT
  }).catch(error => {
    console.error(error && error.stack || error);
    process.exit(1);
  });
}

module.exports = {
  PROJECT,
  DOMAIN,
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
  foutUitBody,
  apiRequest,
  haalEntrypoint,
  maakEntrypoint,
  vindEigenRegel,
  vreemdeRegels,
  beoordeelRuleset,
  controleerApiRateLimit,
  borgApiRateLimit
};
