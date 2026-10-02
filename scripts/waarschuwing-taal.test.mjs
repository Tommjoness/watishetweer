/*
 * Officiële waarschuwingstekst in de taal van de bezoeker:
 *   - MeteoAlarm levert per waarschuwing één info-blok per taal; standaard kiest
 *     de server Nederlands, met ?taal=en de officiële Engelse tekst (en-GB);
 *   - ontbreekt de voorkeurstaal, dan de andere van die twee, anders het eerste;
 *   - iedere waarschuwing telt één keer en draagt haar taal mee;
 *   - de edge-cache houdt Nederlands en Engels gescheiden.
 */
import assert from "node:assert";
import { createRequire } from "node:module";
import { canoniekeCacheUrl } from "../lib/cloudflare-edge-cache.mjs";

const require = createRequire(import.meta.url);
const { _intern } = require("../lib/waarschuwingen.cjs");
const { kiesInfo, uitCap } = _intern;

const param = (niveau, type) => [
  { valueName: "awareness_level", value: `${niveau}; yellow; Moderate` },
  { valueName: "awareness_type", value: `${type}; fog` }
];
const blok = (language, event, description) => ({
  language, event, headline: event, description, severity: "Moderate",
  onset: "2026-10-01T05:00:00Z", expires: "2099-10-01T12:00:00Z", parameter: param(2, 4)
});
const feed = { warnings: [{ alert: { info: [
  blok("nl-BE", "Gele waarschuwing voor mist", "Er wordt verspreide mist verwacht."),
  blok("fr-BE", "Avertissement jaune pour brouillard", "Du brouillard est attendu."),
  blok("en-GB", "Yellow warning for fog", "Widespread fog is expected."),
  blok("de-DE", "Gelbe Warnung für Nebel", "Es wird Nebel erwartet.")
] } }] };

/* Standaard Nederlands, met voorkeur Engels de officiële Engelse tekst. */
let lijst = uitCap(feed, 51.05, 3.72);
assert.equal(lijst.length, 1, "één waarschuwing, niet één per taal");
assert.equal(lijst[0].titel, "Gele waarschuwing voor mist");
assert.equal(lijst[0].taal, "nl-BE");
lijst = uitCap(feed, 51.05, 3.72, Date.now(), "en");
assert.equal(lijst.length, 1);
assert.equal(lijst[0].titel, "Yellow warning for fog", "Engelse bezoeker krijgt de officiële Engelse titel");
assert.equal(lijst[0].tekst, "Widespread fog is expected.");
assert.equal(lijst[0].taal, "en-GB");

/* Terugval: zonder Engels het Nederlands, zonder beide het eerste blok. */
assert.equal(kiesInfo([blok("nl-NL", "A", ""), blok("de-DE", "B", "")], "en").event, "A");
assert.equal(kiesInfo([blok("de-DE", "B", ""), blok("en", "C", "")], "nl").event, "C");
assert.equal(kiesInfo([blok("pl-PL", "D", ""), blok("de-DE", "E", "")], "en").event, "D");

/* Edge-cache: Nederlands en Engels apart; onbekende taalwaarden vallen op Nederlands. */
const BASIS = "https://watishetweer.nl/api/waarschuwingen?lat=51.05&lon=3.72&land=BE";
const nl = canoniekeCacheUrl(new Request(BASIS), "waarschuwingen");
const en = canoniekeCacheUrl(new Request(BASIS + "&taal=en"), "waarschuwingen");
const raar = canoniekeCacheUrl(new Request(BASIS + "&taal=xx"), "waarschuwingen");
assert.notEqual(nl, en, "Engelse waarschuwingen hebben een eigen cache-entry");
assert.equal(nl, raar, "alleen taal=en krijgt een eigen entry");
assert.equal(canoniekeCacheUrl(new Request("https://watishetweer.nl/api/forecast?lat=51.05&lon=3.72&taal=en"), "forecast"),
  canoniekeCacheUrl(new Request("https://watishetweer.nl/api/forecast?lat=51.05&lon=3.72"), "forecast"), "taal raakt de forecastcache niet");

console.log("Waarschuwingstaal: Nederlands standaard, officiële Engelse tekst bij ?taal=en, terugval per taal, één waarschuwing per alert en gescheiden edge-cache geslaagd.");
