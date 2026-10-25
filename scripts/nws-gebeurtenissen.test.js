"use strict";

/* Elke officiële NWS-gebeurtenis heeft een specifieke weergave. De pagina mag nooit een algemene kop
   ("Officiële weerwaarschuwing") tonen waar de bron de gebeurtenis kent. Gecontroleerd tegen de volledige lijst van
   https://api.weather.gov/alerts/types (fixture van 25 oktober 2026) en tegen de keten viaNWS → antwoord. */

const assert = require("assert");
const fixture = require("./fixtures/nws-gebeurtenistypen.json");
const { nwsGebeurtenis, nwsErnst, nwsPrioriteit, klasseUitNaam, KLASSE_RANG, TABEL } = require("../lib/nws-gebeurtenissen.cjs");
const handler = require("../lib/waarschuwingen.cjs");

assert.equal(fixture.eventTypes.length, fixture.aantal, "de fixture moet de volledige lijst bevatten");
assert(fixture.eventTypes.length >= 111);

/* 1. Dekking: elke officiële naam staat in de tabel, geen dubbelen, geen verzonnen vertalingen die gelijk zijn aan het Engels. */
const namen = TABEL.map(r => r[0].toLowerCase());
assert.equal(new Set(namen).size, namen.length, "dubbele gebeurtenis in de tabel");
for (const naam of fixture.eventTypes) {
  /* "Test" is een testbericht en wordt niet getoond (zie 4); alle andere officiële namen hebben een regel. */
  if (naam === "Test") continue;
  assert(namen.includes(naam.toLowerCase()), "ontbreekt in lib/nws-gebeurtenissen.cjs: " + naam);
}
for (const [naam, nl] of TABEL) {
  if (nl === null) continue;
  assert.notEqual(nl.toLowerCase(), naam.toLowerCase(), "een Nederlandse titel mag niet gelijk zijn aan de Engelse naam: " + naam);
  assert(/^[A-ZÀ-Ý0-9]/.test(nl), "titel begint met hoofdletter: " + nl);
  assert(!/\.$/.test(nl) && !/:/.test(nl), "titel zonder punt of dubbele punt: " + nl);
}

/* 2. De bestaande, door de eigenaar geaccepteerde titels blijven letterlijk gelijk. */
const BESTAAND = {
  "Heat Advisory": "Hitteadvies",
  "Extreme Heat Warning": "Waarschuwing voor extreme hitte",
  "Excessive Heat Warning": "Waarschuwing voor extreme hitte",
  "Heat Warning": "Waarschuwing voor hitte",
  "Air Quality Alert": "Luchtkwaliteitswaarschuwing",
  "Air Quality Advisory": "Luchtkwaliteitsadvies",
  "Winter Storm Warning": "Waarschuwing voor zwaar winterweer",
  "Winter Weather Advisory": "Winterweeradvies",
  "Severe Thunderstorm Warning": "Waarschuwing voor zwaar onweer",
  "Severe Thunderstorm Watch": "Waakzaamheid voor zwaar onweer",
  "Tornado Warning": "Tornadowaarschuwing",
  "Tornado Watch": "Waakzaamheid voor tornado's",
  "Flash Flood Warning": "Waarschuwing voor plotselinge overstromingen",
  "Flood Warning": "Waarschuwing voor overstromingen",
  "Flood Watch": "Waakzaamheid voor overstromingen",
  "Wind Advisory": "Windadvies",
  "High Wind Warning": "Waarschuwing voor zeer harde wind",
  "Dense Fog Advisory": "Mistadvies",
  "Rip Current Statement": "Melding over gevaarlijke stromingen (rip currents)",
  "Coastal Flood Advisory": "Advies voor overstroming aan de kust"
};
for (const [en, nl] of Object.entries(BESTAAND)) assert.equal(nwsGebeurtenis(en).titelNl, nl, en);

/* 3. De gebeurtenissen uit de audit van 25 oktober (Miami) die eerst een algemene kop kregen. */
assert.equal(nwsGebeurtenis("Coastal Flood Warning").titelNl, "Waarschuwing voor overstroming aan de kust");
assert.equal(nwsGebeurtenis("Hurricane Warning").titelNl, "Orkaanwaarschuwing");
assert.equal(nwsGebeurtenis("Storm Surge Warning").titelNl, "Waarschuwing voor stormvloed");
assert.equal(nwsGebeurtenis("Tropical Storm Warning").titelNl, "Waarschuwing voor een tropische storm");
assert.equal(nwsGebeurtenis("Red Flag Warning").titelNl, "Waarschuwing voor brandgevaarlijk weer (red flag)");
assert.equal(nwsGebeurtenis("Beach Hazards Statement").titelNl, "Melding over gevaren aan het strand");

