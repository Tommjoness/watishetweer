"use strict";

/*
 * Taalbewaker: rendert de gebouwde site in het Engels voor alle vaste en een
 * reeks willekeurige weersituaties (mobiel en desktop), klikt de bediening
 * door en faalt zodra er ook maar één Nederlandse tekst zonder Engelse
 * vertaling op het scherm of in een schermlezertekst staat.
 *
 * Plaatsnamen en provincies komen uit de data (seo-locations.config.js en de
 * scenario's) en tellen niet als onvertaald. Nieuwe Nederlandse zinnen in de
 * app laten deze bewaker dus falen tot er een vertaling in taal/en.js staat.
 *
 * Gebruik: node scripts/taal-bewaker.js [--rapport]
 */

const fs = require("fs");
const path = require("path");
const { verzamelCatalogus } = require("./taal-catalogus-browser.js");
const { LOCATIES } = require("./seo-locations.config.js");
const { PLAATSEN } = require("./taal-scenarios-willekeurig.js");

const WILLEKEURIG = Number(process.env.TAAL_WILLEKEURIG || 24);

function namen() {
  const set = new Set();
  for (const l of LOCATIES) for (const v of [l.naam, l.provincie, l.regio]) if (v) set.add(v);
  for (const p of PLAATSEN) set.add(p.plaats);
  /* Plaatsen, regio's en landen uit de vaste scenario's en de nagebootste zoekresultaten. */
  for (const v of ["Almere", "Oss", "New York", "Tromsø", "Utrecht", "Flevoland", "KwaZulu-Natal"]) set.add(v);
  return set;
}

async function main() {
  const rapport = process.argv.includes("--rapport");
  const { catalogus, fouten, aantalScenarios } = await verzamelCatalogus({ taal: "en", willekeurigAantal: WILLEKEURIG });
  const eigen = namen();
  const onvertaald = catalogus.filter(x => !eigen.has(x.tekst));
  const uit = path.join(process.cwd(), "taal-bewaker-rapport.json");
  if (rapport || onvertaald.length || fouten.length) fs.writeFileSync(uit, JSON.stringify({ onvertaald, fouten }, null, 1));
  const kop = `Taalbewaker: ${aantalScenarios} scenario's × 2 breedtes in het Engels`;
  if (fouten.length) {
    console.error(`${kop}: ${fouten.length} paginafouten.\n` + fouten.slice(0, 20).join("\n"));
    if (!rapport) process.exit(1);
  }
  if (onvertaald.length) {
    console.error(`${kop}: ${onvertaald.length} teksten zonder Engelse vertaling (zie ${uit}):\n` + onvertaald.slice(0, 40).map(x => `  - ${x.tekst.slice(0, 160)}  [${x.scenarios.slice(0, 3).join(", ")}]`).join("\n"));
    if (!rapport) process.exit(1);
    return;
  }
  console.log(`${kop}: iedere tekst heeft een Engelse vertaling; geen paginafouten.`);
}

main().catch(e => { console.error(e); process.exit(1); });
