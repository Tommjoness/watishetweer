"use strict";

/* Browsertests openen een kopie van public/index.html als los bestand
   (chrome --dump-dom file://…). Na platform-output-cleanup staat de app in een
   gebundeld script (/app-<hash>.min.js) en laadt de taallader /taal-<hash>.js;
   met een absoluut pad wijzen die onder file:// naar de schijfwortel en laadt de
   app niet. Deze helper laat alleen die scripts naar public/ wijzen, zodat dezelfde
   test ook op het definitieve artifact draait. Lettertypes en overige bestanden
   blijven ongemoeid, zodat de meetomgeving gelijk blijft. Vóór de bundeling
   (inline app) verandert er niets. */
const path = require("path");
const { pathToFileURL } = require("url");

function metLokaleScripts(html, publicDir) {
  const basis = pathToFileURL(path.resolve(publicDir)).href.replace(/\/$/, "");
  return String(html).replace(/(<script\b[^>]*\ssrc=")\/((?:app|taal)-[0-9a-f-]+(?:\.min)?\.js")/g, (_, voor, rest) => `${voor}${basis}/${rest}`);
}

/* Na de bundeling staan runtime-markeringen in de app-bundle in plaats van in de
   HTML. Deze functie geeft de HTML plus de inhoud van de gebundelde scripts terug,
   om op markeringen te zoeken. */
function metBundelTekst(html, publicDir) {
  const fs = require("fs");
  let tekst = String(html);
  for (const m of tekst.matchAll(/<script\b[^>]*\ssrc="\/(app-[0-9a-f]{12}\.min\.js)"/g)) {
    const p = path.join(publicDir, m[1]);
    if (fs.existsSync(p)) tekst += "\n" + fs.readFileSync(p, "utf8");
  }
  return tekst;
}

module.exports = { metLokaleScripts, metBundelTekst };