/* Onzekere vertalingen en onbekende namen: geen Nederlandse titel; de pagina toont de officiële naam. */
for (const naam of ["Blue Alert", "Hydrologic Outlook", "Special Marine Warning"]) {
  const g = nwsGebeurtenis(naam);
  assert.equal(g.titelNl, null, naam + ": onzekere vertaling blijft Engels");
  assert.equal(g.bekend, true);
}
const onbekend = nwsGebeurtenis("Volcanic Fog Warning");
assert.deepEqual(onbekend, { titelNl: null, klasse: "waarschuwing", bekend: false }, "een nieuw type blijft zichtbaar als officiële naam");
assert.deepEqual(nwsGebeurtenis(""), { titelNl: null, klasse: "melding", bekend: false });
assert.deepEqual(nwsGebeurtenis(null), { titelNl: null, klasse: "melding", bekend: false });
assert.equal(nwsGebeurtenis("  coastal   FLOOD warning ").titelNl, "Waarschuwing voor overstroming aan de kust", "hoofdletters en spaties");

/* Klasse volgt de officiële naam. */
assert.equal(klasseUitNaam("Flood Warning"), "waarschuwing");
assert.equal(klasseUitNaam("Flood Watch"), "waakzaamheid");
assert.equal(klasseUitNaam("Small Craft Advisory"), "advies");
assert.equal(klasseUitNaam("Rip Current Statement"), "melding");
assert.equal(klasseUitNaam("Child Abduction Emergency"), "waarschuwing");
assert.equal(klasseUitNaam("Special Weather Statement"), "melding");

/* Ernst: alleen wat de bron zegt; geen KNMI-kleurcode. */
assert.deepEqual([nwsErnst("Minor").nl, nwsErnst("Moderate").nl, nwsErnst("Severe").nl, nwsErnst("Extreme").nl], ["gering", "matig", "ernstig", "extreem"]);
for (const onbekendeWaarde of ["Unknown", "", null, undefined, "Catastrophic"]) assert.equal(nwsErnst(onbekendeWaarde).nl, "niet opgegeven");
assert(nwsErnst("Extreme").rang > nwsErnst("Severe").rang && nwsErnst("Severe").rang > nwsErnst("Moderate").rang && nwsErnst("Moderate").rang > nwsErnst("Minor").rang && nwsErnst("Minor").rang > nwsErnst("Unknown").rang);

/* Prioriteit: ernst gaat voor klasse; klasse beslist bij gelijke ernst. */
const prio = (ernst, klasse) => nwsPrioriteit(nwsErnst(ernst), klasse);
assert(prio("Moderate", "melding") > prio("Minor", "waarschuwing"), "een matige melding staat boven een geringe waarschuwing");
assert(prio("Severe", "waakzaamheid") > prio("Moderate", "waarschuwing"), "ernst gaat voor klasse");
assert(prio("Moderate", "waarschuwing") > prio("Moderate", "waakzaamheid"));
assert(prio("Moderate", "waakzaamheid") > prio("Moderate", "advies"));
assert(prio("Moderate", "advies") > prio("Moderate", "melding"));
assert(prio("Unknown", "waarschuwing") < prio("Minor", "melding"), "onbekende ernst staat onder alle bekende ernst");
assert.deepEqual(Object.keys(KLASSE_RANG).sort(), ["advies", "melding", "waakzaamheid", "waarschuwing"]);

/* De pagina (scripts/final-audit-20260901.js) en de Engelse laag (taal/en.js) hebben eigen kopieën van een klein stuk logica.
   Ze mogen niet uit de pas lopen met de server. */
{
  const fs = require("fs"), path = require("path");
  const client = require("./final-audit-20260901.js");
  for (const [naam, , override] of TABEL) {
    if (!override) assert.equal(client.nwsKlasse(naam), nwsGebeurtenis(naam).klasse, "klasse op de pagina wijkt af van de server: " + naam);
  }
  const en = fs.readFileSync(path.join(__dirname, "..", "taal", "en.js"), "utf8");
  for (const naam of fixture.eventTypes) {
    if (naam === "Test") continue;
    assert(en.includes('"' + naam + '"'), "taal/en.js mist de officiële naam (blijft letterlijk in het Engels staan): " + naam);
  }
}

