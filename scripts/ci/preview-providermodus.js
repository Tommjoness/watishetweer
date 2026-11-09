"use strict";

/* Providermodus van de PR-preview (SEC-02).

   Het previewproject `watishetweer-preview` bevat bewust GEEN providersleutels: PR-code draait daar en kan alles lezen wat
   in dat project staat (Cloudflare-documentatie: secrets zijn via `context.env` leesbaar voor Functions). De echte
   Visual Crossing-sleutel (productie) mag daar dus nooit staan.

   Twee modi, uitsluitend te kiezen met de omgevingsvariabele PREVIEW_PROVIDERMODUS:

   - "sleutel" (standaard, ook bij een lege of ontbrekende variabele): de bestaande, strenge live-providercontroles.
     Productie, releasekandidaat en release-recovery gebruiken uitsluitend dit pad en zetten de variabele nooit.
   - "geen-sleutel": alleen toegestaan voor *.watishetweer-preview.pages.dev. Dan wordt niet de live fallback bewezen
     (dat kan zonder sleutel niet), maar het echte contract van de route zonder sleutels: HTTP 503, JSON zonder
     extra velden, `no-store`, `Retry-After`, geen bronheader en geen CDN-cache. De positieve fallback wordt in dit
     geval door deterministische mocktests bewezen (scripts/visualcrossing-forecast.test.mjs en de browsertests);
     de echte providerkoppeling blijft getest in de releasekandidaat en de productiesmoke.

   Elke andere waarde van de variabele, en "geen-sleutel" op een ander domein, is een fout (fail-closed). */

const MODI = Object.freeze({ SLEUTEL: "sleutel", GEEN_SLEUTEL: "geen-sleutel" });
const PREVIEW_ROOT = /^https:\/\/[a-z0-9-]+\.watishetweer-preview\.pages\.dev$/;
const REDEN_ZONDER_SLEUTEL = "secundaire weerservice niet geconfigureerd";

function leesModus(env, root) {
  const ruw = String((env && env.PREVIEW_PROVIDERMODUS) || "").trim();
  if (ruw === "" || ruw === MODI.SLEUTEL) return MODI.SLEUTEL;
  if (ruw !== MODI.GEEN_SLEUTEL) throw new Error(`Onbekende PREVIEW_PROVIDERMODUS "${ruw}"; toegestaan: "${MODI.SLEUTEL}" of "${MODI.GEEN_SLEUTEL}".`);
  const schoon = String(root || "").replace(/\/$/, "");
  if (!PREVIEW_ROOT.test(schoon)) throw new Error(`PREVIEW_PROVIDERMODUS=${MODI.GEEN_SLEUTEL} is alleen toegestaan voor *.watishetweer-preview.pages.dev (kreeg: ${schoon || "leeg"}).`);
  return MODI.GEEN_SLEUTEL;
}

/* Beoordeelt het antwoord van /api/forecast op een deployment zonder providersleutels.
   `header` is een functie naam -> waarde (kleine letters). Geeft een lijst met fouten; leeg = voldoet. */
function beoordeelZonderSleutel({ status, header, body }) {
  const f = [];
  const h = naam => { const w = header ? header(naam) : null; return w === undefined || w === null ? "" : String(w); };
  if (status !== 503) f.push(`HTTP ${status} in plaats van 503`);
  if (!/(?:^|,)\s*no-store\b/i.test(h("cache-control"))) f.push("cache-control bevat geen no-store");
  if (!/^[1-9][0-9]*$/.test(h("retry-after").trim())) f.push("retry-after ontbreekt of is geen positief aantal seconden");
  if (h("x-wiw-weather-source")) f.push("een bronheader (x-wiw-weather-source) hoort bij een foutantwoord zonder sleutel niet aanwezig te zijn");
  if (h("cloudflare-cdn-cache-control")) f.push("een foutantwoord mag niet door de Cloudflare-CDN worden gecachet");
  if (!body || typeof body !== "object" || Array.isArray(body)) { f.push("body is geen JSON-object"); return f; }
  if (body.beschikbaar !== false) f.push("beschikbaar is niet false");
  if (body.provider !== "weatherapi") f.push(`provider is "${body.provider}" in plaats van "weatherapi"`);
  if (body.reden !== REDEN_ZONDER_SLEUTEL) f.push(`reden wijkt af van "${REDEN_ZONDER_SLEUTEL}"`);
  const velden = Object.keys(body).sort().join(",");
  if (velden !== "beschikbaar,provider,reden") f.push(`onverwachte velden in het foutantwoord: ${velden}`);
  return f;
}

/* Zelfde dekkingsvoorwaarde als de live-controles: zeven dagen en per dag 23 tot 25 uurwaarden. */
function volledigeForecastDekking(payload) {
  const uren = payload && payload.hourly && payload.hourly.time, dagen = payload && payload.daily && payload.daily.time;
  return Array.isArray(uren) && Array.isArray(dagen) && dagen.length === 7 && dagen.every(dag => {
    const aantal = uren.filter(uur => typeof uur === "string" && uur.startsWith(dag + "T")).length;
    return aantal >= 23 && aantal <= 25;
  });
}

module.exports = { MODI, PREVIEW_ROOT, REDEN_ZONDER_SLEUTEL, leesModus, beoordeelZonderSleutel, volledigeForecastDekking };