/* 4. De keten viaNWS: echte NWS-vormen (Miami, Hatteras, Honolulu van 25 oktober 2026) in een nagebootste feed. */
const feature = (event, severity, extra) => ({ properties: Object.assign({
  event, severity, status: "Actual", messageType: "Alert", headline: event + " issued", description: "* WHAT...Test.", instruction: "",
  onset: "2026-10-25T07:43:00-04:00", effective: "2026-10-25T07:43:00-04:00", ends: "2026-10-26T02:00:00-04:00", expires: "2026-10-26T02:00:00-04:00",
  areaDesc: "Coastal Broward County; Coastal Miami Dade County"
}, extra || {}) });

async function metFeed(features, run) {
  const echteFetch = global.fetch;
  global.fetch = async url => {
    assert(/^https:\/\/api\.weather\.gov\/alerts\/active\?point=/.test(String(url)), "alleen de NWS-feed wordt gevraagd");
    return { ok: true, status: 200, json: async () => ({ features }) };
  };
  try {
    const res = { headers: {}, setHeader() {}, status() { return res; }, json(v) { res.body = v; return res; } };
    await handler({ query: { lat: "25.77", lon: "-80.19", land: "US" } }, res);
    return res.body;
  } finally { global.fetch = echteFetch; }
}

(async () => {
  const uit = await metFeed([
    feature("Rip Current Statement", "Moderate"),
    feature("Coastal Flood Warning", "Severe", { onset: "2026-10-26T02:00:00-04:00", ends: "2026-10-27T20:00:00-04:00" }),
    feature("Coastal Flood Advisory", "Minor"),
    feature("Hydrologic Outlook", "Unknown", { ends: null }),
    feature("Test Message", "Unknown", { status: "Test" }),
    feature("Exercise Message", "Minor", { status: "Exercise" }),
    feature("Hurricane Force Wind Warning", "Extreme"),
    feature("Volcanic Fog Warning", "Severe")
  ]);
  assert.equal(uit.dekking, true);
  const titels = uit.lijst.map(w => w.titel);
  assert(!titels.includes("Test Message") && !titels.includes("Exercise Message"), "test- en oefenberichten zijn geen waarschuwing: " + titels);
  assert.equal(uit.lijst.length, 6);

  const per = Object.fromEntries(uit.lijst.map(w => [w.titel, w]));
  assert.equal(per["Coastal Flood Warning"].titel, "Coastal Flood Warning", "de officiële naam blijft ongewijzigd in `titel`");
  assert.equal(per["Coastal Flood Warning"].titelNl, "Waarschuwing voor overstroming aan de kust");
  assert.equal(per["Coastal Flood Warning"].klasse, "waarschuwing");
  assert.equal(per["Coastal Flood Warning"].ernstNl, "ernstig");
  assert.equal(per["Coastal Flood Warning"].bronErnst, "Severe");
  assert.equal(per["Coastal Flood Warning"].niveau, "oranje");
  assert.equal(per["Coastal Flood Warning"].niveauIsOfficieel, false, "NWS-ernst is geen officiële kleurcode");
  assert.equal(per["Volcanic Fog Warning"].titelNl, null, "onbekend type: geen verzonnen vertaling");
  assert.equal(per["Volcanic Fog Warning"].titel, "Volcanic Fog Warning");
  assert.equal(per["Hydrologic Outlook"].ernstNl, "niet opgegeven");
  assert.equal(per["Hydrologic Outlook"].niveau, null, "zonder bronernst geen kleurniveau");
  assert.equal(per["Hydrologic Outlook"].bronErnst, "Unknown", "de ruwe bronwaarde blijft beschikbaar");
  assert.equal(per["Hurricane Force Wind Warning"].niveau, "rood");
  assert.equal(per["Coastal Flood Advisory"].niveau, "geel");
  assert.equal(per["Rip Current Statement"].niveau, "geel");

  const volgorde = uit.lijst.slice().sort((a, b) => b.prioriteit - a.prioriteit).map(w => w.titel);
  assert.deepEqual(volgorde, [
    "Hurricane Force Wind Warning", "Coastal Flood Warning", "Volcanic Fog Warning", "Rip Current Statement", "Coastal Flood Advisory", "Hydrologic Outlook"
  ], "Extreme boven Severe (waarschuwing boven onbekende klasse), Moderate boven Minor, onbekend onderaan");
  console.log("NWS-gebeurtenissen: " + fixture.eventTypes.length + " officiële typen gedekt, onzekere vertalingen blijven Engels, testberichten vallen weg, prioriteit volgt de bronernst.");
})().catch(e => { console.error(e); process.exit(1); });
